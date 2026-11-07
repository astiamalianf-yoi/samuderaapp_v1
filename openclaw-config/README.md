# OpenClaw for samudraapp.com

Starting settings for the samudraapp.com bot (its own OpenClaw, separate from the .id app's).
On the server they live in `/root/.openclaw-samudra/openclaw.json` (see `SAMUDRA_OPENCLAW_DIR`
in `docker-compose.yml`).

- The gateway password is `OPENCLAW_GATEWAY_TOKEN` in the stack's `.env` (not written here).
- `BACKEND_WEBHOOK_TOKEN` must equal `OPENCLAW_HOOK_TOKEN` in `.env`.
- `groupPolicy: open` lets every member's `!lapor` reach SAMUDRA; `requireMention: true` keeps the
  AI agent from answering ordinary chat. DMs to the bot are off.
- The relay hook itself is `openclaw-hooks/webhook-relay`, copied to `/root/.openclaw-samudra/hooks/`.

## One interpreter only (differs from the .id bot on purpose)

The .id bot handles `!lapor` twice: the relay hook sends it to the backend's keyword parser, and
its AI agent ("Guy", with `samudra_lapor` / `samudra_peringatan` tools) is told to submit every
report too, so one message can be counted twice. Here only the hook path is used; the AI agent
answers only when the bot is @mentioned, and no AI provider is needed for reports and warnings.

If the test shows `!lapor` does not reach the backend while `requireMention` is true, set
`"requireMention": false` (the hook then sees every message; without an AI provider configured
the agent cannot answer, which is intended).
