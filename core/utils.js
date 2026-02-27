export function $(sel, el = document) {
  return el.querySelector(sel);
}

export function $all(sel, el = document) {
  return [...el.querySelectorAll(sel)];
}

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
