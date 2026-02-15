// /header-loader.js
(async function () {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  try {
    const res = await fetch("/partials/header.html", { cache: "no-store" });
    const html = await res.text();
    mount.innerHTML = html;

    // Give the DOM a beat to register injected nodes
    queueMicrotask(() => {
      window.initHeaderControls?.(); // from /header.js (theme)
      window.initHeaderAuth?.();     // from /header-auth.js (login/dashboard/logout)
      window.initI18n?.();           // if your i18n exposes this
    });
  } catch (e) {
    console.error("Header load failed:", e);
  }
})();
