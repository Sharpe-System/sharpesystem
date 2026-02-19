/* /rfo/rfo-exparte-public-print.js
   Ex Parte Public Print Gate
   Deterministic readiness from ex parte keys + pleading attachment when required
*/

(function () {
  "use strict";

  const KEYS = {
    intake: "ss_rfo_exparte_intake_v1",
    fl300: "ss_rfo_exparte_fl300_v1",
    fl305: "ss_rfo_exparte_fl305_v1",
    notice: "ss_rfo_exparte_notice_v1",
    decl: "ss_rfo_exparte_decl_v1",
    prop: "ss_rfo_exparte_proposed_v1",
    plead: "ss_pleading_paper_v1"
  };

  function $(id) { return document.getElementById(id); }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } }
  function ok(v) { return v && Object.keys(v).length > 0; }

  function noticeComplete(n) {
    if (!n) return false;
    if (n.noticeGiven === "yes" || n.noticeGiven === "attempted") return !!(n.noticeMethod || n.noticeWhen);
    if (n.noticeGiven === "no") return !!n.noticeWhyNot;
    return false;
  }

  function set(id, val) {
    $(id).textContent = val ? "Ready" : "Missing";
    $(id).style.color = val ? "#0a0" : "#a00";
  }

  function buildPreview(d) {
    if (!d) return "";
    const lines = [];
    lines.push("EX PARTE PACKET SUMMARY", "");
    if (d.fl300?.ordersRequested) lines.push("FL-300:", d.fl300.ordersRequested, "");
    if (d.fl305?.orders) lines.push("FL-305:", d.fl305.orders, "");
    if (d.decl?.mc030Text) lines.push("MC-030 TEXT:", d.decl.mc030Text, "");
    if (d.prop?.orders) lines.push("PROPOSED ORDER:", d.prop.orders, "");
    return lines.join("\n").trim();
  }

  function init() {
    const d = {
      intake: load(KEYS.intake),
      fl300: load(KEYS.fl300),
      fl305: load(KEYS.fl305),
      notice: load(KEYS.notice),
      decl: load(KEYS.decl),
      prop: load(KEYS.prop),
      plead: load(KEYS.plead)
    };

    const declReady = ok(d.decl);
    const declOverflowTriggered = !!d.decl?.overflow?.triggered;
    const pleadingRequired = declOverflowTriggered;
    const pleadingReady = pleadingRequired ? ok(d.plead) : true; // only required if overflow triggered

    const st = {
      intake: ok(d.intake),
      fl300: ok(d.fl300),
      fl305: ok(d.fl305),
      notice: noticeComplete(d.notice),
      decl: declReady,
      prop: ok(d.prop),
      plead: pleadingReady
    };

    set("st_intake", st.intake);
    set("st_fl300", st.fl300);
    set("st_fl305", st.fl305);
    set("st_notice", st.notice);
    set("st_decl", st.decl);
    set("st_prop", st.prop);
    set("st_plead", st.plead);

    const all = Object.values(st).every(Boolean);

    $("overall").textContent = all
      ? "Packet complete. Ready for filing workflow."
      : (pleadingRequired && !pleadingReady)
        ? "Packet incomplete. Pleading paper attachment is required (overflow triggered) but missing."
        : "Packet incomplete. Complete missing sections.";

    $("preview").value = buildPreview(d);

    $("copy").onclick = () => {
      navigator.clipboard.writeText($("preview").value);
    };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
