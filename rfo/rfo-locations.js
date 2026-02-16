/* /rfo/rfo-locations.js
   State/County/Courthouse dropdown support with safe fallbacks.
*/

(function () {
  "use strict";

  const DATA_URL = "/data/us-courts.min.json";
  let _cache = null;
  let _loading = null;

  const STATES = [
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
    ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],
    ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],
    ["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
    ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
    ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],
    ["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
    ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
    ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
  ];

  function safeArray(x) { return Array.isArray(x) ? x : []; }
  function safeObj(x) { return (x && typeof x === "object") ? x : {}; }

  async function load() {
    if (_cache) return _cache;
    if (_loading) return _loading;

    _loading = (async () => {
      try {
        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("Locations dataset missing");
        const json = await res.json();
        _cache = safeObj(json);
        return _cache;
      } catch (e) {
        _cache = { version: "0.0", states: {} };
        return _cache;
      } finally {
        _loading = null;
      }
    })();

    return _loading;
  }

  function getStateOptions() {
    return STATES.map(([code, name]) => ({ code, name }));
  }

  function getCountyOptions(data, stateCode) {
    const states = safeObj(data.states);
    const st = safeObj(states[stateCode]);
    const counties = safeObj(st.counties);
    return Object.keys(counties).sort((a, b) => a.localeCompare(b));
  }

  function getCourthouseOptions(data, stateCode, countyName) {
    const states = safeObj(data.states);
    const st = safeObj(states[stateCode]);
    const counties = safeObj(st.counties);
    const c = safeObj(counties[countyName]);
    return safeArray(c.courthouses);
  }

  window.RFO_LOCATIONS = {
    load,
    getStateOptions,
    getCountyOptions,
    getCourthouseOptions
  };
})();
