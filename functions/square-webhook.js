export async function onRequestPost(context) {
  try {
    const body = await context.request.text();

    console.log("Square webhook received");
    console.log(body);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("error", { status: 500 });
  }
}
