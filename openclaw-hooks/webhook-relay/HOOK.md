---
name: webhook-relay
description: "Forward inbound WhatsApp messages to backend webhook"
metadata:
  { "openclaw": { "emoji": "📤", "events": ["message:received"], "always": true } }
---

# Webhook Relay

Forwards every inbound WhatsApp message to the disaster backend webhook for command interception.

## Payload sent to the backend

`{ messageId, sessionKey, direction: "incoming", from, sender, to, text, timestamp, channel }`

- `from` / `to`: the chat (in a group this is the group id, `…@g.us`).
- `sender`: the person who wrote the message — `metadata.senderE164` from the OpenClaw hook
  context (fallback `senderId`), never the group id. The backend uses it to file the report under
  the fisherman registered with that WhatsApp number, so app and WhatsApp give one history.

After changing `handler.ts`, copy this folder to the OpenClaw hooks directory on the gateway host
and restart OpenClaw.

## Password

Set the same secret in both places, so only this OpenClaw can post to the backend:

- backend `.env`: `OPENCLAW_HOOK_TOKEN=<secret>`
- OpenClaw `openclaw.json`: `hooks.internal.entries["webhook-relay"].env.BACKEND_WEBHOOK_TOKEN = "<secret>"`
  (and `BACKEND_WEBHOOK_URL` if the backend is not reachable as `http://samudra-backend:3000`)
