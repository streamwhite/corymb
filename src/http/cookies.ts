const COOKIE_PAIR_SEP = "; " as const;
const COOKIE_KV_SEP = "=" as const;

export function readCookieValue(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (cookieHeader === null || cookieHeader.length === 0) {
    return undefined;
  }
  const parts = cookieHeader.split(COOKIE_PAIR_SEP);
  for (const part of parts) {
    const idx = part.indexOf(COOKIE_KV_SEP);
    if (idx === -1) {
      continue;
    }
    const k = part.slice(0, idx).trim();
    if (k !== name) {
      continue;
    }
    return part.slice(idx + 1).trim();
  }
  return undefined;
}

export type SetCookieAttrs = {
  name: string;
  value: string;
  path: string;
  maxAgeSeconds: number;
  httpOnly: boolean;
  sameSite: "Lax" | "Strict" | "None";
  secure: boolean;
};

export function formatSetCookie(attrs: SetCookieAttrs): string {
  const parts = [
    `${attrs.name}${COOKIE_KV_SEP}${attrs.value}`,
    `Path=${attrs.path}`,
    `Max-Age=${String(attrs.maxAgeSeconds)}`,
    `SameSite=${attrs.sameSite}`,
  ];
  if (attrs.httpOnly) {
    parts.push("HttpOnly");
  }
  if (attrs.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function formatClearCookie(attrs: {
  name: string;
  path: string;
  secure: boolean;
}): string {
  const parts = [
    `${attrs.name}=`,
    `Path=${attrs.path}`,
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (attrs.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
