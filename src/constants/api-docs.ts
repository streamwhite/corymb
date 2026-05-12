import { DEFAULT_HTTP_PORT } from "@/constants/server.js";

export const MIME_TEXT_HTML_UTF8 = "text/html; charset=utf-8" as const;

export const DOCS_PAGE_TITLE = "API reference" as const;

export const DOCS_COPY_ARIA_LABEL = "Copy curl command" as const;

export const DOCS_COPIED_ARIA_LABEL = "Copied" as const;

export const DOCS_COPY_FAILED_ARIA_LABEL = "Copy failed" as const;

/** Time before the copy button’s `aria-label` reverts (ms). */
export const DOCS_COPY_FEEDBACK_MS = 2000;

export const DOCS_CURL_COPY_BTN_CLASS = "curl-copy" as const;

export const DOCS_CURL_COPY_SUCCESS_CLASS = "curl-copy--success" as const;

export const DOCS_CURL_ICON_IDLE_CLASS = "curl-copy__icon--idle" as const;

export const DOCS_CURL_ICON_DONE_CLASS = "curl-copy__icon--done" as const;

/** Wrapper for each curl block (copy button scopes to this element). */
export const DOCS_ENDPOINT_CLASS = "doc-endpoint" as const;

export const DOCS_GROUP_CLASS = "doc-group" as const;

export const DOCS_GROUP_HEADING_CLASS = "doc-group__heading" as const;

export const DOCS_GROUP_ENTRIES_CLASS = "doc-group__entries" as const;

export const DOCS_GROUP_HEALTH = "Health" as const;

export const DOCS_GROUP_AUTH_UI = "Auth UI" as const;

export const DOCS_GROUP_AUTH = "Auth" as const;

export const DOCS_GROUP_UPLOAD = "Upload" as const;

export const DOCS_EP_HEALTH_TITLE = "Health check" as const;

export const DOCS_EP_AUTH_UI_TITLE = "Auth page" as const;

export const DOCS_EP_SIGNUP_TITLE = "Signup" as const;

export const DOCS_EP_SIGNIN_TITLE = "Signin" as const;

export const DOCS_EP_SIGNOUT_TITLE = "Signout" as const;

export const DOCS_EP_REFRESH_TITLE = "Refresh token" as const;

export const DOCS_EP_FORGOT_PASSWORD_TITLE = "Forgot password" as const;

export const DOCS_EP_RESET_PASSWORD_TITLE = "Reset password" as const;

export const DOCS_EP_SEND_VERIFICATION_TITLE =
  "Send verification email" as const;

export const DOCS_EP_VERIFY_EMAIL_TITLE = "Verify email" as const;

export const DOCS_EP_UPLOAD_TITLE = "Upload file" as const;

/** Placeholder path in curl `-F file=@…` (replace with a real local file). */
export const DOC_EXAMPLE_UPLOAD_CURL_PATH = "path/to/local-file.txt" as const;

export const DOCS_EXAMPLE_HOST = "localhost" as const;

/** Example values for curl snippets (meet validation rules). */
export const DOC_EXAMPLE_EMAIL = "you@example.com" as const;

export const DOC_EXAMPLE_USERNAME = "demo_user" as const;

export const DOC_EXAMPLE_PASSWORD = "your-secure-pass" as const;

/** Curl placeholder for the short-lived access JWT returned by signup/signin/refresh. */
export const DOC_EXAMPLE_ACCESS_TOKEN_PLACEHOLDER =
  "<paste-accessToken-from-signup-or-signin>" as const;

/** Curl placeholder for the long-lived refresh token returned by signup/signin/refresh. */
export const DOC_EXAMPLE_REFRESH_TOKEN_PLACEHOLDER =
  "<paste-refreshToken-from-signup-or-signin>" as const;

/** Curl placeholder for single-use email-link tokens. */
export const DOC_EXAMPLE_LINK_TOKEN_PLACEHOLDER =
  "<paste-token-from-email-link>" as const;

export function docsExampleHttpBase(): string {
  return `http://${DOCS_EXAMPLE_HOST}:${String(DEFAULT_HTTP_PORT)}`;
}
