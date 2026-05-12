import {
  DOCS_COPIED_ARIA_LABEL,
  DOCS_COPY_ARIA_LABEL,
  DOCS_COPY_FAILED_ARIA_LABEL,
  DOCS_COPY_FEEDBACK_MS,
  DOCS_CURL_COPY_BTN_CLASS,
  DOCS_CURL_COPY_SUCCESS_CLASS,
  DOCS_CURL_ICON_DONE_CLASS,
  DOCS_CURL_ICON_IDLE_CLASS,
  DOCS_ENDPOINT_CLASS,
  DOCS_GROUP_CLASS,
  DOCS_GROUP_ENTRIES_CLASS,
  DOCS_GROUP_HEADING_CLASS,
  DOCS_PAGE_TITLE,
} from "@/constants/api-docs.js";
import {
  type ApiDocGroup,
  type ApiDocSection,
  getApiDocGroups,
  getApiDocsMeta,
} from "@/server/api-docs-sections.js";

/** Clipboard icon (stroke follows `currentColor`). */
const CURL_COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CURL_COPIED_CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function docsStyles(): string {
  const btn = DOCS_CURL_COPY_BTN_CLASS;
  const okState = DOCS_CURL_COPY_SUCCESS_CLASS;
  const idle = DOCS_CURL_ICON_IDLE_CLASS;
  const done = DOCS_CURL_ICON_DONE_CLASS;
  return `<style>
:root {
  color-scheme: light;
  --bg: #f0f2f7;
  --surface: #ffffff;
  --text: #141824;
  --muted: #5a6270;
  --accent: #1d4ed8;
  --border: #d8dee8;
  --border-hover: #b6c3d8;
  --radius: 10px;
  --code-bg: #f3f5fa;
  --ok: #059669;
  --ok-surface: #ecfdf5;
  --ok-border: #a7f3d0;
  font-family: system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
  padding: 1.5rem;
}
main {
  max-width: min(52rem, 100%);
  margin: 0 auto;
}
h1 {
  font-size: 1.45rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
  letter-spacing: -0.02em;
  color: var(--text);
}
.lead {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0 0 1.5rem;
  max-width: 42rem;
}
.lead code {
  font-size: 0.88em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--accent);
  border: 1px solid var(--border);
}
.note {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 1.75rem;
}
.${DOCS_GROUP_CLASS} {
  margin-bottom: 1.75rem;
}
.${DOCS_GROUP_HEADING_CLASS} {
  font-size: 1.08rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: var(--text);
  letter-spacing: -0.02em;
}
.${DOCS_GROUP_ENTRIES_CLASS} {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.${DOCS_ENDPOINT_CLASS} {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 1rem 1.15rem 1.15rem;
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.endpoint-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}
.endpoint-meta {
  flex: 1;
  min-width: 0;
}
.endpoint-name {
  font-size: 0.92rem;
  font-weight: 600;
  margin: 0;
  color: var(--text);
  line-height: 1.3;
}
.endpoint-path {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0.25rem 0 0;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
}
.${btn} {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.${btn}:hover {
  color: var(--accent);
  border-color: var(--border-hover);
  background: var(--code-bg);
}
.${btn}:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.${idle}, .${done} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
.${done} {
  display: none;
}
.${btn}.${okState} {
  color: var(--ok);
  border-color: var(--ok-border);
  background: var(--ok-surface);
}
.${btn}.${okState}:hover {
  color: var(--ok);
  border-color: var(--ok-border);
  background: var(--ok-surface);
}
.${btn}.${okState}:focus-visible {
  outline-color: var(--ok);
}
.${btn}.${okState} .${idle} {
  display: none;
}
.${btn}.${okState} .${done} {
  display: inline-flex;
}
pre {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  overflow-x: auto;
  font-size: 0.8rem;
  line-height: 1.45;
}
code {
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
}
</style>`;
}

function introBlock(baseUrl: string, minLen: number, docsPath: string): string {
  const b = escapeHtml(baseUrl);
  const d = escapeHtml(docsPath);
  return `<p class="lead">Example base URL: <code>${b}</code> — adjust host and port to match your server. Passwords must be at least <strong>${String(minLen)}</strong> characters.</p>
<p class="note">This reference: <code>GET ${d}</code> · curl examples only</p>`;
}

function copyCurlScript(): string {
  const l0 = JSON.stringify(DOCS_COPY_ARIA_LABEL);
  const l1 = JSON.stringify(DOCS_COPIED_ARIA_LABEL);
  const l2 = JSON.stringify(DOCS_COPY_FAILED_ARIA_LABEL);
  const resetMs = DOCS_COPY_FEEDBACK_MS;
  const successClass = JSON.stringify(DOCS_CURL_COPY_SUCCESS_CLASS);
  return `<script>
(() => {
  const labelCopy = ${l0};
  const labelOk = ${l1};
  const labelErr = ${l2};
  const resetAfter = ${String(resetMs)};
  const successClass = ${successClass};
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest(".${DOCS_CURL_COPY_BTN_CLASS}");
    if (!btn || !(btn instanceof HTMLButtonElement)) return;
    const block = btn.closest(".${DOCS_ENDPOINT_CLASS}");
    const code = block && block.querySelector("pre code");
    const text = code && code.textContent ? code.textContent : "";
    if (!text) return;
    const reset = () => {
      window.setTimeout(() => {
        btn.setAttribute("aria-label", labelCopy);
        btn.classList.remove(successClass);
      }, resetAfter);
    };
    void navigator.clipboard.writeText(text).then(
      () => {
        btn.classList.add(successClass);
        btn.setAttribute("aria-label", labelOk);
        reset();
      },
      () => {
        btn.setAttribute("aria-label", labelErr);
        reset();
      }
    );
  });
})();
</script>`;
}

function endpointHtml(section: ApiDocSection): string {
  const title = escapeHtml(section.title);
  const sub = escapeHtml(section.subtitle);
  const curl = escapeHtml(section.curl);
  const ep = DOCS_ENDPOINT_CLASS;
  return `<article class="${ep}"><div class="endpoint-head"><div class="endpoint-meta"><h3 class="endpoint-name">${title}</h3><p class="endpoint-path">${sub}</p></div><button type="button" class="${DOCS_CURL_COPY_BTN_CLASS}" aria-label="${escapeHtml(DOCS_COPY_ARIA_LABEL)}"><span class="${DOCS_CURL_ICON_IDLE_CLASS}" aria-hidden="true">${CURL_COPY_ICON_SVG}</span><span class="${DOCS_CURL_ICON_DONE_CLASS}" aria-hidden="true">${CURL_COPIED_CHECK_SVG}</span></button></div><pre><code>${curl}</code></pre></article>`;
}

function groupHtml(group: ApiDocGroup): string {
  const h = escapeHtml(group.heading);
  const inner = group.items.map(endpointHtml).join("");
  return `<section class="${DOCS_GROUP_CLASS}"><h2 class="${DOCS_GROUP_HEADING_CLASS}">${h}</h2><div class="${DOCS_GROUP_ENTRIES_CLASS}">${inner}</div></section>`;
}

export function buildApiDocsHtml(): string {
  const meta = getApiDocsMeta();
  const groups = getApiDocGroups();
  const title = escapeHtml(DOCS_PAGE_TITLE);
  const intro = introBlock(meta.baseUrl, meta.minPasswordLength, meta.docsPath);
  const body = groups.map(groupHtml).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
${docsStyles()}
</head>
<body>
<main>
<h1>${title}</h1>
${intro}
${body}
</main>
${copyCurlScript()}
</body>
</html>`;
}
