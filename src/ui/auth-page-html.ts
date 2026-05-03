import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
} from "@/constants/routes.js";
import { AUTH_PAGE_HEADING, AUTH_PAGE_TITLE } from "@/constants/ui.js";

function authPathsJson(): string {
  return JSON.stringify({
    signup: AUTH_SIGNUP_PATH,
    signin: AUTH_SIGNIN_PATH,
    signout: AUTH_SIGNOUT_PATH,
  });
}

function stylesBlock(): string {
  return `<style>
:root {
  --bg: #0f1419;
  --surface: #1a2332;
  --text: #e7ecf3;
  --muted: #8b9aab;
  --accent: #5b9fd4;
  --err: #e57373;
  --ok: #81c784;
  --radius: 10px;
  font-family: system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  padding: 1.5rem;
}
main { max-width: 28rem; margin: 0 auto; }
h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 1.25rem; }
section {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-bottom: 1rem;
}
h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 0.75rem; }
label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.25rem; }
input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border-radius: 6px;
  border: 1px solid #2d3d52;
  background: #121a24;
  color: var(--text);
  margin-bottom: 0.65rem;
}
input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button {
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #0a0f14;
  font-weight: 600;
  font-size: 0.9rem;
}
button.secondary { background: #3d4f66; color: var(--text); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#msg { min-height: 1.25rem; font-size: 0.85rem; margin-top: 1rem; }
</style>`;
}

function clientScript(): string {
  const paths = authPathsJson();
  return `<script type="module">
const PATHS = ${paths};
const msg = document.getElementById("msg");
function show(text, isErr) {
  msg.textContent = text;
  msg.style.color = isErr ? "var(--err)" : "var(--ok)";
}
async function postAuth(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return { ok: res.ok, data };
}
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const { ok, data } = await postAuth(PATHS.signup, { email, password });
  show(ok ? "Signed up." : (data.error ?? "Request failed"), !ok);
});
document.getElementById("signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const { ok, data } = await postAuth(PATHS.signin, { email, password });
  show(ok ? "Signed in." : (data.error ?? "Request failed"), !ok);
});
document.getElementById("signout-btn").addEventListener("click", async () => {
  const res = await fetch(PATHS.signout, { method: "POST", credentials: "same-origin" });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  show(res.ok ? "Signed out." : (data.error ?? "Request failed"), !res.ok);
});
</script>`;
}

function bodyMarkup(): string {
  return `<main>
<h1>${AUTH_PAGE_HEADING}</h1>
<section aria-labelledby="signup-h">
  <h2 id="signup-h">Sign up</h2>
  <form id="signup-form">
    <label for="su-email">Email</label>
    <input id="su-email" name="email" type="email" autocomplete="email" required />
    <label for="su-password">Password</label>
    <input id="su-password" name="password" type="password" autocomplete="new-password" required />
    <button type="submit">Create account</button>
  </form>
</section>
<section aria-labelledby="signin-h">
  <h2 id="signin-h">Sign in</h2>
  <form id="signin-form">
    <label for="si-email">Email</label>
    <input id="si-email" name="email" type="email" autocomplete="email" required />
    <label for="si-password">Password</label>
    <input id="si-password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Sign in</button>
  </form>
</section>
<section aria-labelledby="signout-h">
  <h2 id="signout-h">Sign out</h2>
  <p style="margin:0 0 0.75rem;font-size:0.85rem;color:var(--muted);">Ends your session cookie.</p>
  <button type="button" class="secondary" id="signout-btn">Sign out</button>
</section>
<div id="msg" role="status" aria-live="polite"></div>
</main>`;
}

export function buildAuthPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${AUTH_PAGE_TITLE}</title>
${stylesBlock()}
</head>
<body>
${bodyMarkup()}
${clientScript()}
</body>
</html>`;
}
