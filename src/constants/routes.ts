export const HEALTH_SEGMENT = "health" as const;

export const HEALTH_BASE_PATH = `/${HEALTH_SEGMENT}` as const;

export const AUTH_SEGMENT = "auth" as const;

export const AUTH_BASE_PATH = `/${AUTH_SEGMENT}` as const;

export const AUTH_SIGNUP_PATH = `${AUTH_BASE_PATH}/signup` as const;

export const AUTH_SIGNIN_PATH = `${AUTH_BASE_PATH}/signin` as const;

export const AUTH_SIGNOUT_PATH = `${AUTH_BASE_PATH}/signout` as const;

export const AUTH_REFRESH_PATH = `${AUTH_BASE_PATH}/refresh` as const;

export const AUTH_FORGOT_PASSWORD_PATH =
  `${AUTH_BASE_PATH}/forgot-password` as const;

export const AUTH_RESET_PASSWORD_PATH =
  `${AUTH_BASE_PATH}/reset-password` as const;

export const AUTH_SEND_VERIFICATION_PATH =
  `${AUTH_BASE_PATH}/send-verification` as const;

export const AUTH_VERIFY_EMAIL_PATH = `${AUTH_BASE_PATH}/verify-email` as const;

export const UI_SEGMENT = "ui" as const;

export const UI_AUTH_BASE_PATH = `/${UI_SEGMENT}` as const;

export const DOCS_SEGMENT = "docs" as const;

export const DOCS_BASE_PATH = `/${DOCS_SEGMENT}` as const;

export const UPLOAD_SEGMENT = "upload" as const;

export const UPLOAD_BASE_PATH = `/${UPLOAD_SEGMENT}` as const;
