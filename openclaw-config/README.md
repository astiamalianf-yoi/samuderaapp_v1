# OpenClaw for samudraapp.com

Starting settings for the samudraapp.com bot (its own OpenClaw, separate from the .id app's).
On the server they live in `/root/.openclaw-samudra/openclaw.json` (see `SAMUDRA_OPENCLAW_DIR`
in `docker-compose.yml`).

- The gateway password is `OPENCLAW_GATEWAY_TOKEN` in the stack's `.env` (not written here).
- `BACKEND_WEBHOOK_TOKEN` must equal `OPENCLAW_HOOK_TOKEN` in `.env`.
- `groupPolicy: open` lets every member's `!lapor` reach SAMUDRA; `requireMention: true` keeps the
  AI agent from answering ordinary chat. DMs to the bot are off.
- The relay hook itself is `openclaw-hooks/webhook-relay`, copied to `/root/.openclaw-samudra/hooks/`.
