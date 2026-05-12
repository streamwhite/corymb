import {
  DOC_EXAMPLE_ACCESS_TOKEN_PLACEHOLDER,
  DOC_EXAMPLE_EMAIL,
  DOC_EXAMPLE_LINK_TOKEN_PLACEHOLDER,
  DOC_EXAMPLE_PASSWORD,
  DOC_EXAMPLE_REFRESH_TOKEN_PLACEHOLDER,
  DOC_EXAMPLE_UPLOAD_CURL_PATH,
  DOC_EXAMPLE_USERNAME,
  DOCS_EP_AUTH_UI_TITLE,
  DOCS_EP_FORGOT_PASSWORD_TITLE,
  DOCS_EP_HEALTH_TITLE,
  DOCS_EP_REFRESH_TITLE,
  DOCS_EP_RESET_PASSWORD_TITLE,
  DOCS_EP_SEND_VERIFICATION_TITLE,
  DOCS_EP_SIGNIN_TITLE,
  DOCS_EP_SIGNOUT_TITLE,
  DOCS_EP_SIGNUP_TITLE,
  DOCS_EP_UPLOAD_TITLE,
  DOCS_EP_VERIFY_EMAIL_TITLE,
  DOCS_GROUP_AUTH,
  DOCS_GROUP_AUTH_UI,
  DOCS_GROUP_HEALTH,
  DOCS_GROUP_UPLOAD,
  docsExampleHttpBase,
} from "@/constants/api-docs.js";
import {
  AUTH_BEARER_HEADER_PREFIX,
  MIN_PASSWORD_LENGTH,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";
import { MAIL_LINK_TOKEN_PARAM } from "@/constants/mail.js";
import {
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_REFRESH_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SEND_VERIFICATION_PATH,
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
  AUTH_VERIFY_EMAIL_PATH,
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  UI_AUTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
import { UPLOAD_FORM_FIELD_NAME } from "@/constants/upload.js";

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

function curlPostJson(url: string, body: Record<string, unknown>): string {
  return `curl -sS -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`;
}

function curlSignup(base: string): string {
  return curlPostJson(`${base}${AUTH_SIGNUP_PATH}`, {
    email: DOC_EXAMPLE_EMAIL,
    username: DOC_EXAMPLE_USERNAME,
    password: DOC_EXAMPLE_PASSWORD,
  });
}

function curlSignin(base: string): string {
  return curlPostJson(`${base}${AUTH_SIGNIN_PATH}`, {
    email: DOC_EXAMPLE_EMAIL,
    password: DOC_EXAMPLE_PASSWORD,
  });
}

function curlSignout(base: string): string {
  return curlPostJson(`${base}${AUTH_SIGNOUT_PATH}`, {
    [RESPONSE_FIELD_REFRESH_TOKEN]: DOC_EXAMPLE_REFRESH_TOKEN_PLACEHOLDER,
  });
}

function curlRefresh(base: string): string {
  return curlPostJson(`${base}${AUTH_REFRESH_PATH}`, {
    [RESPONSE_FIELD_REFRESH_TOKEN]: DOC_EXAMPLE_REFRESH_TOKEN_PLACEHOLDER,
  });
}

function curlForgotPassword(base: string): string {
  return curlPostJson(`${base}${AUTH_FORGOT_PASSWORD_PATH}`, {
    email: DOC_EXAMPLE_EMAIL,
  });
}

function curlResetPassword(base: string): string {
  return curlPostJson(`${base}${AUTH_RESET_PASSWORD_PATH}`, {
    token: DOC_EXAMPLE_LINK_TOKEN_PLACEHOLDER,
    password: DOC_EXAMPLE_PASSWORD,
  });
}

function curlSendVerification(base: string): string {
  const authValue = `${AUTH_BEARER_HEADER_PREFIX}${DOC_EXAMPLE_ACCESS_TOKEN_PLACEHOLDER}`;
  return `curl -sS -X POST "${base}${AUTH_SEND_VERIFICATION_PATH}" \\\n  -H "${HEADER_AUTHORIZATION}: ${authValue}"`;
}

function curlVerifyEmail(base: string): string {
  return `curl -sS "${base}${AUTH_VERIFY_EMAIL_PATH}?${MAIL_LINK_TOKEN_PARAM}=${DOC_EXAMPLE_LINK_TOKEN_PLACEHOLDER}"`;
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
        subtitle: `POST ${AUTH_SIGNUP_PATH}`,
        curl: curlSignup(base),
      },
      {
        title: DOCS_EP_SIGNIN_TITLE,
        subtitle: `POST ${AUTH_SIGNIN_PATH}`,
        curl: curlSignin(base),
      },
      {
        title: DOCS_EP_REFRESH_TITLE,
        subtitle: `POST ${AUTH_REFRESH_PATH}`,
        curl: curlRefresh(base),
      },
      {
        title: DOCS_EP_SIGNOUT_TITLE,
        subtitle: `POST ${AUTH_SIGNOUT_PATH}`,
        curl: curlSignout(base),
      },
      {
        title: DOCS_EP_FORGOT_PASSWORD_TITLE,
        subtitle: `POST ${AUTH_FORGOT_PASSWORD_PATH}`,
        curl: curlForgotPassword(base),
      },
      {
        title: DOCS_EP_RESET_PASSWORD_TITLE,
        subtitle: `POST ${AUTH_RESET_PASSWORD_PATH}`,
        curl: curlResetPassword(base),
      },
      {
        title: DOCS_EP_SEND_VERIFICATION_TITLE,
        subtitle: `POST ${AUTH_SEND_VERIFICATION_PATH}`,
        curl: curlSendVerification(base),
      },
      {
        title: DOCS_EP_VERIFY_EMAIL_TITLE,
        subtitle: `GET ${AUTH_VERIFY_EMAIL_PATH}`,
        curl: curlVerifyEmail(base),
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
