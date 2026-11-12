import "server-only";
import { createSign } from "node:crypto";
import { firebaseBucket, firebaseEmulatorHost } from "./firebase-storage";

// The site's own access to its Firebase Storage bucket, with full rights, for
// the files visitors mustn't reach (the memories' words, lib/storage.ts) and
// for deleting photos and videos. It signs in with the project's service
// account: FIREBASE_SERVICE_ACCOUNT holds the key file from the Firebase
// console (Project settings → Service accounts → Generate new private key).
// storage.rules don't apply here; nothing in them lets visitors near these
// files.
//
// With the Firebase emulator (NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST), any
// value of FIREBASE_SERVICE_ACCOUNT will do.

export function firebaseAdminConfigured(): boolean {
  return firebaseBucket !== "" && Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim());
}

const API = firebaseEmulatorHost ? `http://${firebaseEmulatorHost}` : "https://storage.googleapis.com";

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount {
  let key: Partial<ServiceAccount> | null = null;
  try {
    key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
  } catch {
    // Reported below.
  }
  if (typeof key?.client_email !== "string" || typeof key?.private_key !== "string") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT should be the whole key file from the Firebase console.");
  }
  // Some ways of pasting turn the key's line breaks into the two characters \n.
  return { client_email: key.client_email, private_key: key.private_key.replace(/\\n/g, "\n") };
}

let token: { value: string; expires: number } | null = null;
let fetchingToken: Promise<string> | null = null;

/** A Google access token for the service account, good for an hour. */
function accessToken(): Promise<string> {
  if (firebaseEmulatorHost) return Promise.resolve("owner");
  if (token && token.expires > Date.now() + 5 * 60_000) return Promise.resolve(token.value);
  fetchingToken ??= (async () => {
    const account = serviceAccount();
    const now = Math.floor(Date.now() / 1000);
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/devstorage.read_write",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Google refused the site's Firebase key (HTTP ${res.status}): ${await res.text()}`);
    const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: access_token, expires: Date.now() + expires_in * 1000 };
    return access_token;
  })().finally(() => {
    fetchingToken = null;
  });
  return fetchingToken;
}

/** Calls Google's Cloud Storage API, trying again if it's briefly unavailable. */
async function call(path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(20_000),
    });
    if ((res.status !== 429 && res.status < 500) || attempt >= 3) return res;
    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
  }
}

const objects = `/storage/v1/b/${encodeURIComponent(firebaseBucket)}/o`;
const object = (name: string) => `${objects}/${encodeURIComponent(name)}`;

async function failure(res: Response, what: string): Promise<Error> {
  return new Error(`Firebase couldn't ${what} (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
}

export class FileExistsError extends Error {}

/** Stores a new file. Throws FileExistsError if there's already one called `name`. */
export async function createFile(name: string, body: string | Buffer, contentType: string): Promise<void> {
  // The file's details and the file itself in one request ("multipart"), the
  // simplest upload the Firebase emulator also understands. ifGenerationMatch=0
  // makes Google refuse to replace an existing file (the emulator ignores it).
  const boundary = `file-${crypto.randomUUID()}`;
  const data = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify({ name, contentType }) +
        `\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    Buffer.from(body),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await call(`/upload${objects}?uploadType=multipart&ifGenerationMatch=0`, {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(data),
  });
  if (res.status === 412) throw new FileExistsError(`${name} already exists`);
  if (!res.ok) throw await failure(res, `store ${name}`);
}

/** The names of all files whose names start with `prefix`. */
export async function listFiles(prefix: string): Promise<string[]> {
  const names: string[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ prefix, fields: "items(name),nextPageToken" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await call(`${objects}?${params}`);
    if (!res.ok) throw await failure(res, `list ${prefix}`);
    const page = (await res.json()) as { items?: { name: string }[]; nextPageToken?: string };
    for (const item of page.items ?? []) names.push(item.name);
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return names;
}

/** A file's contents as text, or null if there's no such file. */
export async function readFileText(name: string): Promise<string | null> {
  const res = await call(`${object(name)}?alt=media`);
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, `read ${name}`);
  return res.text();
}

export async function fileExists(name: string): Promise<boolean> {
  const res = await call(`${object(name)}?fields=name`);
  if (res.status === 404) return false;
  if (!res.ok) throw await failure(res, `look up ${name}`);
  return true;
}

/** Deletes the files, skipping any that are already gone. */
export async function deleteFiles(names: string[]): Promise<void> {
  for (let i = 0; i < names.length; i += 8) {
    await Promise.all(
      names.slice(i, i + 8).map(async (name) => {
        const res = await call(object(name), { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw await failure(res, `delete ${name}`);
      }),
    );
  }
}
