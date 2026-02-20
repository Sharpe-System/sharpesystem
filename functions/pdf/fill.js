// functions/pdf/fill.js
export async function onRequestPost() {
  return new Response(JSON.stringify({
    ok: false,
    status: 501,
    code: "PDF_FILL_NOT_IMPLEMENTED",
    message: "PDF fill is Worker-lane in Canon vNext. This endpoint is a stub on Pages."
  }, null, 2), {
    status: 501,
    headers: { "content-type": "application/json" }
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: false,
    status: 405,
    code: "METHOD_NOT_ALLOWED",
    message: "Use POST /pdf/fill."
  }, null, 2), {
    status: 405,
    headers: { "content-type": "application/json" }
  });
}
