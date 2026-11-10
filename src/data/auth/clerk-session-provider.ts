import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { SessionProvider } from "@/application/auth/session-provider";

export class ClerkSessionProvider implements SessionProvider {
  async getUserId() {
    const { userId } = await auth();
    return userId;
  }
}
