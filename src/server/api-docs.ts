import { MIME_TEXT_HTML_UTF8 } from "@/constants/api-docs.js";
import { buildApiDocsHtml } from "@/ui/api-docs-html.js";

export function apiDocsResponse(): Response {
  return new Response(buildApiDocsHtml(), {
    headers: { "Content-Type": MIME_TEXT_HTML_UTF8 },
  });
}
