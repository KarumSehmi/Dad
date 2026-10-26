import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "./security";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  // The session check compares against the current time, so it must run per
  // request rather than in a prerendered shell.
  await connection();
  return isValidAdminSession(store.get(ADMIN_COOKIE)?.value);
}
