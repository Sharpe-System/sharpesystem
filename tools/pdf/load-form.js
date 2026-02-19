/* tools/pdf/load-form.js
   Jurisdiction form resolver.
   Loads correct PDF path from forms.registry.json
*/

const fs = require("fs");
const path = require("path");

const REG_PATH = path.resolve(process.cwd(), "assets/forms/forms.registry.json");

function loadRegistry() {
  if (!fs.existsSync(REG_PATH)) {
    throw new Error("forms.registry.json not found at assets/forms/");
  }
  return JSON.parse(fs.readFileSync(REG_PATH, "utf8"));
}

function resolveForm({ state, county, formId }) {
  const reg = loadRegistry();

  if (!reg[state]) throw new Error(`State not found: ${state}`);

  // base statewide
  if (reg[state].baseForms && reg[state].baseForms[formId]) {
    return path.resolve(process.cwd(), reg[state].baseForms[formId].path);
  }

  // county local
  if (
    county &&
    reg[state].counties &&
    reg[state].counties[county] &&
    reg[state].counties[county].localForms &&
    reg[state].counties[county].localForms[formId]
  ) {
    return path.resolve(
      process.cwd(),
      reg[state].counties[county].localForms[formId].path
    );
  }

  throw new Error(`Form not found: ${state} ${county || ""} ${formId}`);
}

module.exports = { resolveForm };
