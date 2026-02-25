  let templateId = "";

  try {
    if (!contract.templatePath) {
      templateId = "none";
    } else {
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
    }
  } catch (e) {
    return json(500, {
      ok: false,
      error: "Template hash failed.",
      message: String(e?.message || e),
      route: "/api/jobs/create"
    });
  }
