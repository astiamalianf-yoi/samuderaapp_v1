const BACKEND_URL = process.env.BACKEND_WEBHOOK_URL || "http://samudra-backend:3000/api/openclaw/webhook";
// Same value as OPENCLAW_HOOK_TOKEN in the backend's .env (set in openclaw.json, hook env).
const HOOK_TOKEN = process.env.BACKEND_WEBHOOK_TOKEN || "";
const SESSION_KEY = process.env.SESSION_KEY || "agent:main:whatsapp:group:120363406080394106@g.us";

function extractGroupIdFromSessionKey(key) {
  const match = key.match(/:group:(.+)$/) || key.match(/:direct:(.+)$/);
  return match ? match[1] : "";
}

async function handler(event) {
  if (event.type !== "message" || event.action !== "received") return;

  const ctx = event.context || {};
  const content = ctx.content || "";
  const from = ctx.from || "";
  const channelId = ctx.channelId || "";
  const metadata = ctx.metadata || {};
  const chatId = extractGroupIdFromSessionKey(event.sessionKey) || channelId;

  if (!content) return;

  // The person who wrote the message. In a group, `from` is the group id; the sender's number is
  // in metadata.senderE164 (OpenClaw hook context). It links his WhatsApp reports to his app
  // registration, so never send the group id as the sender.
  const isGroupId = (v) => typeof v === "string" && /@g\.us$/i.test(v);
  const sender =
    [metadata.senderE164, ctx.senderE164, metadata.senderId, ctx.senderId, from]
      .find((v) => typeof v === "string" && v.trim() && !isGroupId(v)) || "";

  const payload = {
    messageId: ctx.messageId || event.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionKey: event.sessionKey || SESSION_KEY,
    direction: "incoming",
    from: from || chatId,
    sender,
    to: chatId,
    text: content,
    timestamp: event.timestamp || new Date().toISOString(),
    channel: channelId.includes("whatsapp") ? "whatsapp" : channelId || "whatsapp",
  };

  try {
    await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(HOOK_TOKEN ? { "X-Hook-Token": HOOK_TOKEN } : {}) },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[webhook-relay] forward failed: ${err.message}`);
  }
}

export default handler;
