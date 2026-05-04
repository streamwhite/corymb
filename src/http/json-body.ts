import { MSG_INVALID_JSON } from "@/constants/messages.js";

export async function readJsonUnknown(
  req: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  try {
    const raw = await req.json();
    return { ok: true, value: raw };
  } catch {
    return { ok: false, error: MSG_INVALID_JSON };
  }
}
