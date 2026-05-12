import { UPLOAD_FORM_FIELD_NAME } from "@/constants/upload.js";

export const MSG_INVALID_JSON = "Invalid JSON body" as const;

export const MSG_PAYLOAD_TOO_LARGE = "Request body is too large" as const;

export const MSG_RATE_LIMITED = "Too many requests; try again later" as const;

export const MSG_INTERNAL = "Internal server error" as const;

export const MSG_HTTP_NOT_FOUND = "Not found" as const;

export const MSG_EMAIL_REQUIRED = "Email is required" as const;

export const MSG_PASSWORD_REQUIRED = "Password is required" as const;

export const MSG_EMAIL_INVALID = "Invalid email format" as const;

export const MSG_PASSWORD_TOO_SHORT = "Password is too short" as const;

export const MSG_EMAIL_TAKEN = "Email already registered" as const;

export const MSG_USERNAME_REQUIRED = "Username is required" as const;

export const MSG_USERNAME_INVALID =
  "Username must be 3–32 characters (letters, digits, underscore)" as const;

export const MSG_USERNAME_TAKEN = "Username already taken" as const;

export const MSG_SIGNUP_UNIQUE_VIOLATION =
  "Email or username already registered" as const;

export const MSG_INVALID_CREDENTIALS = "Invalid email or password" as const;

export const MSG_UPLOAD_NO_FILE =
  `Multipart field "${UPLOAD_FORM_FIELD_NAME}" must be a file` as const;

export const MSG_UPLOAD_INVALID_MULTIPART =
  "Could not parse multipart body" as const;

/** Generic 200 response used by /auth/forgot-password to avoid email enumeration. */
export const MSG_PASSWORD_RESET_DISPATCHED =
  "If the email is registered, a reset link has been sent" as const;

/** Generic 200 response used by /auth/send-verification when current user requests it. */
export const MSG_VERIFICATION_DISPATCHED = "Verification email sent" as const;

export const MSG_AUTH_TOKEN_INVALID = "Invalid or expired token" as const;

export const MSG_ACCESS_TOKEN_REQUIRED = "Access token required" as const;

export const MSG_ACCESS_TOKEN_INVALID =
  "Invalid or expired access token" as const;

export const MSG_REFRESH_TOKEN_REQUIRED = "Refresh token required" as const;

export const MSG_REFRESH_TOKEN_INVALID =
  "Invalid or expired refresh token" as const;

export const MSG_RESET_PASSWORD_REQUIRED =
  "Reset token and new password are required" as const;

export const MSG_VERIFY_EMAIL_TOKEN_REQUIRED =
  "Verification token is required" as const;

export const MSG_EMAIL_VERIFIED = "Email verified" as const;
