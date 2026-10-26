import { jpegSize } from "@/lib/jpeg";
import { clientIp, randomId, rateLimit, signPhoto } from "@/lib/security";
import { savePhoto, StorageNotConfiguredError } from "@/lib/storage";
import type { Photo } from "@/lib/types";
import { isHexColor, LIMITS } from "@/lib/validate";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Uploads only come from this site's own share page. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Some browsers omit Origin on same-origin requests.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // e.g. "null" from sandboxed pages
  }
}

// Receives one photo that the browser has already resized and re-encoded as
// JPEG (which also strips location data), stores it, and returns a signed
// receipt that createMemory() checks before attaching the photo to a memory.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return error("Not allowed.", 403);

  // Generous, because guests at a gathering may all share one venue Wi-Fi address.
  if (!rateLimit(`photo:${clientIp(request.headers)}`, 400, 60 * 60)) {
    return error("That's a lot of photos in a short time. Please wait a while and try again.", 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("The upload didn't arrive in one piece. Please try again.", 400);
  }

  const file = form.get("photo");
  if (!(file instanceof File)) return error("No photo was attached.", 400);
  if (file.size > LIMITS.photoBytes) return error("This photo is too large.", 413);

  const body = Buffer.from(await file.arrayBuffer());
  const size = jpegSize(body);
  if (!size || size.width > 8192 || size.height > 8192) {
    return error("This file doesn't look like a photo we can use.", 415);
  }

  const color = form.get("color");
  const id = randomId();
  try {
    const url = await savePhoto(id, body, "image/jpeg", "jpg");
    const photo: Photo = { id, url, ...size, color: isHexColor(color) ? color.toLowerCase() : "#d9d0c3" };
    return Response.json({ photo, receipt: signPhoto(photo) });
  } catch (cause) {
    console.error("Photo upload failed", cause);
    if (cause instanceof StorageNotConfiguredError) return error(cause.message, 503);
    return error("We couldn't save this photo just now. Please try again.", 500);
  }
}
