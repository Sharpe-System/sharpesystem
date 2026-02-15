// /header-loader.js
(async function () {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  try {
    const res = await fetch("/partials/header.html", { cache: "no-store" });
    if (!res.ok) throw new Error("header fetch failed: " + res.status);
    const html = await res.text();
    mount.innerHTML = html;

    // after injection, initialize header controls
    queueMicrotask(() => {
      window.initHeaderControls?.(); // theme in /header.js
      window.initHeaderAuth?.();     // account links in /header-auth.js
      window.initI18n?.();           // if your i18n exposes init
    });
  } catch (e) {
    console.error("Header load failed:", e);
  }
})();
