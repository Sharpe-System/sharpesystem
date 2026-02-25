const REQUIRED_KV_BINDING = "JOBS_KV";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function cleanStr(s) {
  return String(s ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function requireKv(env) {
  const kv = env && env[REQUIRED_KV_BINDING];
  if (!kv) return null;
  if (typeof kv.get !== "function" || typeof kv.put !== "function") return null;
  return kv;
}

async function sha256Bytes(input) {
  const buf = input instanceof ArrayBuffer ? input : new Uint8Array(input).buffer;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function toBase64(u8) {
  try {
    // nodejs_compat path
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64");
  } catch {}
  // portable fallback
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  // eslint-disable-next-line no-undef
  return btoa(s);
}

const CONTRACTS = [
  {
    flow: "pleading",
    form: "pleading28",
    requiredKey: "pleading",
    rendererPath: "/api/render/pleading",
    templatePath: "/templates/pleading/blank.pdf",
    rendererId: "render/pleading@v1",
    filename: "pleading-paper.pdf"
  },
  {
    flow: "rfo",
    form: "rfo28",
    requiredKey: "rfo",
    rendererPath: "/api/render/fl300",
    templatePath: "/templates/fl300/blank.pdf",
    rendererId: "render/fl300@v1",
    filename: "fl300.pdf"
  }
];

function pickContract(flow, form, draft) {
  const f = cleanStr(flow).trim();
  const m = cleanStr(form).trim();

  if (f && m) {
    return CONTRACTS.find((c) => c.flow === f && c.form === m) || null;
  }

  if (isPlainObject(draft?.pleading)) {
    return CONTRACTS.find((c) => c.flow === "pleading" && c.form === "pleading28") || null;
  }

  if (isPlainObject(draft?.rfo)) {
    return CONTRACTS.find((c) => c.flow === "rfo" && c.form === "rfo28") || null;
  }

  return null;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed. Use POST.", route: "/api/jobs/create" });
  }

  const kv = requireKv(env);
  if (!kv) {
    return json(500, { ok: false, error: "Missing KV binding.", binding: REQUIRED_KV_BINDING, route: "/api/jobs/create" });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { ok: false, error: "Invalid JSON body.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  const flow = body?.flow;
  const form = body?.form;

  // Accept either {draft:{...}} or the legacy shape directly (rare), but normalize to {draft:{...}}
  const draft = isPlainObject(body?.draft) ? body.draft : (isPlainObject(body) && (body.rfo || body.pleading) ? body : null);
  if (!isPlainObject(draft)) {
    return json(400, { ok: false, error: "Missing draft.", expected: "{ flow, form, draft: { ... } }", route: "/api/jobs/create" });
  }

  const contract = pickContract(flow, form, draft);
  if (!contract) {
    return json(400, {
      ok: false,
      error: "Unsupported flow/form.",
      got: { flow: cleanStr(flow).trim(), form: cleanStr(form).trim(), draftKeys: Object.keys(draft || {}) },
      supported: CONTRACTS.map((c) => ({ flow: c.flow, form: c.form })),
      route: "/api/jobs/create"
    });
  }

  if (!isPlainObject(draft[contract.requiredKey])) {
    return json(400, {
      ok: false,
      error: "Invalid draft payload.",
      expected: contract.requiredKey === "rfo"
        ? "{ draft: { rfo: {...} } }"
        : "{ draft: { pleading: {...} } }",
      route: "/api/jobs/create"
    });
  }

  let renderPayload;
  try {
    renderPayload = JSON.parse(JSON.stringify(draft));
  } catch {
    return json(400, { ok: false, error: "Draft not serializable.", route: "/api/jobs/create" });
  }

  const origin = new URL(request.url).origin;

  // templateId = sha256(template bytes)
  let templateId = "";
  try {
    const tplRes = await fetch(origin + contract.templatePath);
    if (!tplRes.ok) {
      return json(500, {
        ok: false,
        error: "Template fetch failed.",
        status: tplRes.status,
        path: contract.templatePath,
        route: "/api/jobs/create"
      });
    }
    const tplBuf = await tplRes.arrayBuffer();
    templateId = await sha256Bytes(tplBuf);
  } catch (e) {
    return json(500, { ok: false, error: "Template hash failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  let pdfBytes;
  let pdfSha256 = "";
  let pdfBase64 = "";

  try {
    const renderRes = await fetch(origin + contract.rendererPath, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/pdf" },
      body: JSON.stringify(renderPayload)
    });

    if (renderRes.status !== 200) {
      return json(500, {
        ok: false,
        error: "Renderer failed.",
        status: renderRes.status,
        route: "/api/jobs/create"
      });
    }

    const buf = await renderRes.arrayBuffer();
    pdfBytes = new Uint8Array(buf);
    pdfSha256 = await sha256Bytes(buf);
    pdfBase64 = toBase64(pdfBytes);
  } catch (e) {
    return json(500, { ok: false, error: "Render failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const job = {
    ok: true,
    jobId,
    flow: contract.flow,
    form: contract.form,
    createdAt,
    rendererId: contract.rendererId,
    templatePath: contract.templatePath,
    templateId,
    renderPayload,
    pdf: {
      contentType: "application/pdf",
      filename: contract.filename,
      sha256: pdfSha256,
      base64: pdfBase64
    }
  };

  const key = "job:" + jobId;

  try {
    const existing = await kv.get(key);
    if (existing) return json(409, { ok: false, error: "Collision.", route: "/api/jobs/create" });

    await kv.put(key, JSON.stringify(job));
  } catch (e) {
    return json(500, { ok: false, error: "KV put failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  return json(200, {
    ok: true,
    jobId,
    pdfUrl: "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf"
  });
}
