export async function handler(event) {
  try {
    console.log("IntaSend webhook hit:", event.body?.slice(0, 500));
    let data = {};
    try { data = JSON.parse(event.body || "{}"); } catch(e) {}
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, received: true, state: data.state || data.status || "unknown" })
    };
  } catch (err) {
    console.error("Webhook error:", err);
    return { statusCode: 200, body: JSON.stringify({ success: true, error_logged: true }) };
  }
}
