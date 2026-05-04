export const HEALTH_SEGMENT = "health" as const;

export const HEALTH_BASE_PATH = `/${HEALTH_SEGMENT}` as const;

export const AUTH_SEGMENT = "auth" as const;

export const AUTH_BASE_PATH = `/${AUTH_SEGMENT}` as const;

export const AUTH_SIGNUP_PATH = `${AUTH_BASE_PATH}/signup` as const;

export const AUTH_SIGNIN_PATH = `${AUTH_BASE_PATH}/signin` as const;

export const AUTH_SIGNOUT_PATH = `${AUTH_BASE_PATH}/signout` as const;

export const UI_SEGMENT = "ui" as const;

export const UI_AUTH_BASE_PATH = `/${UI_SEGMENT}` as const;
