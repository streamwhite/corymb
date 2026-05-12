import { MAIL_LINK_TOKEN_PARAM } from "@/constants/mail.js";

const URL_PATTERN = /(https?:\/\/[^\s]+)/;

export function extractTokenFromMailText(text: string): string | undefined {
  const match = URL_PATTERN.exec(text);
  if (match === null) {
    return undefined;
  }
  try {
    const url = new URL(match[1] ?? "");
    return url.searchParams.get(MAIL_LINK_TOKEN_PARAM) ?? undefined;
  } catch {
    return undefined;
  }
}
