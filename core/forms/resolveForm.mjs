/**
 * SharpeSystem Form Registry Resolver (Worker-safe)
 * Canon: declarative only, no filesystem, no Node modules
 */

const REGISTRY = {
  fl300: {
    id: "fl300",
    displayName: "Request for Order (FL-300)",
    version: 1,
    templateSrcUrl: "/templates/jcc/fl300/src.pdf",
    templateTplUrl: "/templates/jcc/fl300/tpl.pdf",
    fieldsUrl: "/templates/jcc/fl300/fields.json",
    rendererEndpoint: "/api/render/fl300",
    staged: false
  },
  fl150: {
    id: "fl150",
    displayName: "Income and Expense Declaration (FL-150)",
    version: 1,
    templateSrcUrl: "/templates/jcc/fl150/src.pdf",
    templateTplUrl: "/templates/jcc/fl150/tpl.pdf",
    staged: true
  },
  dv100: {
    id: "dv100",
    displayName: "Request for Domestic Violence Restraining Order (DV-100)",
    version: 1,
    templateSrcUrl: "/templates/jcc/dv100/src.pdf",
    templateTplUrl: "/templates/jcc/dv100/tpl.pdf",
    staged: true
  }
};

export function resolveForm(id) {
  return REGISTRY[id] || null;
}

export function listForms() {
  return Object.values(REGISTRY).map(f => ({
    id: f.id,
    displayName: f.displayName,
    version: f.version,
    staged: !!f.staged
  }));
}
