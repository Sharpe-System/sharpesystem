import { authSignIn } from "/firebase-config.js";

function qs(name) {
  return (new URLSearchParams(location.search).get(name) || "").trim();
}

function setUser(u) {
  try {
    const payload = {
      uid: u?.uid || "",
      email: u?.email || "",
      ts: Date.now()
    };
    localStorage.setItem("ss:user", JSON.stringify(payload));
  } catch (e) {}
}

function goNext() {
  const next = qs("next");
  if (next) location.replace(next);
  else location.replace("/index.html");
}

function getEl(sel) {
  return document.querySelector(sel);
}

function val(sel) {
  const el = getEl(sel);
  return el ? String(el.value || "").trim() : "";
}

async function onSubmit(e) {
  e.preventDefault();

  const email = val('input[type="email"]');
  const password = val('input[type="password"]');

  if (!email || !password) {
    alert("Enter email and password.");
    return;
  }

  const btn = getEl('button[type="submit"], button');
  if (btn) btn.disabled = true;

  try {
    const cred = await authSignIn(email, password);
    const user = cred?.user || cred || null;

    // Force ss:user so print gating is consistent
    if (user) setUser(user);

    // Deterministic redirect
    goNext();
  } catch (err) {
    alert(err?.message || "Login failed.");
    if (btn) btn.disabled = false;
  }
}

(function init() {
  // If already logged, honor next immediately
  try {
    if (localStorage.getItem("ss:user")) {
      goNext();
      return;
    }
  } catch (e) {}

  const form = document.querySelector("form");
  if (form) form.addEventListener("submit", onSubmit);

  // If there's no form (edge), bind first button
  const btn = getEl('button[type="submit"], button');
  if (btn && !form) btn.addEventListener("click", onSubmit);
})();
