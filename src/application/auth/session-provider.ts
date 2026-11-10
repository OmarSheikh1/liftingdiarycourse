export interface SessionProvider {
  /** Verified id of the current user, or null when signed out. */
  getUserId(): Promise<string | null>;
}
