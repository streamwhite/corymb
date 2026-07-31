import {
  AUTH_SESSION_ROTATE_PATH,
  BETTER_AUTH_BASE_PATH,
} from "@/constants/better-auth.js";
import { AUTH_PAGE_HEADING, AUTH_PAGE_TITLE } from "@/constants/ui.js";

const SIGN_UP_PATH = `${BETTER_AUTH_BASE_PATH}/sign-up/email` as const;
const SIGN_IN_PATH = `${BETTER_AUTH_BASE_PATH}/sign-in/email` as const;
const SIGN_OUT_PATH = `${BETTER_AUTH_BASE_PATH}/sign-out` as const;
const GET_SESSION_PATH = `${BETTER_AUTH_BASE_PATH}/get-session` as const;

function authPathsJson(): string {
  return JSON.stringify({
    signup: SIGN_UP_PATH,
    signin: SIGN_IN_PATH,
    signout: SIGN_OUT_PATH,
    rotate: AUTH_SESSION_ROTATE_PATH,
    session: GET_SESSION_PATH,
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
section[hidden] { display: none; }
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
const sessionSection = document.getElementById("session-section");
function show(text, isErr) {
  msg.textContent = text;
  msg.style.color = isErr ? "var(--err)" : "var(--ok)";
}
function setSignedIn(signedIn) {
  if (signedIn) {
    sessionSection.removeAttribute("hidden");
  } else {
    sessionSection.setAttribute("hidden", "");
  }
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, data };
}
async function refreshSessionUi() {
  try {
    const res = await fetch(PATHS.session, { credentials: "include" });
    if (!res.ok) {
      setSignedIn(false);
      return;
    }
    const data = await res.json();
    setSignedIn(data !== null && data.session !== undefined);
  } catch (_) {
    setSignedIn(false);
  }
}
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") ?? "").trim();
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const { ok, data } = await postJson(PATHS.signup, {
    email,
    password,
    name: username,
    username,
  });
  if (ok) setSignedIn(true);
  show(ok ? "Signed up (session cookie set)." : (data.message ?? data.error ?? "Request failed"), !ok);
});
document.getElementById("signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const { ok, data } = await postJson(PATHS.signin, { email, password });
  if (ok) setSignedIn(true);
  show(ok ? "Signed in (session cookie set)." : (data.message ?? data.error ?? "Request failed"), !ok);
});
document.getElementById("signout-btn").addEventListener("click", async () => {
  const { ok, data } = await postJson(PATHS.signout, {});
  if (ok) setSignedIn(false);
  show(ok ? "Signed out." : (data.message ?? data.error ?? "Request failed"), !ok);
});
document.getElementById("rotate-btn").addEventListener("click", async () => {
  const { ok, data } = await postJson(PATHS.rotate, {});
  show(ok ? "Session rotated." : (data.message ?? data.error ?? "Request failed"), !ok);
});
void refreshSessionUi();
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
    <label for="su-username">Username</label>
    <input id="su-username" name="username" type="text" autocomplete="username" required />
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
<section id="session-section" aria-labelledby="session-h" hidden>
  <h2 id="session-h">Session</h2>
  <p style="margin:0 0 0.75rem;font-size:0.85rem;color:var(--muted);">Auth uses a random opaque session token stored server-side (DB + Redis), not a JWT. HttpOnly cookies hold the token. Rotate replaces it; revoke invalidates immediately.</p>
  <button type="button" class="secondary" id="rotate-btn">Rotate session</button>
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
