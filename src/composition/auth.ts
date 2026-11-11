import "server-only";
import { redirect } from "next/navigation";
import { ClerkSessionProvider } from "@/data/auth/clerk-session-provider";
import { ClerkUserEmailProvider } from "@/data/auth/clerk-user-email-provider";

export async function getAuthenticatedUserId(): Promise<string> {
  const userId = await new ClerkSessionProvider().getUserId();
  if (!userId) redirect("/");
  return userId;
}

// CHG-20261110-003-COACH-PLANS
// Purpose: Verified email of the signed-in user (null when unverified). Redirects when
// signed out, like getAuthenticatedUserId().
export async function getAuthenticatedUserEmail(): Promise<string | null> {
  await getAuthenticatedUserId();
  return new ClerkUserEmailProvider().getEmail();
}
