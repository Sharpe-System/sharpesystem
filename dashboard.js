// /dashboard.js
import { auth, ensureUserDoc, requireLogin } from "/gate.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function $(id){ return document.getElementById(id); }
function setText(id, t){ const el = $(id); if (el) el.textContent = t || ""; }
function setHtml(id, h){ const el = $(id); if (el) el.innerHTML = h || ""; }

function linkRow(items){
  return items.map(([href, label]) => `<a class="button" href="${href}">${label}</a>`).join(" ");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return requireLogin("/dashboard.html");

  try {
    setText("who", user.email || "(no email)");

    const u = await ensureUserDoc(user.uid);
    const active = u?.active === true;
    const tier = String(u?.tier || "");

    setText("tier", active ? (tier || "(none)") : "inactive");

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

    if (active && tier === "tier1") {
      setHtml("links", linkRow(appLinks) + `<div class="hr"></div>` + linkRow(common));
      setText("msg", "Tier 1 active.");
      return;
    }

    setHtml("links", linkRow([
      ["/tier1.html", "Tier 1"],
      ["/subscribe.html", "Subscribe"],
      ...common
    ]));
    setText("msg", "Tier 1 not active yet.");
  } catch (e) {
    console.log(e);
    setText("msg", "Dashboard error. Check console.");
  }
});
