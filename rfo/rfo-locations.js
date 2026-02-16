// /rfo/rfo-locations.js
// Static loader for state → county → courthouse dataset
// Loads /data/locations.json (no auth, no firebase)

(function () {
  "use strict";

  let _cache = null;

  async function load() {
    if (_cache) return _cache;

    const res = await fetch("/data/locations.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load /data/locations.json: " + res.status);

    const data = await res.json();
    _cache = data;
    return data;
  }

  function getStateOptions() {
    // minimal now: only CA
    return [
      { code: "CA", name: "California" }
    ];
  }

  function getCountyOptions(data, stateCode) {
    const st = data?.states?.[stateCode];
    if (!st?.counties) return [];
    return Object.keys(st.counties).sort((a, b) => a.localeCompare(b));
  }

  function getCourthouseOptions(data, stateCode, countyName) {
    const st = data?.states?.[stateCode];
    const county = st?.counties?.[countyName];
    const arr = county?.courthouses;
    return Array.isArray(arr) ? arr : [];
  }

  window.RFO_LOCATIONS = {
    load,
    getStateOptions,
    getCountyOptions,
    getCourthouseOptions
  };
})();
