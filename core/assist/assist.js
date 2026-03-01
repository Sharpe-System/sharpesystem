/* core/assist/assist.js — Field Assist v1 (deterministic, field-bound) */
export function mountAssist(root, ctx = {}) {
  if (!root || root.__ssAssistMounted) return;
  root.__ssAssistMounted = true;

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function callAssist(mode, field) {
    const payload = {
      mode,
      field,
      flow: ctx.flow || "",
      stage: ctx.stage || "",
      jurisdiction: ctx.jurisdiction || "",
      answers: typeof ctx.getAnswers === "function" ? (ctx.getAnswers() || {}) : {}
    };

    const res = await fetch("/api/assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const txt = await res.text();
    let json = {};
    try { json = txt ? JSON.parse(txt) : {}; } catch { json = { error: txt || "Invalid JSON" }; }

    if (!res.ok) return { error: json.error || `Assist error (${res.status})` };
    return json;
  }

  function ensurePanel(btn) {
    const field = btn.getAttribute("data-field") || "field";
    const id = `ss_assist_${field}`;
    let panel = root.querySelector(`#${id}`);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = id;
    panel.className = "ss-card";
    panel.style.marginTop = "10px";
    panel.innerHTML = `
      <div class="muted" style="margin-bottom:6px;"><strong>Assist</strong></div>
      <div class="ss-assist-body muted">Loading…</div>
    `;

    const wrap = btn.closest(".field");
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(panel, wrap.nextSibling);
    else root.appendChild(panel);

    return panel;
  }

  function render(panel, data) {
    const body = panel.querySelector(".ss-assist-body");
    if (!body) return;

    if (data?.error) {
      body.innerHTML = `<span class="muted">${esc(data.error)}</span>`;
      return;
    }

    const parts = [];
    if (data?.explanation) parts.push(`<div style="margin-bottom:8px;">${esc(data.explanation)}</div>`);

    if (Array.isArray(data?.options) && data.options.length) {
      parts.push(`<div style="margin-bottom:8px;"><strong>Common options</strong></div>`);
      parts.push(`<ul style="margin:0 0 10px 18px;">${data.options.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`);
    }

    if (Array.isArray(data?.drafts) && data.drafts.length) {
      parts.push(`<div style="margin-bottom:8px;"><strong>Draft language</strong></div>`);
      parts.push(data.drafts.map(t => `
        <div class="ss-card" style="margin-top:8px;">
          <div style="white-space:pre-wrap;">${esc(t)}</div>
        </div>
      `).join(""));
    }

    body.innerHTML = parts.length ? parts.join("") : `<div class="muted">No assist content returned.</div>`;
  }

  root.addEventListener("click", async (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("[data-ai][data-field]") : null;
    if (!btn) return;

    const mode = (btn.getAttribute("data-ai") || "").trim();
    const field = (btn.getAttribute("data-field") || "").trim();
    if (!mode || !field) return;

    e.preventDefault();

    const panel = ensurePanel(btn);
    const body = panel.querySelector(".ss-assist-body");
    if (body) body.textContent = "Loading…";

    try {
      const data = await callAssist(mode, field);
      render(panel, data);
    } catch (err) {
      render(panel, { error: String(err?.message || err) });
    }
  }, { passive: false });
}
