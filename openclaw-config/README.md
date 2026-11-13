# OpenClaw for samudraapp.com

Starting settings for the samudraapp.com bot (its own OpenClaw, separate from the .id app's).
On the server they live in `/root/.openclaw-samudra/openclaw.json` (see `SAMUDRA_OPENCLAW_DIR`
in `docker-compose.yml`).

- The gateway password is `OPENCLAW_GATEWAY_TOKEN` in the stack's `.env` (not written here).
- `BACKEND_WEBHOOK_TOKEN` must equal `OPENCLAW_HOOK_TOKEN` in `.env`.
- `groupPolicy: open` lets every member's `!lapor` reach SAMUDRA. `requireMention: false` is needed:
  with `true`, OpenClaw 2026.5.12 drops messages that do not @mention the bot before the relay hook
  sees them, so a plain `!lapor` never reaches the backend (found on staging, 12 Nov 2026). No AI
  provider is configured, so the agent cannot answer ordinary chat anyway. DMs to the bot are off.
- OpenClaw 2026.5.12 needs the WhatsApp plugin matching its version:
  `docker compose run --rm openclaw-cli plugins install @openclaw/whatsapp@2026.5.12-beta.1`
  (the ClawHub default needs a newer OpenClaw and fails).
- The relay hook itself is `openclaw-hooks/webhook-relay`, copied to `/root/.openclaw-samudra/hooks/`.

## One interpreter only (differs from the .id bot on purpose)

The .id bot handles `!lapor` twice: the relay hook sends it to the backend's keyword parser, and
its AI agent ("Guy", with `samudra_lapor` / `samudra_peringatan` tools) is told to submit every
report too, so one message can be counted twice. Here only the hook path is used; the AI agent
answers only when the bot is @mentioned, and no AI provider is needed for reports and warnings.

The relay hook reads `BACKEND_WEBHOOK_TOKEN` from this file itself, because OpenClaw 2026.5.12 does
not pass a hook's `env` to the hook.
