---
description: Start the Jekyll live preview server
---

# /preview

Start the Jekyll live preview server for this site.

## Workflow

1. Call the `mcp__Claude_Preview__preview_start` tool with `name: "jekyll"`.
   - The launch configuration lives in `.claude/launch.json` and runs
     `bundle exec jekyll serve --port 4000 --host 127.0.0.1`.
   - If the server is already running, the tool reuses the existing
     instance (its response will report `"reused": true`).

2. Report back the local URL (`http://127.0.0.1:4000`) and the
   `serverId` returned by the tool, so subsequent preview tools
   (screenshot, eval, click, etc.) can target the running server.

## Notes

- Do **not** start the server with `Bash` — always use the
  `mcp__Claude_Preview__preview_start` tool so the harness can manage
  the process lifecycle and surface the live URL.
- If a different port or runtime configuration is needed, edit
  `.claude/launch.json` first; do not pass overrides at call time.
