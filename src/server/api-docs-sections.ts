import {
  DOC_EXAMPLE_EMAIL,
  DOC_EXAMPLE_PASSWORD,
  DOC_EXAMPLE_SESSION_TOKEN_PLACEHOLDER,
  DOC_EXAMPLE_UPLOAD_CURL_PATH,
  DOC_EXAMPLE_USERNAME,
  DOCS_EP_AUTH_UI_TITLE,
  DOCS_EP_FORGOT_PASSWORD_TITLE,
  DOCS_EP_HEALTH_TITLE,
  DOCS_EP_RESET_PASSWORD_TITLE,
  DOCS_EP_ROTATE_SESSION_TITLE,
  DOCS_EP_LIST_SESSIONS_TITLE,
  DOCS_EP_REVOKE_SESSION_TITLE,
  DOCS_EP_SIGNIN_TITLE,
  DOCS_EP_SIGNOUT_TITLE,
  DOCS_EP_SIGNUP_TITLE,
  DOCS_EP_TOKEN_TITLE,
  DOCS_EP_UPLOAD_TITLE,
  DOCS_GROUP_AUTH,
  DOCS_GROUP_AUTH_UI,
  DOCS_GROUP_HEALTH,
  DOCS_GROUP_UPLOAD,
  docsExampleHttpBase,
} from "@/constants/api-docs.js";
import { AUTH_BEARER_HEADER_PREFIX, MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import {
  AUTH_LIST_SESSIONS_PATH,
  AUTH_REVOKE_SESSION_PATH,
  AUTH_SESSION_ROTATE_PATH,
  BETTER_AUTH_BASE_PATH,
} from "@/constants/better-auth.js";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";
import {
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  UI_AUTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
import { UPLOAD_FORM_FIELD_NAME } from "@/constants/upload.js";

const BA_SIGN_UP = `${BETTER_AUTH_BASE_PATH}/sign-up/email` as const;
const BA_SIGN_IN = `${BETTER_AUTH_BASE_PATH}/sign-in/email` as const;
const BA_SIGN_OUT = `${BETTER_AUTH_BASE_PATH}/sign-out` as const;
const BA_REQUEST_RESET =
  `${BETTER_AUTH_BASE_PATH}/request-password-reset` as const;
const BA_RESET_PASSWORD = `${BETTER_AUTH_BASE_PATH}/reset-password` as const;
const BA_TOKEN = `${BETTER_AUTH_BASE_PATH}/token` as const;

export type ApiDocSection = {
  title: string;
  subtitle: string;
  curl: string;
};

export type ApiDocGroup = {
  heading: string;
  items: ApiDocSection[];
};

function curlHealth(base: string): string {
  return `curl -sS "${base}${HEALTH_BASE_PATH}"`;
}

function curlUi(base: string): string {
  return `curl -sS "${base}${UI_AUTH_BASE_PATH}"`;
}

function curlPostJson(
  url: string,
  body: Record<string, unknown>,
  extraHeaders?: string[],
): string {
  const headerLines = [
    `-H "Content-Type: application/json"`,
    ...(extraHeaders ?? []),
  ]
    .map((h) => `  ${h}`)
    .join(" \\\n");
  return `curl -sS -X POST "${url}" \\\n${headerLines} \\\n  -d '${JSON.stringify(body)}'`;
}

function curlSignup(base: string): string {
  return curlPostJson(`${base}${BA_SIGN_UP}`, {
    email: DOC_EXAMPLE_EMAIL,
    password: DOC_EXAMPLE_PASSWORD,
    name: DOC_EXAMPLE_USERNAME,
    username: DOC_EXAMPLE_USERNAME,
  });
}

function curlSignin(base: string): string {
  return `curl -sS -X POST "${base}${BA_SIGN_IN}" \\\n  -H "Content-Type: application/json" \\\n  -c cookies.txt \\\n  -d '${JSON.stringify({
    email: DOC_EXAMPLE_EMAIL,
    password: DOC_EXAMPLE_PASSWORD,
  })}'`;
}

function curlSignout(base: string): string {
  return `curl -sS -X POST "${base}${BA_SIGN_OUT}" \\\n  -b cookies.txt`;
}

function curlRotate(base: string): string {
  const authValue = `${AUTH_BEARER_HEADER_PREFIX}${DOC_EXAMPLE_SESSION_TOKEN_PLACEHOLDER}`;
  return `curl -sS -X POST "${base}${AUTH_SESSION_ROTATE_PATH}" \\\n  -H "${HEADER_AUTHORIZATION}: ${authValue}"`;
}

function curlListSessions(base: string): string {
  const authValue = `${AUTH_BEARER_HEADER_PREFIX}${DOC_EXAMPLE_SESSION_TOKEN_PLACEHOLDER}`;
  return `curl -sS "${base}${AUTH_LIST_SESSIONS_PATH}" \\\n  -H "${HEADER_AUTHORIZATION}: ${authValue}"`;
}

function curlRevokeSession(base: string): string {
  const authValue = `${AUTH_BEARER_HEADER_PREFIX}${DOC_EXAMPLE_SESSION_TOKEN_PLACEHOLDER}`;
  return curlPostJson(
    `${base}${AUTH_REVOKE_SESSION_PATH}`,
    { token: DOC_EXAMPLE_SESSION_TOKEN_PLACEHOLDER },
    [`-H "${HEADER_AUTHORIZATION}: ${authValue}"`],
  );
}

function curlToken(base: string): string {
  const authValue = `${AUTH_BEARER_HEADER_PREFIX}${DOC_EXAMPLE_SESSION_TOKEN_PLACEHOLDER}`;
  return `curl -sS "${base}${BA_TOKEN}" \\\n  -H "${HEADER_AUTHORIZATION}: ${authValue}"`;
}

function curlForgotPassword(base: string): string {
  return curlPostJson(`${base}${BA_REQUEST_RESET}`, {
    email: DOC_EXAMPLE_EMAIL,
    redirectTo: `${base}/ui`,
  });
}

function curlResetPassword(base: string): string {
  return curlPostJson(`${base}${BA_RESET_PASSWORD}`, {
    newPassword: DOC_EXAMPLE_PASSWORD,
    token: "<token-from-email-link>",
  });
}

function curlUpload(base: string): string {
  return `curl -sS -X POST "${base}${UPLOAD_BASE_PATH}" \\\n  -F "${UPLOAD_FORM_FIELD_NAME}=@${DOC_EXAMPLE_UPLOAD_CURL_PATH}"`;
}

export function getApiDocsMeta(): {
  baseUrl: string;
  minPasswordLength: number;
  docsPath: string;
} {
  const baseUrl = docsExampleHttpBase();
  return {
    baseUrl,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    docsPath: DOCS_BASE_PATH,
  };
}

function healthGroup(base: string): ApiDocGroup {
  return {
    heading: DOCS_GROUP_HEALTH,
    items: [
      {
        title: DOCS_EP_HEALTH_TITLE,
        subtitle: `GET ${HEALTH_BASE_PATH}`,
        curl: curlHealth(base),
      },
    ],
  };
}

function authUiGroup(base: string): ApiDocGroup {
  return {
    heading: DOCS_GROUP_AUTH_UI,
    items: [
      {
        title: DOCS_EP_AUTH_UI_TITLE,
        subtitle: `GET ${UI_AUTH_BASE_PATH}`,
        curl: curlUi(base),
      },
    ],
  };
}

function authGroup(base: string): ApiDocGroup {
  return {
    heading: DOCS_GROUP_AUTH,
    items: [
      {
        title: DOCS_EP_SIGNUP_TITLE,
        subtitle: `POST ${BA_SIGN_UP}`,
        curl: curlSignup(base),
      },
      {
        title: DOCS_EP_SIGNIN_TITLE,
        subtitle: `POST ${BA_SIGN_IN}`,
        curl: curlSignin(base),
      },
      {
        title: DOCS_EP_ROTATE_SESSION_TITLE,
        subtitle: `POST ${AUTH_SESSION_ROTATE_PATH}`,
        curl: curlRotate(base),
      },
      {
        title: DOCS_EP_LIST_SESSIONS_TITLE,
        subtitle: `GET ${AUTH_LIST_SESSIONS_PATH}`,
        curl: curlListSessions(base),
      },
      {
        title: DOCS_EP_REVOKE_SESSION_TITLE,
        subtitle: `POST ${AUTH_REVOKE_SESSION_PATH}`,
        curl: curlRevokeSession(base),
      },
      {
        title: DOCS_EP_TOKEN_TITLE,
        subtitle: `GET ${BA_TOKEN}`,
        curl: curlToken(base),
      },
      {
        title: DOCS_EP_SIGNOUT_TITLE,
        subtitle: `POST ${BA_SIGN_OUT}`,
        curl: curlSignout(base),
      },
      {
        title: DOCS_EP_FORGOT_PASSWORD_TITLE,
        subtitle: `POST ${BA_REQUEST_RESET}`,
        curl: curlForgotPassword(base),
      },
      {
        title: DOCS_EP_RESET_PASSWORD_TITLE,
        subtitle: `POST ${BA_RESET_PASSWORD}`,
        curl: curlResetPassword(base),
      },
    ],
  };
}

function uploadGroup(base: string): ApiDocGroup {
  return {
    heading: DOCS_GROUP_UPLOAD,
    items: [
      {
        title: DOCS_EP_UPLOAD_TITLE,
        subtitle: `POST ${UPLOAD_BASE_PATH}`,
        curl: curlUpload(base),
      },
    ],
  };
}

export function getApiDocGroups(): ApiDocGroup[] {
  const base = docsExampleHttpBase();
  return [
    healthGroup(base),
    authUiGroup(base),
    authGroup(base),
    uploadGroup(base),
  ];
}
