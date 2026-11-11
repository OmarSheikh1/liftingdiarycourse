// CHG-20261110-003-COACH-PLANS
// Purpose: Port answering "what is the verified email of the current user?".
// Kept separate from SessionProvider so that port stays single-role.
export interface UserEmailProvider {
  /** Verified primary email of the current user, or null when signed out or unverified. */
  getEmail(): Promise<string | null>;
}
