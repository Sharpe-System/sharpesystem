  const origin = new URL(request.url).origin;

  // ---- Template hash (optional) ----
  let templateId = "none";

  if (contract.templatePath) {
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
      return json(500, {
        ok: false,
        error: "Template hash failed.",
        message: String(e?.message || e),
        route: "/api/jobs/create"
      });
    }
  }

  // ---- Render PDF ----
  let pdfBytes;
  let pdfSha256 = "";
  let pdfBase64 = "";

  try {
    const renderRes = await fetch(origin + contract.rendererPath, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/pdf, application/json"
      },
      body: JSON.stringify(renderPayload)
    });

    const ct = (renderRes.headers.get("content-type") || "").toLowerCase();

    if (renderRes.status !== 200 || ct.indexOf("application/pdf") === -1) {
      let errBody = "";
      try {
        if (ct.indexOf("application/json") !== -1) errBody = JSON.stringify(await renderRes.json(), null, 2);
        else errBody = await renderRes.text();
      } catch (_) {}
      return json(500, {
        ok: false,
        error: "Renderer did not return PDF.",
        status: renderRes.status,
        contentType: ct,
        body: (errBody || "").slice(0, 4000),
        route: "/api/jobs/create"
      });
    }

    const buf = await renderRes.arrayBuffer();
    pdfBytes = new Uint8Array(buf);
    pdfSha256 = await sha256Bytes(buf);
    pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  } catch (e) {
    return json(500, {
      ok: false,
      error: "Render fetch failed.",
      message: String(e?.message || e),
      route: "/api/jobs/create"
    });
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

  const existing = await kv.get(key);
  if (existing) {
    return json(409, { ok: false, error: "Collision.", route: "/api/jobs/create" });
  }

  await kv.put(key, JSON.stringify(job));

  return json(200, {
    ok: true,
    jobId,
    pdfUrl: "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf"
  });
}
