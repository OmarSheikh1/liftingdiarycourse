// CHG-20261110-003-COACH-PLANS
// Purpose: Clerk adapter for the UserEmailProvider port. Reads only the verified
// primary email, server-side.
import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import type { UserEmailProvider } from "@/application/auth/user-email-provider";

export class ClerkUserEmailProvider implements UserEmailProvider {
  async getEmail() {
    const user = await currentUser();
    const primary = user?.primaryEmailAddress;
    if (!primary || primary.verification?.status !== "verified") return null;
    return primary.emailAddress.trim().toLowerCase();
  }
}
