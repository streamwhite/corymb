import {
  AUTH_PASSKEY_DELETE_PASSKEY_PATH,
  AUTH_PASSKEY_GENERATE_AUTHENTICATE_OPTIONS_PATH,
  AUTH_PASSKEY_GENERATE_REGISTER_OPTIONS_PATH,
  AUTH_PASSKEY_LIST_USER_PASSKEYS_PATH,
  AUTH_PASSKEY_VERIFY_AUTHENTICATION_PATH,
  AUTH_PASSKEY_VERIFY_REGISTRATION_PATH,
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
    passkeyAuthenticateOptions: AUTH_PASSKEY_GENERATE_AUTHENTICATE_OPTIONS_PATH,
    passkeyVerifyAuthentication: AUTH_PASSKEY_VERIFY_AUTHENTICATION_PATH,
    passkeyRegisterOptions: AUTH_PASSKEY_GENERATE_REGISTER_OPTIONS_PATH,
    passkeyVerifyRegistration: AUTH_PASSKEY_VERIFY_REGISTRATION_PATH,
    passkeyList: AUTH_PASSKEY_LIST_USER_PASSKEYS_PATH,
    passkeyDelete: AUTH_PASSKEY_DELETE_PASSKEY_PATH,
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
#passkey-list { padding: 0; margin: 0.5rem 0; list-style: none; }
#passkey-list li {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.35rem 0; border-bottom: 1px solid #2d3d52; font-size: 0.85rem;
}
#passkey-list li:last-child { border-bottom: none; }
#passkey-list .delete-passkey { padding: 0.2rem 0.5rem; font-size: 0.75rem; background: var(--err); color: #fff; }
</style>`;
}

function clientScript(): string {
  const paths = authPathsJson();
  return `<script type="module">
const PATHS = ${paths};
const msg = document.getElementById("msg");
const sessionSection = document.getElementById("session-section");
const passkeySection = document.getElementById("passkey-section");
const addPasskeyBtn = document.getElementById("add-passkey-btn");
const passkeyListEl = document.getElementById("passkey-list");
function show(text, isErr) {
  msg.textContent = text;
  msg.style.color = isErr ? "var(--err)" : "var(--ok)";
}
function setSignedIn(signedIn) {
  if (signedIn) {
    sessionSection.removeAttribute("hidden");
    if (passkeySection) passkeySection.removeAttribute("hidden");
    if (addPasskeyBtn) addPasskeyBtn.style.display = "";
  } else {
    sessionSection.setAttribute("hidden", "");
    if (passkeySection) passkeySection.setAttribute("hidden", "");
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

// WebAuthn helpers
function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function credentialToJson(cred) {
  const plain = { id: cred.id, rawId: bytesToB64url(new Uint8Array(cred.rawId)), type: cred.type, response: {}, clientExtensionResults: cred.getClientExtensionResults?.() ?? {}, authenticatorAttachment: cred.authenticatorAttachment ?? undefined };
  for (const [k, v] of Object.entries(cred.response)) {
    if (v instanceof ArrayBuffer) plain.response[k] = bytesToB64url(new Uint8Array(v));
    else if (ArrayBuffer.isView(v)) plain.response[k] = bytesToB64url(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    else if (k === "transports") plain.response[k] = v;
  }
  return plain;
}
function bytesToB64url(bytes) {
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}
function decodeWebAuthnOptions(options) {
  const copy = JSON.parse(JSON.stringify(options));
  copy.challenge = b64urlToBytes(copy.challenge);
  if (copy.user?.id) copy.user.id = b64urlToBytes(copy.user.id);
  if (Array.isArray(copy.allowCredentials)) {
    copy.allowCredentials = copy.allowCredentials.map(c => ({ ...c, id: b64urlToBytes(c.id) }));
  }
  if (Array.isArray(copy.excludeCredentials)) {
    copy.excludeCredentials = copy.excludeCredentials.map(c => ({ ...c, id: b64urlToBytes(c.id) }));
  }
  return copy;
}

async function refreshSessionUi() {
  try {
    const res = await fetch(PATHS.session, { credentials: "include" });
    if (!res.ok) { setSignedIn(false); return; }
    const data = await res.json();
    const signedIn = data !== null && data.session !== undefined;
    setSignedIn(signedIn);
    if (signedIn) void loadPasskeys();
  } catch (_) { setSignedIn(false); }
}

async function loadPasskeys() {
  try {
    const res = await fetch(PATHS.passkeyList, { credentials: "include" });
    const list = res.ok ? (await res.json()) : [];
    if (passkeyListEl) {
      passkeyListEl.innerHTML = list.map(p =>
        \`<li>\${esc(p.name ?? "Passkey")} <button data-id="\${esc(p.id)}" class="delete-passkey">Delete</button></li>\`
      ).join("");
      passkeyListEl.querySelectorAll(".delete-passkey").forEach(btn =>
        btn.addEventListener("click", async () => {
          await postJson(PATHS.passkeyDelete, { id: btn.dataset.id });
          await loadPasskeys();
        })
      );
    }
  } catch (_) {}
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function passkeySignIn() {
  try {
    const optsRes = await fetch(PATHS.passkeyAuthenticateOptions, { credentials: "include" });
    if (!optsRes.ok) { show("Failed to get passkey options.", true); return; }
    const options = decodeWebAuthnOptions(await optsRes.json());
    const assertion = await navigator.credentials.get({ publicKey: options });
    const { ok, data } = await postJson(PATHS.passkeyVerifyAuthentication, { response: credentialToJson(assertion) });
    if (ok) setSignedIn(true);
    show(ok ? "Signed in with passkey." : (data.message ?? data.error ?? "Passkey sign-in failed"), !ok);
  } catch (err) { show(err.message ?? "Passkey sign-in cancelled or failed.", true); }
}

async function addPasskey() {
  try {
    const optsRes = await fetch(PATHS.passkeyRegisterOptions, { credentials: "include" });
    if (optsRes.status === 403) { show("Session too old: re-authenticate to add a passkey.", true); return; }
    if (!optsRes.ok) { show("Failed to get registration options.", true); return; }
    const options = decodeWebAuthnOptions(await optsRes.json());
    const credential = await navigator.credentials.create({ publicKey: options });
    const { ok, data } = await postJson(PATHS.passkeyVerifyRegistration, { response: credentialToJson(credential), name: "My passkey" });
    if (ok) { await loadPasskeys(); show("Passkey added.", false); }
    else show(data.message ?? data.error ?? "Add passkey failed", true);
  } catch (err) { show(err.message ?? "Add passkey cancelled.", true); }
}

document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") ?? "").trim();
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const { ok, data } = await postJson(PATHS.signup, { email, password, name: username, username });
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
document.getElementById("passkey-signin-btn")?.addEventListener("click", passkeySignIn);
document.getElementById("add-passkey-btn")?.addEventListener("click", addPasskey);
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
  <button type="button" class="secondary" id="passkey-signin-btn" style="margin-top:0.5rem;width:100%;">Sign in with passkey</button>
</section>
<section id="session-section" aria-labelledby="session-h" hidden>
  <h2 id="session-h">Session</h2>
  <p style="margin:0 0 0.75rem;font-size:0.85rem;color:var(--muted);">Auth uses a random opaque session token stored server-side (DB + Redis), not a JWT. HttpOnly cookies hold the token. Rotate replaces it; revoke invalidates immediately.</p>
  <button type="button" class="secondary" id="rotate-btn">Rotate session</button>
  <button type="button" class="secondary" id="signout-btn">Sign out</button>
</section>
<section id="passkey-section" aria-labelledby="passkey-h" hidden>
  <h2 id="passkey-h">Passkeys</h2>
  <ul id="passkey-list"></ul>
  <button type="button" id="add-passkey-btn" style="width:100%;">Add passkey</button>
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