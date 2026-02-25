export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST.", route: "/api/render/fl300" }, null, 2),
      { status: 405, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const tplUrl = new URL("/templates/jcc/fl300/FL-300.pdf", url.origin).toString();

    const tplRes = await fetch(tplUrl, { cf: { cacheTtl: 0, cacheEverything: false } });
    if (!tplRes.ok) {
      return new Response(
        JSON.stringify(
          { ok: false, error: "Template fetch failed.", status: tplRes.status, tplUrl, route: "/api/render/fl300" },
          null,
          2
        ),
        { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }

    const bytes = await tplRes.arrayBuffer();

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline; filename=\"FL-300.pdf\"",
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return new Response(
      JSON.stringify(
        { ok: false, error: "Passthrough failed.", message: String(e?.message || e), route: "/api/render/fl300", debug },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
