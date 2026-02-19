/* /rfo/rfo-public-exhibits.js
   Public exhibit organizer (localStorage only; metadata only).
   Canon (public):
   - NO gate.js usage
   - NO Firebase imports
   - NO redirects for auth/tier
*/

(function () {
  "use strict";

  const KEY_EXHIBITS = "ss_rfo_public_exhibits_v1";

  function $(id) { return document.getElementById(id); }
  function safeStr(v) { return String(v ?? "").trim(); }
  function nowISO() { try { return new Date().toISOString(); } catch (_) { return ""; } }

  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "20px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,.85)";
    el.style.color = "#fff";
    el.style.fontSize = "14px";
    el.style.zIndex = "9999";
    el.style.maxWidth = "90vw";
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 1200);
  }

  function load() {
    const raw = localStorage.getItem(KEY_EXHIBITS);
    if (!raw) return { version: 1, updatedAt: "", items: [] };
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") throw new Error("bad");
      obj.items = Array.isArray(obj.items) ? obj.items : [];
      return obj;
    } catch (_) {
      return { version: 1, updatedAt: "", items: [] };
    }
  }

  function save(state) {
    state.updatedAt = nowISO();
    try {
      localStorage.setItem(KEY_EXHIBITS, JSON.stringify(state));
      return true;
    } catch (_) {
      alert("Unable to save. Your browser may be blocking storage or is full.");
      return false;
    }
  }

  function alphaLabel(idx) {
    // 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA, etc.
    let n = idx;
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  function computeLabel(item, exhibitIndex) {
    if (item.kind === "divider") return item.title || "Section";
    const override = safeStr(item.labelOverride);
    if (override) return override;
    return "Exhibit " + alphaLabel(exhibitIndex);
  }

  function render(state) {
    const root = $("exList");
    if (!root) return;
    root.innerHTML = "";

    let exhibitCount = 0;

    state.items.forEach((item, idx) => {
      const isDivider = item.kind === "divider";

      const label = isDivider ? (item.title || "Section Divider") : computeLabel(item, exhibitCount);

      if (!isDivider) exhibitCount += 1;

      const card = document.createElement("div");
      card.className = "card";
      card.style.padding = "12px";
      card.style.marginBottom = "10px";

      const top = document.createElement("div");
      top.className = "row";
      top.style.justifyContent = "space-between";
      top.style.alignItems = "flex-start";
      top.style.gap = "12px";
      top.style.flexWrap = "wrap";

      const left = document.createElement("div");
      const h = document.createElement(isDivider ? "h3" : "h4");
      h.style.margin = "0 0 6px 0";
      h.textContent = label + (isDivider ? "" : (item.title ? " — " + item.title : ""));

      const meta = document.createElement("div");
      meta.className = "muted";
      meta.style.fontSize = "14px";

      if (isDivider) {
        meta.textContent = "Divider (use to group exhibits).";
      } else {
        const bits = [];
        if (item.type) bits.push("Type: " + item.type);
        if (item.dateRange) bits.push("Dates: " + item.dateRange);
        if (item.pages) bits.push("Pages: " + item.pages);
        meta.textContent = bits.join(" • ");
      }

      left.appendChild(h);
      left.appendChild(meta);

      if (!isDivider && item.relevance) {
        const rel = document.createElement("div");
        rel.style.marginTop = "8px";
        rel.textContent = "Relevance: " + item.relevance;
        left.appendChild(rel);
      }

      const right = document.createElement("div");
      right.className = "row";
      right.style.gap = "8px";
      right.style.flexWrap = "wrap";

      const btnUp = document.createElement("button");
      btnUp.className = "btn";
      btnUp.type = "button";
      btnUp.textContent = "Move ↑";
      btnUp.addEventListener("click", () => move(state, idx, -1));

      const btnDown = document.createElement("button");
      btnDown.className = "btn";
      btnDown.type = "button";
      btnDown.textContent = "Move ↓";
      btnDown.addEventListener("click", () => move(state, idx, +1));

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn";
      btnEdit.type = "button";
      btnEdit.textContent = "Edit";
      btnEdit.addEventListener("click", () => edit(state, idx));

      const btnDel = document.createElement("button");
      btnDel.className = "btn";
      btnDel.type = "button";
      btnDel.textContent = "Delete";
      btnDel.addEventListener("click", () => remove(state, idx));

      right.appendChild(btnUp);
      right.appendChild(btnDown);
      right.appendChild(btnEdit);
      right.appendChild(btnDel);

      top.appendChild(left);
      top.appendChild(right);
      card.appendChild(top);

      root.appendChild(card);
    });

    if (state.items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No exhibits yet. Add one above.";
      root.appendChild(empty);
    }
  }

  function move(state, idx, delta) {
    const j = idx + delta;
    if (j < 0 || j >= state.items.length) return;
    const tmp = state.items[idx];
    state.items[idx] = state.items[j];
    state.items[j] = tmp;
    save(state);
    render(state);
  }

  function remove(state, idx) {
    const item = state.items[idx];
    const ok = confirm("Delete this item?\n\n" + (item?.title || item?.type || "Item"));
    if (!ok) return;
    state.items
