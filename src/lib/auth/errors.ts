export type AuthorizationErrorCode =
  | "unauthenticated"
  | "unverified"
  | "inactive"
  | "forbidden";

export class AuthorizationError extends Error {
  constructor(
    readonly code: AuthorizationErrorCode,
    readonly status: 401 | 403,
  ) {
    super(status === 401 ? "Authentication required." : "Access denied.");
    this.name = "AuthorizationError";
  }
}
