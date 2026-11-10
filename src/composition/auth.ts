import "server-only";
import { redirect } from "next/navigation";
import { ClerkSessionProvider } from "@/data/auth/clerk-session-provider";

export async function getAuthenticatedUserId(): Promise<string> {
  const userId = await new ClerkSessionProvider().getUserId();
  if (!userId) redirect("/");
  return userId;
}
