// /dashboard.js
import { auth, ensureUserDoc, requireLogin } from "/gate.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function $(id){ return document.getElementById(id); }
function set(el, t){ if (el) el.textContent = t || ""; }
function setHtml(el, h){ if (el) el.innerHTML = h || ""; }

const who = $("who");
const tier = $("tier");
const links = $("links");
const msg = $("msg");

function linkRow(items) {
  return items.map(([href, label]) => `<a class="button" href="${href}">${label}</a>`).join(" ");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return requireLogin("/dashboard.html");

  try {
    set(who, user.email || "(no email)");

    const u = await ensureUserDoc(user.uid);
    const active = u?.active === true;
    const t = String(u?.tier || "");

    set(tier, active ? (t || "(none)") : "inactive");

    // Links are deterministic:
    const common = [
      ["/home.html", "Home"],
      ["/status.html", "Status"],
      ["/trees.html", "Decision Trees"],
    ];

    const appLinks = [
      ["/start.html", "Start"],
      ["/intake.html", "Intake"],
      ["/snapshot.html", "Snapshot"],
      ["/timeline.html", "Timeline"],
      ["/checklist.html", "Checklist"],
    ];

    if (active && t === "tier1") {
      setHtml(links, linkRow(appLinks) + `<div class="hr"></div>` + linkRow(common));
      set(msg, "Tier 1 active.");
      return;
    }

    // Not tier1: show subscribe path
    setHtml(links, linkRow([
      ["/tier1.html", "Tier 1"],
      ["/subscribe.html", "Subscribe"],
      ...common
    ]));
    set(msg, "Tier 1 not active yet.");
  } catch (e) {
    console.log(e);
    set(msg, "Dashboard error. Check console.");
  }
});
