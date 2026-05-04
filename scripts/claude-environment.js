// Interactive topology of the Claude Code environment.
// Vanilla-JS widget. Bidirectional selection: click a layer to highlight its
// files, click a file to highlight its layer. Now also lets the reader
// include/exclude files via checkboxes and see the impact on the model's
// always-loaded token budget - including a section-level breakdown of
// CLAUDE.md that can be reshaped into on-demand skills.
//
// Usage:  <div id="claudeenv-demo"></div>
//         <script>createClaudeEnvironment('claudeenv-demo');</script>

(function() {

  // ───────────── Data model (layers ↔ files, bidirectional) ─────────────

  var LAYERS = {
    entry: {
      label: '0. User Input',
      sublabel: "The user's request",
      color: '#d97706',
      description: 'Everything else exists to shape how this is interpreted before reaching the model.',
      nodes: ['prompt']
    },
    memory: {
      label: '1. Instructions',
      badge: '🧬 🧠',
      sublabel: 'Loaded at the start of every session',
      color: '#0891b2',
      description: 'Markdown files concatenated into the system prompt at session start and carried through every turn that follows, without being re-injected per prompt. Claude reads them as **instructions** whose intent is to steer behaviour, codify conventions, and document the commands available in the project.',
      aggregation: 'All present `CLAUDE.md` files are **concatenated** into context at session start. Files are read from the filesystem root down to your working directory, with `CLAUDE.local.md` appended after `CLAUDE.md` at each level. There is no key-by-key override, when two files give conflicting guidance the docs note Claude may resolve it arbitrarily. Read order tends to nudge the model toward instructions seen last, but it is not enforced.',
      precedenceFiles: ['claude-local', 'claude-md-project', 'claude-md-global'],
      interactionExample:
        '# How three CLAUDE.md files load\n' +
        '\n' +
        'Read order (filesystem root → working dir, .local appended):\n' +
        '\n' +
        '1. ~/.claude/CLAUDE.md   "Use TypeScript strict mode"\n' +
        '2. ./CLAUDE.md           "Use npm for installs"\n' +
        '3. ./CLAUDE.local.md     "Use pnpm instead of npm"\n' +
        '\n' +
        '→ All three sit in context. Where (2) and (3) conflict the\n' +
        '  docs note Claude "may pick one arbitrarily". Putting personal\n' +
        '  overrides in CLAUDE.local.md gets them read last, which tends\n' +
        '  to nudge the model, but is not guaranteed.',
      nodes: ['claude-local', 'claude-md-project', 'claude-md-global', 'rules']
    },
    config: {
      label: '2. Permissions',
      sublabel: 'Behavioural controls',
      color: '#7c3aed',
      description: 'Permissions, model selection, and feature toggles. Defines what Claude can do without asking.',
      aggregation: 'Full precedence chain (highest first): managed policy → CLI flags → `settings.local.json` → `settings.json` → `~/.claude/settings.json`. Array values like `permissions.allow` and `deny` are concatenated and deduplicated across all scopes. Scalar values like `model` are taken from the highest-precedence scope that sets them. None of this enters the model context, it only governs runtime behaviour.',
      precedenceFiles: ['settings-local', 'settings-project', 'settings-global'],
      interactionExample:
        '# How three settings.json files merge\n' +
        '\n' +
        'permissions.allow   (UNIONED across all files)\n' +
        '  ~/.claude/settings.json:  ["Read(**)"]\n' +
        '  settings.json:            ["Bash(npm test:*)"]\n' +
        '  settings.local.json:      ["Bash(docker:*)"]\n' +
        '  → final: ["Read(**)", "Bash(npm test:*)", "Bash(docker:*)"]\n' +
        '\n' +
        'model               (DEEPER WINS - last writer)\n' +
        '  ~/.claude/settings.json:  "claude-haiku-4-5"\n' +
        '  settings.json:            "claude-opus-4-7"   ← chosen\n' +
        '  settings.local.json:      (not set)',
      nodes: ['settings-local', 'settings-project', 'settings-global']
    },
    tools: {
      label: '3. Tools',
      sublabel: 'Primitive actions',
      color: '#db2777',
      description: 'The fundamental actions Claude can take. Built-ins like Read, Write, Bash, Grep are always available. Everything else in the environment either restricts these, orchestrates them, or extends them.',
      aggregation: 'Built-in tool definitions are always present in the system prompt. Settings and agents can only **restrict** them; MCP and skills can **extend** them.',
      nodes: ['builtin-tools']
    },
    invocable: {
      label: '4. Invocable Knowledge',
      sublabel: 'Workflows and commands',
      color: '#d97706',
      description: 'Reusable patterns. Skills auto-load based on natural language; commands are invoked explicitly with a slash.',
      aggregation: 'Discovered at session start but not loaded. Each skill\'s short description (~30 tokens) is in context so Claude can match; **bodies load on demand**. Commands only enter context on explicit `/command` invocation.',
      nodes: ['skills', 'commands']
    },
    delegation: {
      label: '5. Delegation',
      sublabel: 'Specialised agents',
      color: '#e11d48',
      description: 'Spawn focused subagents that run in their own fresh context windows. Only a summary returns to the main conversation.',
      aggregation: 'Only the agent\'s description is loaded into the parent system prompt. The agent\'s own system prompt and any files it reads stay isolated in its **fresh context window** - only the final summary returns.',
      nodes: ['agents']
    },
    automation: {
      label: '6. Automation',
      sublabel: 'Event-driven scripts',
      color: '#059669',
      description: 'Shell scripts triggered by tool events. Enforce standards without model involvement, formatters, linters, validators.',
      aggregation: 'Hooks fire deterministically on tool lifecycle events. **Zero model context cost** - they run shell-side, outside the model loop.',
      nodes: ['hooks']
    },
    external: {
      label: '7. External Tools',
      sublabel: 'Protocol-based integrations',
      color: '#2563eb',
      description: 'MCP is the odd one out: an OPEN PROTOCOL, not a Claude Code convention. Portable across Cursor, VS Code, and other clients.',
      aggregation: 'When an MCP server is connected, its tool definitions are added to the system prompt - same context cost model as built-in tools.',
      nodes: ['mcp']
    },
    state: {
      label: '8. State and Isolation',
      sublabel: 'Session management',
      color: '#64748b',
      description: 'How Claude remembers across sessions and isolates parallel work.',
      aggregation: 'On-disk only. Nothing here enters context until you `--resume` a session - and even then, only the prior turn transcript is replayed.',
      nodes: ['sessions', 'worktreeinclude']
    }
  };

  // Token estimates are illustrative - real values depend on your files.
  // `tokens` is what the file contributes to the **always-loaded** system
  // prompt at session start. 0 means the file is on-demand or shell-side.
  var NODES = {
    prompt: {
      layer: 'entry', label: 'claude "…"', icon: 'terminal',
      title: 'User Prompt',
      description: 'The natural language request. Every other component in the environment exists to shape how Claude interprets and acts on this input.',
      flow: 'Prompt → merged with all context layers → model → tool calls → response',
      example: '$ claude "refactor the auth handler to use zod schemas"',
      tokens: 30
    },
    'claude-local': {
      layer: 'memory', label: 'CLAUDE.local.md', icon: 'file-text-o',
      title: 'CLAUDE.local.md',
      description: 'Personal **instructions** for this project. Lives at the **project root** (not inside `.claude/`) and is gitignored, so only you see it. Treated identically to `CLAUDE.md`, just appended after it at the project level so its content is the most recently seen at that scope.',
      example: '# My personal tweaks\nUse pnpm instead of npm locally\nMy debug port is 3001\nSkip the Docker setup, I run Postgres natively',
      priority: 'Loaded last at the project level (read order, not enforced override)',
      tokens: 250,
      tokenNote: 'Loaded in full at session start.'
    },
    'claude-md-project': {
      layer: 'memory', label: 'CLAUDE.md', icon: 'file-text-o',
      title: 'CLAUDE.md (project)',
      description: 'Project-level **instructions** committed to git. Team-shared memory for build commands, architecture, conventions. Loaded in full at session start.',
      example: '# Acme API\n\n## Commands\nnpm run dev\nnpm run test\n\n## Conventions\n- Validate with zod\n- Return { data, error, meta }\n- Never expose stack traces',
      priority: 'Team-level instructions',
      tokenNote: 'Sum of section tokens below. Sections can be moved to skills to defer loading.',
      sections: [
        { id: 'overview',        label: 'Project header and overview',     tokens:  90, fixed: true,
          fixedNote: 'Stays inline - too generic to live anywhere else.' },
        { id: 'commands',        label: 'Build / test / deploy commands', tokens: 220,
          skillTarget: 'A `deploy` skill that loads only when you ask to ship.',
          skillCost: 240 },
        { id: 'conventions',     label: 'Code conventions',              tokens: 380,
          skillTarget: 'A path-scoped rule under `.claude/rules/` loaded only when editing matching files.',
          skillCost: 380 },
        { id: 'architecture',    label: 'Architecture overview',         tokens: 540,
          skillTarget: 'An `explain-architecture` skill loaded only when discussing structure.',
          skillCost: 560 },
        { id: 'troubleshooting', label: 'Troubleshooting playbook',      tokens: 290,
          skillTarget: 'A `debug` skill loaded only when investigating errors.',
          skillCost: 310 }
      ]
    },
    'claude-md-global': {
      layer: 'memory', label: '~/.claude/CLAUDE.md', icon: 'file-text-o',
      title: '~/.claude/CLAUDE.md',
      description: 'Global **instructions** that apply to every project on your machine. Your personal preferences across all work.',
      example: '## Global preferences\n- Always use TypeScript strict mode\n- Prefer functional patterns\n- Explain reasoning before big changes',
      priority: 'Loaded earliest in the read order (filesystem root first); project files come after',
      tokens: 600,
      tokenNote: 'Loaded for **every** session on this machine - every project pays this cost.'
    },
    rules: {
      layer: 'memory', label: 'rules/', icon: 'book',
      title: 'rules/',
      description: "Modular **instruction** files that load alongside CLAUDE.md. The ~200-line threshold is a guideline, not a hard rule, split out when CLAUDE.md becomes unwieldy, or when different team members own different areas. Filenames don't affect behaviour; path-scoping is controlled entirely by frontmatter.",
      example: '# .claude/rules/api-conventions.md\n---\npaths:\n  - "src/handlers/**/*.ts"\n  - "src/api/**/*.ts"\n---\n# API Development Rules\n- All endpoints must validate with zod\n- Return { data, error } shape\n- Never expose internal error details',
      priority: 'Two loading modes depending on frontmatter',
      tokens: 400,
      tokenNote: 'Always-loaded rules count in full. Path-scoped rules only enter context when their globs match - much cheaper.',
      extended: {
        heading: 'What determines whether a rule loads',
        body: [
          { label: 'No frontmatter', text: 'Loaded unconditionally at session start, same priority as CLAUDE.md. Always in context, use for things that apply everywhere.' },
          { label: 'With `paths:` frontmatter', text: 'Path-scoped. Only injected into context when Claude touches a file matching the glob pattern. Saves context window space, use for area-specific conventions.' },
          { label: 'Glob syntax', text: 'Supports `*`, `**`, `?`, `[abc]`, and brace expansion like `{ts,tsx}`. Example: `src/**/*.{ts,tsx}` matches all TypeScript files under src recursively.' },
          { label: 'Discovery', text: 'All `.md` files under `.claude/rules/` are discovered recursively, you can organise into subdirectories like `frontend/` or `backend/`.' },
          { label: 'Rules vs skills', text: "Rules load automatically (conditional on path or always). Skills only load when Claude decides they're relevant based on your prompt. Use rules for 'always apply this' and skills for 'invoke this workflow'." }
        ]
      }
    },
    'settings-local': {
      layer: 'config', label: 'settings.local.json', icon: 'cog',
      title: 'settings.local.json',
      description: 'Personal inputs (`.local`) take precedence over team settings. Gitignored, your personal permission overrides for this project.',
      priority: 'Highest-priority config for this project',
      example: '{\n  "permissions": {\n    "allow": ["Bash(docker:*)"]\n  }\n}',
      tokens: 0,
      tokenNote: 'Settings govern runtime behaviour (permissions, model selection). They never enter the model context.'
    },
    'settings-project': {
      layer: 'config', label: 'settings.json', icon: 'cog',
      title: 'settings.json (project)',
      description: 'Team-shared configuration. Permissions, model selection, tool allowlists, attribution settings.',
      example: '{\n  "permissions": {\n    "allow": ["Bash(npm test:*)", "Read(**)"],\n    "deny": ["Bash(rm:*)"]\n  },\n  "model": "claude-opus-4-7"\n}',
      priority: 'Team-level config',
      tokens: 0,
      tokenNote: 'Settings govern runtime behaviour. They never enter the model context.'
    },
    'settings-global': {
      layer: 'config', label: '~/.claude/settings.json', icon: 'cog',
      title: '~/.claude/settings.json',
      description: 'Global config across all projects. Your default permission stance and machine-wide preferences.',
      priority: 'Lowest-priority config (project-level takes precedence over these)',
      tokens: 0,
      tokenNote: 'Settings govern runtime behaviour. They never enter the model context.'
    },
    'builtin-tools': {
      layer: 'tools', label: 'built-in tools', icon: 'wrench',
      title: 'Built-in Tools',
      description: "The primitive actions Claude can take in your environment. These aren't files, they're capabilities baked into Claude Code. Every other layer interacts with tools: settings control which are allowed, skills describe when to use them, hooks fire around them, MCP adds new ones.",
      example: 'Read        , read a file\nWrite       , create a new file\nEdit        , modify an existing file\nBash        , run shell commands\nGrep        , search across files\nGlob        , match file patterns\nTask        , delegate to a subagent\nWebFetch    , fetch a URL',
      priority: 'Always available, cannot be removed, only restricted',
      tokens: 3500,
      tokenNote: 'Tool manifest. Always present, scales roughly with the number of allowed tools.',
      extended: {
        heading: 'How the environment shapes tools',
        body: [
          { label: 'settings.json', text: 'Allowlist/denylist which tools Claude can invoke without asking permission.' },
          { label: 'Agents', text: 'Each subagent can have a restricted subset of tools, e.g., a security-auditor with only `[Read, Grep]`.' },
          { label: 'Skills', text: "Describe procedural knowledge for sequencing tools (e.g., 'to deploy: run tests, bump version, tag, push')." },
          { label: 'Hooks', text: 'Run shell commands on tool lifecycle events, PreToolUse, PostToolUse, SubagentStop.' },
          { label: 'MCP', text: 'Adds entirely new tools from external servers (query_database, create_jira_ticket, etc.).' }
        ]
      }
    },
    skills: {
      layer: 'invocable', label: 'skills/', icon: 'file-code-o',
      title: 'skills/',
      description: "Each skill is a folder containing a `SKILL.md` plus any supporting files it bundles (templates, scripts, reference docs). Both you and Claude can invoke them: typed explicitly as `/skill-name`, or auto-invoked by Claude when your prompt matches the skill's `description` frontmatter. Frontmatter flags (`disable-model-invocation`, `user-invocable`) can lock invocation to one direction. **Not** part of MCP, Claude Code-specific convention.",
      example: '# .claude/skills/deploy/SKILL.md\n---\nname: deploy\ndescription: Triggered when user says\n  "deploy", "ship it", "push to prod"\nallowed-tools: [Read, Bash]\n---\n1. Run full test suite\n2. Bump version in package.json\n3. Create git tag\n4. Push to main',
      priority: 'User-invoked via /name, or auto-invoked when description matches',
      tokens: 0,
      tokenNote: 'Each skill\'s description (~30 tokens) is in context so Claude can match. Bodies load on demand only when triggered.'
    },
    commands: {
      layer: 'invocable', label: 'commands/', icon: 'bolt',
      title: 'commands/',
      description: 'Single-file equivalents of skills. A file at `commands/deploy.md` creates `/deploy` the same way a skill at `skills/deploy/SKILL.md` does, and both can be auto-invoked by Claude. Skills are now the recommended form because they bundle supporting files alongside the prompt; commands remain supported. If a skill and a command share a name, the skill wins.',
      example: '# .claude/commands/review.md\n---\ndescription: Review current branch\n---\n## Diff\n!`git diff main...HEAD`\n\nReview for security issues and missing tests.',
      priority: 'User-invoked via /name, or auto-invoked when description matches',
      tokens: 0,
      tokenNote: 'Loaded into context only when invoked.'
    },
    agents: {
      layer: 'delegation', label: 'agents/', icon: 'android',
      title: 'agents/ (subagents)',
      description: 'Specialised subagents that run in their own **fresh context windows**. They have their own system prompt, restricted tool access, and optional model choice. The parent conversation receives only the subagent’s final summary, not the files it read, tools it called, or intermediate reasoning.',
      example: '# .claude/agents/security-auditor.md\n---\nname: security-auditor\ndescription: Use PROACTIVELY after code\n  changes to check for security issues.\ntools: [Read, Grep, Glob]\nmodel: inherit\n---\nYou are a senior security specialist.\nFocus only on auth, input validation,\nand data exposure risks.\nReport findings with severity ratings.',
      priority: 'Invoked by description match, `@agent-name`, or via /agents',
      tokens: 0,
      tokenNote: 'Each agent description (~40 tokens) is in the parent context so Claude can dispatch. The agent\'s own system prompt and reads stay isolated in its fresh window.',
      extended: {
        heading: 'Why subagents matter',
        body: [
          { label: 'Context isolation', text: "Main session stays clean. An audit that reads 40 files doesn’t pollute your main conversation, only the summary returns. This is the primary reason to use them." },
          { label: 'Parallel execution', text: 'Multiple subagents run concurrently. A code review can dispatch style-checker, security-scanner, and test-coverage at once, minutes → seconds.' },
          { label: 'Tool restriction', text: "Scope each agent’s tools precisely. A read-only reviewer doesn’t need Write or Bash; a security auditor doesn’t need Edit." },
          { label: 'Scope (project vs user)', text: 'Define in `.claude/agents/` (team-shared) or `~/.claude/agents/` (personal, portable across projects). Project-level takes precedence on name collision.' },
          { label: 'Skill vs agent', text: 'Use a **skill** when you want procedural knowledge injected into the current context. Use an **agent** when the work is noisy and only the summary matters.' },
          { label: 'Agent vs worktree', text: 'Agents isolate context; worktrees isolate filesystems. Combine them for truly parallel multi-branch work.' },
          { label: "Can't nest", text: 'Subagents cannot spawn further subagents. Depth is exactly one, this prevents infinite recursion.' },
          { label: 'Invocation', text: "Three ways: phrase your request to match the description (implicit), name it in natural language ('use the security-auditor'), or `@mention` it (guaranteed)." }
        ]
      }
    },
    hooks: {
      layer: 'automation', label: 'hooks/', icon: 'plug',
      title: 'hooks/',
      description: 'Shell scripts triggered by tool lifecycle events (PreToolUse, PostToolUse, SubagentStop, etc.). Run deterministically without model involvement.',
      example: '{\n  "hooks": {\n    "PostToolUse": [{\n      "matcher": "Write(*.py)",\n      "hooks": [{\n        "type": "command",\n        "command": "python -m black \\"$file\\""\n      }]\n    }]\n  }\n}',
      priority: 'Automatic on tool events',
      tokens: 0,
      tokenNote: 'Shell-side. Zero model context cost.'
    },
    mcp: {
      layer: 'external', label: '.mcp.json', icon: 'server',
      title: '.mcp.json',
      description: 'MCP server configuration. Lives at the **project root** (not inside `.claude/`), committed for the team to share. Personal/per-user servers go to `~/.claude.json` instead. Unlike everything else here, MCP is an OPEN PROTOCOL, portable across Cursor, VS Code, and other clients. Extends Claude with external tools (databases, GitHub, Jira).',
      example: '{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["@modelcontextprotocol/server-postgres"]\n    },\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"]\n    }\n  }\n}',
      priority: 'Works with ANY MCP-compatible client',
      tokens: 500,
      tokenNote: 'Tool definitions from each connected server join the system prompt - same cost model as built-in tools.'
    },
    worktreeinclude: {
      layer: 'state', label: '.worktreeinclude', icon: 'file-text-o',
      title: '.worktreeinclude',
      description: 'Project-root file (gitignore-style syntax) listing untracked files to copy into each new git worktree Claude creates. Worktrees are fresh checkouts, so anything gitignored, like `.env` or local secrets, is missing by default; this file declares which of those should follow you in. Only files that match a pattern **and** are gitignored get copied, so tracked files are never duplicated.',
      example: '# Local environment\n.env\n.env.local\n\n# API credentials\nconfig/secrets.json',
      priority: 'Read when Claude creates a worktree (--worktree, EnterWorktree, subagent isolation)',
      tokens: 0,
      tokenNote: 'Filesystem only. No model context impact.'
    },
    sessions: {
      layer: 'state', label: 'projects/', icon: 'sitemap',
      title: '~/.claude/projects/',
      description: 'Auto-memory: Claude maintains its own notes per project at `~/.claude/projects/<project>/memory/MEMORY.md`. The `<project>` key is derived from the git repository, so all worktrees and subdirectories of the same repo share one memory directory. `MEMORY.md` acts as an index; topic files (e.g. `debugging.md`) get split out as content grows. Session transcripts also live here for `--resume`.',
      example: '~/.claude/projects/<project>/\n├── memory/\n│   ├── MEMORY.md         (Claude writes this)\n│   ├── debugging.md      (topic file, on-demand)\n│   └── architecture.md\n└── sessions/\n    └── session-<id>.json',
      priority: 'On by default; toggle with /memory or autoMemoryEnabled',
      tokens: 800,
      tokenNote: 'First 200 lines of MEMORY.md (capped at 25 KB) load every session; topic files load on demand. Sessions only enter context on --resume.'
    }
  };

  // Files that participate in the include/exclude checkboxes (everything
  // except the prompt itself, which is the entry point).
  var TOGGLEABLE = Object.keys(NODES).filter(function(id) { return id !== 'prompt'; });

  // ────────────────────────────── helpers ──────────────────────────────

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.substr(0, 2) === 'on') e.addEventListener(k.substr(2).toLowerCase(), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function(c) {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  function fa(name, extraClass) {
    return el('i', { class: 'fa fa-' + name + (extraClass ? ' ' + extraClass : ''), 'aria-hidden': 'true' });
  }

  // Lightweight inline-markdown renderer: **bold**, `code`.
  function renderDescription(text) {
    var frag = document.createDocumentFragment();
    var parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
    parts.forEach(function(part) {
      if (!part) return;
      if (part.substr(0, 2) === '**' && part.substr(-2) === '**') {
        frag.appendChild(el('strong', { class: 'ce-bold' }, part.slice(2, -2)));
      } else if (part.charAt(0) === '`' && part.charAt(part.length - 1) === '`') {
        frag.appendChild(el('code', { class: 'ce-code' }, part.slice(1, -1)));
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    return frag;
  }

  function fmtTokens(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  // ────────────────────────────── styles ───────────────────────────────

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = [
      /* Design-language foundation. The widget's local vars alias the   */
      /* site-wide tokens (defined in _sass/_theme.scss) so palette       */
      /* migrations and dark-mode flips happen in one place.             */
      '.claudeenv { position: relative; max-width: 960px; margin: 0 auto; padding: 8px 0 24px; color: var(--ink-primary); font-family: var(--font-text); --accent: var(--coral); --border: var(--line); --hairline: var(--line); --muted: var(--ink-muted); --card: var(--paper-raised); --subdued: var(--line); --subdued-bg: var(--paper-inset); --subdued-fg: var(--ink-muted); }',
      '.claudeenv .ce-intro { color: #777; font-size: 0.92rem; max-width: 620px; margin: 0 auto 20px; line-height: 1.5; }',

      /* Two-column grid: left = layer bands, right = file tree.
         align-items: stretch lets the file-tree panel grow to match the
         layer-bands column height. minmax(0, 1fr) prevents long strings
         in either column from pushing the layout wider. */
      /* 2-col layout (default): prompt spans full width above bands+filesystem. */
      /* Inspector and context stack as full-width rows below the main grid.    */
      '.claudeenv .ce-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "prompt prompt" "bands fs" "inspector inspector" "context context"; gap: 22px; align-items: stretch; }',
      '.claudeenv .ce-prompt-wrap { grid-area: prompt; }',
      '.claudeenv .ce-bands-col { grid-area: bands; }',
      '.claudeenv .ce-fs-col { grid-area: fs; }',
      '.claudeenv .ce-inspector { grid-area: inspector; }',
      '.claudeenv .ce-context { grid-area: context; }',
      '@media (max-width: 760px) { .claudeenv .ce-grid { grid-template-columns: 1fr; grid-template-areas: "prompt" "bands" "fs" "inspector" "context"; } }',
      /* 4-column wide layout: activates when the viewport accommodates all     */
      /* four blocks at their original 2-col width (~360 px each).              */
      /* Layout: inspector | bands | filesystem | context, with the prompt     */
      /* spanning cols 2-3 only so it stays at the original 2-col width.        */
      /* The widget breaks out of the 740 px post-content wrapper via           */
      /* position:relative + left:50% + translateX(-50%) so it can expand to    */
      /* 1520 px centred in the viewport.                                        */
      '@media (min-width: 1600px) { .claudeenv { max-width: none; width: min(1520px, calc(100vw - 60px)); position: relative; left: 50%; transform: translateX(-50%); } }',
      '@media (min-width: 1600px) { .claudeenv .ce-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-areas: ".         prompt prompt .       " "inspector bands  fs     context"; } }',
      '@media (min-width: 1600px) { .claudeenv .ce-inspector, .claudeenv .ce-context { display: flex; flex-direction: column; } .claudeenv .ce-inspector .ce-panel-body-scroll, .claudeenv .ce-context .ce-panel-body-scroll { flex: 1; overflow-y: auto; } }',

      /* Layer bands */
      '.claudeenv .ce-bands { display: flex; flex-direction: column; gap: 8px; height: 100%; }',
      '.claudeenv .ce-bands-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }',
      '.claudeenv .ce-bands-header h3 { margin: 4px 0 0; font-size: 1.15rem; font-weight: 500; color: #222; }',
      /* Layer band -- viz.row recipe. Active state stays neutral grey  */
      /* per the user's selection-colour preference (overrides the     */
      /* design's coral inset shadow).                                  */
      '.claudeenv .ce-band { width: 100%; text-align: left; background: var(--paper-raised); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; position: relative; cursor: pointer; transition: opacity 0.2s, background 0.2s, border-color 0.2s; font: inherit; color: inherit; }',
      '.claudeenv .ce-band.dimmed { opacity: 0.3; }',
      /* viz.row-selected: paper-inset bg, ink-muted border, coral inset
         shadow on the left edge -- matches the design language\'s
         `viz.* + code.* in context` exemplar. */
      '.claudeenv .ce-band.active { background: var(--paper-inset); border-color: var(--ink-muted); box-shadow: inset 3px 0 0 var(--coral); }',
      '.claudeenv .ce-band:hover:not(.dimmed), .claudeenv .ce-band.ce-band-soft-hover:not(.dimmed) { background: var(--paper-inset); border-color: var(--ink-faint); }',
      '.claudeenv .ce-band-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 3px; }',
      /* viz.row-title: ink-primary, display, lg, weight 500, snug. */
      '.claudeenv .ce-band-title { display: block; font-family: var(--font-display); font-size: var(--size-lg); font-weight: 500; line-height: var(--lh-snug); letter-spacing: var(--track-snug); color: var(--ink-primary); }',
      '.claudeenv .ce-band-num { font-family: var(--font-mono); letter-spacing: 0; color: var(--ink-muted); }',
      /* viz.row-sub: ink-muted, text, smd, weight 400.            */
      '.claudeenv .ce-band-sublabel { display: block; font-family: var(--font-text); font-size: var(--size-smd); font-weight: 400; color: var(--ink-muted); margin-top: 3px; }',
      '.claudeenv .ce-band .ce-entry-cmd { margin-top: 8px; margin-bottom: 0; }',
      '.claudeenv .ce-band-count { font-family: var(--font-mono); font-size: var(--size-xs); color: var(--ink-faint); flex-shrink: 0; }',
      '.claudeenv .ce-band-desc { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-muted); line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-clear-btn { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em; color: #999; background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }',
      '.claudeenv .ce-clear-btn:hover { color: #333; border-color: var(--accent); }',

      /* File tree panel: stretches to match the layer-bands column. */
      /* viz.frame: paper-raised, line border, radius 10. */
      '.claudeenv .ce-panel { border: 1px solid var(--line); border-radius: 10px; background: var(--paper-raised); margin-bottom: 16px; overflow: hidden; }',
      '.claudeenv .ce-tree-panel { display: flex; flex-direction: column; height: 100%; margin-bottom: 0; }',
      '.claudeenv .ce-tree-panel .ce-tree { flex: 1; display: flex; flex-direction: column; }',
      '.claudeenv .ce-panel-head { border-bottom: 1px solid var(--line); padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }',
      /* viz.eyebrow: ink-faint, mono, sm, eyebrow tracking, upper. */
      '.claudeenv .ce-panel-head-label { font-family: var(--font-mono); font-size: var(--size-sm); font-weight: 400; letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); }',
      '.claudeenv .ce-panel-head .fa { color: var(--ink-faint); font-size: 0.72rem; }',
      '.claudeenv .ce-tree-controls { display: flex; gap: 4px; }',
      /* Border at --ink-faint (not --line) so the 1px edge stays legible
         in dark mode, where --line sits very close to --paper. */
      '.claudeenv .ce-mini-btn { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-muted); background: transparent; border: 1px solid var(--ink-faint); border-radius: 4px; padding: 3px 7px; cursor: pointer; }',
      '.claudeenv .ce-mini-btn:hover { color: var(--ink-primary); border-color: var(--ink-primary); }',
      '.claudeenv .ce-tree { padding: 8px 6px; }',
      /* code.path: file paths styled in muted mono. Directory labels  */
      /* (root + nested) are emphasised by weight only.                */
      '.claudeenv .ce-tree-root { display: flex; align-items: center; gap: 6px; padding: 3px 8px; width: 100%; text-align: left; background: transparent; border: none; font: inherit; color: var(--ink-muted); cursor: pointer; border-radius: 4px; }',
      '.claudeenv .ce-tree-root:hover { color: var(--ink-primary); background: var(--paper-inset); }',
      '.claudeenv .ce-tree-root .ce-chevron { font-size: 0.65rem; color: var(--ink-faint); transition: transform 0.2s; width: 10px; }',
      '.claudeenv .ce-tree-root .ce-chevron.open { transform: rotate(90deg); }',
      '.claudeenv .ce-tree-root .ce-home,',
      '.claudeenv .ce-tree-root .ce-folder { color: var(--ink-faint); }',
      '.claudeenv .ce-tree-root .ce-label { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600; }',
      '.claudeenv .ce-tree-root .ce-scope { margin-left: auto; font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); }',
      '.claudeenv .ce-tree-children { margin-left: 10px; border-left: 1px solid var(--line); padding-left: 2px; }',
      '.claudeenv .ce-tree-spacer { height: 6px; }',
      /* Tree row layout: [checkbox] [label-button] */
      '.claudeenv .ce-tree-row { display: flex; align-items: center; gap: 4px; }',
      /* Custom checkbox - identical visual in both states (filled ink-faint). */
      '.claudeenv .ce-tree-check { appearance: none; -webkit-appearance: none; -moz-appearance: none; width: 14px; height: 14px; flex-shrink: 0; margin: 0 2px 0 6px; cursor: pointer; border: 1.5px solid var(--ink-faint); border-radius: 3px; background: var(--ink-faint); position: relative; vertical-align: middle; }',
      '.claudeenv .ce-tree-check:checked::after { content: ""; position: absolute; left: 50%; top: 45%; width: 4px; height: 7px; border: solid var(--paper-raised); border-width: 0 1.5px 1.5px 0; transform: translate(-50%, -50%) rotate(45deg); }',
      '.claudeenv .ce-tree-check:focus-visible { outline: 2px solid var(--coral); outline-offset: 1px; }',
      '.claudeenv .ce-tree-check[disabled] { opacity: 0.5; cursor: not-allowed; }',
      /* code.path: ink-muted file paths in mono. */
      '.claudeenv .ce-tree-node { flex: 1; display: flex; align-items: center; gap: 6px; padding: 3px 8px; min-width: 0; text-align: left; background: transparent; border: none; font: inherit; color: var(--ink-muted); cursor: pointer; border-radius: 4px; position: relative; }',
      '.claudeenv .ce-tree-node:hover { color: var(--ink-primary); background: var(--paper-inset); }',
      '.claudeenv .ce-tree-node.selected { background: var(--paper-inset); color: var(--ink-primary); border: 1px solid var(--ink-muted); padding: 2px 7px; }',
      '.claudeenv .ce-tree-node.highlighted { background: var(--paper-inset); color: var(--ink-primary); }',
      '.claudeenv .ce-tree-node.excluded { opacity: 0.45; text-decoration: line-through; text-decoration-color: var(--ink-faint); }',
      '.claudeenv .ce-tree-node .fa { font-size: 0.75rem; color: var(--ink-faint); flex-shrink: 0; }',
      '.claudeenv .ce-tree-node.dir .fa { color: var(--ink-faint); }',
      '.claudeenv .ce-tree-node.dir .ce-label { font-weight: 600; }',
      '.claudeenv .ce-tree-node .ce-label { font-family: var(--font-mono); font-size: 0.76rem; }',
      '.claudeenv .ce-tree-node .ce-token-tag { margin-left: auto; font-family: var(--font-mono); font-size: 0.6rem; color: var(--ink-faint); padding-left: 6px; }',
      '.claudeenv .ce-tree-node.included-bold .ce-token-tag { color: var(--ink-primary); }',
      '.claudeenv .ce-tree-node .ce-layer-dot { position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; }',
      /* Spacer that mirrors a checkbox slot for non-toggleable folder rows. */
      '.claudeenv .ce-tree-check-spacer { display: inline-block; width: 14px; flex-shrink: 0; margin: 0 2px 0 6px; }',
      /* Non-interactive folder row (e.g. `.claude/`) - same visual as other */
      /* folders but no hover / cursor. */
      '.claudeenv .ce-tree-node.non-interactive { cursor: default; }',
      '.claudeenv .ce-tree-node.non-interactive:hover { background: transparent; color: var(--ink-muted); }',
      '.claudeenv .ce-panel-foot { border-top: 1px solid var(--hairline); padding: 8px 14px; background: rgba(106, 159, 181, 0.04); font-size: 0.72rem; color: #777; line-height: 1.5; }',
      '.claudeenv .ce-panel-foot .star { color: #d97706; }',
      '.claudeenv .ce-tree-totals { border-top: 1px solid var(--line); padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; font-family: var(--font-mono); color: var(--ink-secondary); background: var(--paper-inset); }',
      '.claudeenv .ce-tree-totals .stack { display: flex; flex-direction: column; gap: 2px; }',
      '.claudeenv .ce-tree-totals .label { color: var(--ink-faint); letter-spacing: var(--track-eyebrow); text-transform: uppercase; font-size: var(--size-xs); }',
      '.claudeenv .ce-tree-totals .val { color: var(--ink-primary); font-weight: 600; font-size: 0.85rem; }',
      '.claudeenv .ce-tree-totals .val.on-demand { color: var(--ink-primary); }',
      '.claudeenv .ce-tree-totals .ce-totals-caveat { grid-column: 1 / -1; font-style: italic; font-size: 0.62rem; color: #999; margin-top: 4px; font-family: inherit; line-height: 1.4; }',

      /* Inspector */
      '.claudeenv .ce-inspector { }',
      '.claudeenv .ce-inspector-body { padding: 8px 16px 16px; }',
      '.claudeenv .ce-inspector-layer-crumb { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }',
      '.claudeenv .ce-inspector-layer-dot { width: 8px; height: 8px; border-radius: 50%; }',
      /* Inspector crumb -- back-link to the parent layer (system.faint). */
      '.claudeenv .ce-inspector-layer-label { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; font-weight: 600; background: none; border: none; padding: 0; cursor: pointer; color: var(--ink-faint); }',
      /* viz.row-title at h3 weight: ink-primary, display, h2 (24px). */
      '.claudeenv .ce-inspector h3 { font-family: var(--font-display); font-size: var(--size-h2); font-weight: 500; line-height: var(--lh-snug); letter-spacing: var(--track-snug); color: var(--ink-primary); margin: 0 0 4px; }',
      '.claudeenv .ce-inspector .ce-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.claudeenv .ce-inspector .ce-title-row .fa { color: var(--coral); font-size: 0.95rem; }',
      /* post.body-style description: ink-secondary, display, ~14px, body lh. */
      '.claudeenv .ce-inspector-desc { font-family: var(--font-display); color: var(--ink-secondary); font-size: var(--size-md); line-height: var(--lh-normal); margin: 0 0 10px; }',
      /* Generic pill (legacy) */
      '.claudeenv .ce-inspector-pill { background: var(--paper-inset); border-left: 3px solid var(--coral); padding: 8px 14px; margin-bottom: 10px; font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-secondary); line-height: var(--lh-normal); border-radius: 0 6px 6px 0; }',
      '.claudeenv .ce-inspector-pill.flow { border-left-color: var(--coral-strong); background: var(--coral-wash); }',
      /* viz.callout: coral-wash bg, coral rule, ink-secondary, display, md. */
      '.claudeenv .ce-inspector-pill.aggregation { border-left-color: var(--coral); background: var(--coral-wash); color: var(--ink-secondary); line-height: var(--lh-normal); font-family: var(--font-display); font-size: var(--size-md); }',
      /* Precedence chain: code.chip recipe per element. */
      '.claudeenv .ce-precedence-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-bottom: 12px; font-family: var(--font-mono); font-size: var(--size-smd); }',
      '.claudeenv .ce-precedence-file { background: var(--paper-inset); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font: inherit; font-family: var(--font-mono); font-size: var(--size-sm); cursor: pointer; color: var(--sx-keyword); }',
      '.claudeenv .ce-precedence-file:hover { border-color: var(--coral); color: var(--coral-strong); }',
      '.claudeenv .ce-precedence-sep { color: var(--ink-muted); font-family: var(--font-mono); }',
      /* Token pill (only when section editor is active, see viz.callout). */
      '.claudeenv .ce-inspector-pill.token { border-left-color: var(--coral-strong); background: var(--coral-wash); color: var(--ink-secondary); line-height: var(--lh-normal); font-family: var(--font-display); font-size: var(--size-md); }',
      /* viz.section-label: ink-faint, mono, xs, eyebrow tracking, upper. */
      '.claudeenv .ce-inspector-section-label { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); margin-bottom: 4px; margin-top: 4px; }',
      '.claudeenv .ce-inspector-extended-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }',
      '.claudeenv .ce-inspector-extended-item { border-left: 1px solid var(--line); padding: 2px 0 2px 10px; }',
      '.claudeenv .ce-inspector-extended-item-label { font-family: var(--font-mono); font-size: 0.68rem; color: var(--coral); margin-bottom: 1px; }',
      '.claudeenv .ce-inspector-extended-item-text { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-secondary); line-height: var(--lh-normal); margin: 0; }',
      /* code.block: paper-inset bg, line border, sx-text, mono, smd. */
      '.claudeenv .ce-inspector-example { background: var(--paper-inset); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; font-family: var(--font-mono); font-size: var(--size-smd); color: var(--sx-text); white-space: pre; overflow-x: auto; line-height: 1.55; margin: 0; }',

      /* Layer detail: pyramid list */
      '.claudeenv .ce-pyramid { display: flex; flex-direction: column; gap: 6px; }',
      '.claudeenv .ce-pyramid-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: transparent; cursor: pointer; text-align: left; font: inherit; transition: border-color 0.2s, background 0.2s; }',
      '.claudeenv .ce-pyramid-item:hover { border-color: var(--accent); }',
      '.claudeenv .ce-pyramid-item.first { background: rgba(0,0,0,0.02); }',
      '.claudeenv .ce-pyramid-item .ce-pyramid-num { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.7rem; font-weight: 600; width: 14px; }',
      '.claudeenv .ce-pyramid-item .fa { font-size: 0.82rem; flex-shrink: 0; }',
      '.claudeenv .ce-pyramid-main { flex: 1; min-width: 0; }',
      '.claudeenv .ce-pyramid-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; color: #333; }',
      '.claudeenv .ce-pyramid-priority { font-size: 0.7rem; color: #999; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.claudeenv .ce-pyramid-arrow { color: #bbb; font-size: 0.72rem; }',

      /* Environment-impact summary (default inspector view) */
      /* Environment-impact view (legacy; only the caveat is rendered  */
      /* in the active design, but the stat/bar styles remain hooked   */
      /* in case the section editor is reopened on the empty state).   */
      '.claudeenv .ce-impact-head { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 14px; }',
      '.claudeenv .ce-impact-stat { flex: 1; min-width: 150px; border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; background: var(--paper-inset); }',
      '.claudeenv .ce-impact-stat.on-demand { background: var(--coral-wash); }',
      '.claudeenv .ce-impact-stat-label { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); margin-bottom: 4px; }',
      '.claudeenv .ce-impact-stat-val { font-family: var(--font-mono); font-size: 1.3rem; font-weight: 600; color: var(--ink-primary); }',
      '.claudeenv .ce-impact-stat.on-demand .ce-impact-stat-val { color: var(--coral-strong); }',
      '.claudeenv .ce-impact-stat-sub { font-family: var(--font-text); font-size: 0.7rem; color: var(--ink-muted); margin-top: 2px; }',
      '.claudeenv .ce-impact-bar { display: flex; height: 14px; border-radius: 3px; overflow: hidden; margin-bottom: 8px; background: var(--paper-inset); }',
      '.claudeenv .ce-impact-bar-seg { height: 100%; transition: width 0.25s; }',
      '.claudeenv .ce-impact-legend { display: flex; flex-wrap: wrap; gap: 10px 14px; font-family: var(--font-text); font-size: 0.7rem; color: var(--ink-secondary); margin-bottom: 14px; }',
      '.claudeenv .ce-impact-legend-item { display: inline-flex; align-items: center; gap: 6px; }',
      '.claudeenv .ce-impact-legend-swatch { width: 8px; height: 8px; border-radius: 2px; }',
      '.claudeenv .ce-impact-list { font-family: var(--font-text); font-size: 0.75rem; color: var(--ink-muted); line-height: 1.6; margin: 0; padding-left: 14px; }',
      '.claudeenv .ce-impact-hint { font-family: var(--font-display); font-size: var(--size-md); color: var(--ink-secondary); line-height: var(--lh-normal); background: var(--coral-wash); border-left: 3px solid var(--coral); padding: 10px 14px; border-radius: 0 6px 6px 0; margin-top: 12px; }',
      '.claudeenv .ce-impact-hint .ce-hint-link { color: var(--coral); background: none; border: none; font: inherit; cursor: pointer; text-decoration: underline; padding: 0; }',
      '.claudeenv .ce-impact-caveat { font-family: var(--font-text); font-style: italic; font-size: 0.7rem; color: var(--ink-faint); margin: 14px 0 0; line-height: 1.5; }',

      /* CLAUDE.md section editor -- viz.row recipe per row.            */
      /* The inline-vs-skill ratio bar uses sx-keyword (warm brick) and  */
      /* sx-path (cool stone) to signal weight without re-introducing    */
      /* the cyan accent.                                                */
      '.claudeenv .ce-sections { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }',
      '.claudeenv .ce-section-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper-raised); }',
      '.claudeenv .ce-section-bar { display: flex; height: 8px; border-radius: 3px; overflow: hidden; background: var(--paper-inset); margin: 6px 0 4px; }',
      '.claudeenv .ce-section-bar-inline { background: var(--sx-keyword); transition: width 0.3s; }',
      '.claudeenv .ce-section-bar-skill  { background: var(--sx-path);    transition: width 0.3s; }',
      '.claudeenv .ce-section-row.in-skill { background: var(--paper-inset); border-color: var(--ink-muted); }',
      '.claudeenv .ce-section-row.fixed { opacity: 0.85; }',
      '.claudeenv .ce-section-label { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-primary); min-width: 0; }',
      '.claudeenv .ce-section-label .ce-section-note { display: block; font-family: var(--font-text); font-size: var(--size-xs); color: var(--ink-muted); margin-top: 2px; line-height: 1.4; }',
      '.claudeenv .ce-section-cost { font-family: var(--font-mono); font-size: var(--size-xs); color: var(--sx-keyword); min-width: 56px; text-align: right; white-space: nowrap; }',
      '.claudeenv .ce-section-row.in-skill .ce-section-cost { color: var(--sx-path); }',
      '.claudeenv .ce-section-row.fixed .ce-section-cost { color: var(--ink-faint); }',
      '.claudeenv .ce-section-toggle { display: inline-flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }',
      '.claudeenv .ce-section-toggle button { font-family: var(--font-text); font-size: var(--size-smd); padding: 4px 10px; background: transparent; border: none; cursor: pointer; color: var(--ink-muted); border-right: 1px solid var(--line); }',
      '.claudeenv .ce-section-toggle button:last-child { border-right: none; }',
      '.claudeenv .ce-section-toggle button.on { background: var(--paper-inset); color: var(--ink-primary); font-weight: 600; }',
      '.claudeenv .ce-section-toggle button.on.skill-mode { background: var(--paper-inset); color: var(--ink-primary); }',
      '.claudeenv .ce-section-summary { display: flex; gap: 14px; font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-secondary); margin-top: 6px; flex-wrap: wrap; }',
      '.claudeenv .ce-section-summary .label { color: var(--ink-muted); }',
      '.claudeenv .ce-section-summary .val { font-family: var(--font-mono); color: var(--sx-keyword); font-weight: 600; }',
      '.claudeenv .ce-section-summary .val.on-demand { color: var(--sx-path); }',

      /* Empty state */
      '.claudeenv .ce-inspector-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: var(--ink-muted); }',
      '.claudeenv .ce-inspector-empty .fa { font-size: 1.4rem; color: var(--ink-faint); margin-bottom: 10px; }',
      '.claudeenv .ce-inspector-empty p { font-family: var(--font-text); font-size: var(--size-smd); margin: 0; max-width: 280px; line-height: 1.55; }',
      '.claudeenv .ce-close-btn { color: var(--ink-faint); background: transparent; border: none; cursor: pointer; font-size: 0.85rem; padding: 2px 4px; }',
      '.claudeenv .ce-close-btn:hover { color: var(--ink-primary); }',

      /* Disclosure pattern shared by Inspector + Context panels:        */
      /*   - header doubles as a click target that toggles open/closed   */
      /*   - body has a max-height with vertical scroll when content     */
      /*     exceeds it, so neither panel can push the page layout       */
      /*     around as the user clicks through nodes or toggles files    */
      '.claudeenv .ce-panel-head-toggle { cursor: pointer; user-select: none; transition: background 0.15s; }',
      '.claudeenv .ce-panel-head-toggle:hover { background: var(--paper-inset); }',
      '.claudeenv .ce-panel-chevron { font-size: 0.7rem; color: var(--ink-faint); transition: transform 0.2s; }',
      '.claudeenv .ce-panel-chevron.open { transform: rotate(90deg); }',
      '.claudeenv .ce-panel-body-scroll { height: 440px; overflow-y: auto; }',
      '.claudeenv .ce-panel.collapsed .ce-panel-head { border-bottom-color: transparent; }',

      /* Context panel: visualises the impact of the file checkboxes by  */
      /* showing what actually ends up in scope for the next turn.       */
      '.claudeenv .ce-context { }',
      '.claudeenv .ce-context-body { padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 14px; }',
      '.claudeenv .ce-context-section { display: flex; flex-direction: column; gap: 6px; }',
      '.claudeenv .ce-context-section-head { display: flex; align-items: baseline; gap: 8px; }',
      '.claudeenv .ce-context-hint { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-muted); line-height: var(--lh-normal); margin: 0 0 4px; }',
      '.claudeenv .ce-context-file-label { font-family: var(--font-mono); font-size: var(--size-xs); color: var(--ink-faint); margin-top: 6px; }',
      '.claudeenv .ce-context-file-label:first-child { margin-top: 0; }',
      '.claudeenv .ce-context-snippet { background: var(--paper-inset); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; font-family: var(--font-mono); font-size: var(--size-smd); color: var(--sx-text); white-space: pre; overflow-x: auto; line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-context-empty { font-family: var(--font-text); font-size: var(--size-smd); font-style: italic; color: var(--ink-faint); margin: 0; padding: 6px 0; }',
      '.claudeenv .ce-context-tag { font-family: var(--font-mono); font-size: var(--size-xs); color: var(--ink-faint); }',

      /* Portability note -- viz.callout recipe (coral wash + rule). */
      '.claudeenv .ce-mcp-callout { border-left: 3px solid var(--coral); background: var(--coral-wash); border-radius: 0 6px 6px 0; padding: 12px 14px; margin-top: 16px; }',
      '.claudeenv .ce-mcp-callout-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.claudeenv .ce-mcp-callout-head .fa { color: var(--coral); }',
      '.claudeenv .ce-mcp-callout-head .ce-mcp-label { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--coral); font-weight: 600; }',
      '.claudeenv .ce-mcp-callout p { font-family: var(--font-display); font-size: var(--size-md); color: var(--ink-secondary); line-height: var(--lh-normal); margin: 0; }',
      '.claudeenv .ce-mcp-callout .hl { color: var(--ink-primary); font-weight: 600; }',

      /* Inline markdown -- bold inherits colour; inline code uses code.chip. */
      /* Disco Easter egg */
      '@keyframes ce-disco-pulse { 0% { opacity: 0; transform: scale(0.4); } 50% { opacity: 0.9; transform: scale(1.3); } 100% { opacity: 0.1; transform: scale(0.7); } }',
      '.claudeenv .ce-disco-overlay { position: absolute; top: -150px; left: -80px; right: -80px; height: 560px; pointer-events: none; overflow: hidden; z-index: 50; }',
      '.claudeenv .ce-disco-light { position: absolute; border-radius: 50%; animation: ce-disco-pulse infinite alternate; }',

      /* Editable prompt input */
      '.claudeenv .ce-prompt-input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: inherit; font: inherit; padding: 0; caret-color: var(--coral); }',
      '.claudeenv .ce-prompt-input::placeholder { color: var(--ink-faint); }',

      '.claudeenv .ce-bold { font-weight: 600; }',
      '.claudeenv .ce-code { font-family: var(--font-mono); font-size: 0.82em; background: var(--paper-inset); color: var(--sx-keyword); border: 1px solid var(--line); padding: 1px 6px; border-radius: 999px; }',

      /* Instruction-layer table (🧬 / 🧠 breakdown) */
      '.claudeenv .ce-instr-table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: var(--font-text); font-size: var(--size-smd); margin-bottom: 14px; background: var(--table-body); border: 1px solid var(--table-line); border-radius: 14px; overflow: hidden; }',
      '.claudeenv .ce-instr-table thead { background: var(--table-head); }',
      '.claudeenv .ce-instr-table th { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); padding: 6px 20px; text-align: left; border-bottom: 1px solid var(--table-line); background: transparent; }',
      '.claudeenv .ce-instr-table tbody tr { background: transparent; }',
      '.claudeenv .ce-instr-table td { padding: 12px 20px; color: var(--ink-secondary); border-top: 1px solid var(--table-line); vertical-align: middle; line-height: var(--lh-normal); font-size: var(--size-md); background: transparent; }',
      '.claudeenv .ce-instr-table tr:first-child td { border-top: none; }',
      '.claudeenv .ce-instr-table td:first-child { font-size: 1.05rem; width: 28px; text-align: center; padding-right: 8px; }',
      '.claudeenv .ce-instr-table td:nth-child(2) { font-family: var(--font-mono); font-size: var(--size-smd); color: var(--coral); font-weight: 500; white-space: nowrap; }',

      /* Tips list (memory layer) */
      '.claudeenv .ce-instr-tips { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-secondary); padding-left: 18px; line-height: var(--lh-normal); margin: 0 0 14px; }',

      /* 4-col wide layout: inspector + context height alignment.          */
      /* Higher specificity (.ce-panel.ce-inspector vs .ce-panel) ensures  */
      /* margin-bottom: 0 wins regardless of source order.                 */
      '@media (min-width: 1600px) { .claudeenv .ce-panel.ce-inspector, .claudeenv .ce-panel.ce-context { margin-bottom: 0; box-sizing: border-box; } }'
    ].join('\n');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─────────────────────────── widget build ────────────────────────────

  window.createClaudeEnvironment = function(containerId) {
    injectStyles();

    var root = document.getElementById(containerId);
    if (!root) return;
    root.classList.add('claudeenv');

    // State
    var state = {
      selectedNode: null,
      selectedLayer: null,
      expandedUser: true,
      expandedProject: true,
      // included[id] = false → file is excluded from environment.
      // Default (undefined) is included.
      included: {},
      // sectionMode[sectionId] = 'skill' → section moved out of CLAUDE.md.
      // Default (undefined) is 'inline'.
      sectionMode: {},
      // Disclosure state for the Inspector and Context panels. Both
      // open by default; user can collapse either to a single-line cell.
      inspectorOpen: true,
      contextOpen: true
    };

    function isIncluded(id) { return state.included[id] !== false; }
    function setIncluded(id, val) { state.included[id] = val; rerender(); }
    function setAllIncluded(val) {
      TOGGLEABLE.forEach(function(id) { state.included[id] = val; });
      rerender();
    }
    function sectionMode(sid) { return state.sectionMode[sid] || 'inline'; }
    function setSectionMode(sid, mode) { state.sectionMode[sid] = mode; rerender(); }

    // Token math
    function nodeAlwaysTokens(id) {
      if (!isIncluded(id)) return 0;
      var n = NODES[id];
      if (!n) return 0;
      if (n.sections) {
        return n.sections.reduce(function(sum, s) {
          return sum + (sectionMode(s.id) === 'inline' ? s.tokens : 0);
        }, 0);
      }
      return n.tokens || 0;
    }
    function nodeOnDemandTokens(id) {
      if (!isIncluded(id)) return 0;
      var n = NODES[id];
      if (!n || !n.sections) return 0;
      return n.sections.reduce(function(sum, s) {
        return sum + (sectionMode(s.id) === 'skill' ? (s.skillCost || s.tokens) : 0);
      }, 0);
    }
    function totalAlwaysLoaded() {
      return TOGGLEABLE.reduce(function(t, id) { return t + nodeAlwaysTokens(id); }, 0);
    }
    function totalOnDemand() {
      return TOGGLEABLE.reduce(function(t, id) { return t + nodeOnDemandTokens(id); }, 0);
    }
    function layerAlwaysTokens(layerId) {
      var layer = LAYERS[layerId];
      if (!layer) return 0;
      return layer.nodes.reduce(function(t, id) { return t + nodeAlwaysTokens(id); }, 0);
    }

    function activeLayer() {
      if (state.selectedLayer) return state.selectedLayer;
      if (state.selectedNode && NODES[state.selectedNode]) return NODES[state.selectedNode].layer;
      return null;
    }

    function highlightedNodes() {
      var a = activeLayer();
      return a && LAYERS[a] ? LAYERS[a].nodes : [];
    }

    function selectLayer(id) { state.selectedLayer = id; state.selectedNode = null; rerender(); }
    function selectNode(id)  { state.selectedNode  = id; state.selectedLayer = null; rerender(); }
    function clearSelection() {
      if (state.selectedLayer === null && state.selectedNode === null) return;
      state.selectedLayer = null;
      state.selectedNode = null;
      rerender();
    }

    // Click anywhere outside the widget deselects. The root absorbs all
    // clicks inside the widget so inert text (descriptions, examples,
    // panel chrome) doesn't accidentally clear the current selection.
    document.addEventListener('click', function() {
      clearSelection();
    });
    root.addEventListener('click', function(e) { e.stopPropagation(); });

    function hook(el, fn) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        fn(e);
      });
    }

    var grid = el('div', { class: 'ce-grid' });
    root.appendChild(grid);

    // Prompt is now a grid item. The grid-template-areas controls its
    // placement: spans full width in 2-col mode; spans the bands+filesystem
    // columns in the 4-col wide mode while inspector/context flank the
    // outside columns. This keeps the prompt at its original 2-col width.
    var entryWrap = el('div', { class: 'ce-prompt-wrap' });
    grid.appendChild(entryWrap);

    var leftCol  = el('div', { class: 'ce-bands-col' });
    var rightCol = el('div', { class: 'ce-fs-col', style: 'display: flex; flex-direction: column;' });
    grid.appendChild(leftCol);
    grid.appendChild(rightCol);

    var bandsWrap = el('div', { class: 'ce-bands' });
    leftCol.appendChild(bandsWrap);

    // Right column: file tree only (now full-height, with checkboxes)
    var treePanel = el('div', { class: 'ce-panel ce-tree-panel' });
    var treeHead = el('div', { class: 'ce-panel-head' });
    treeHead.appendChild(el('span', { class: 'ce-panel-head-label' }, 'Filesystem'));
    treePanel.appendChild(treeHead);

    var treeBody = el('div', { class: 'ce-tree' });
    treePanel.appendChild(treeBody);

    rightCol.appendChild(treePanel);

    // Inspector and context are direct grid children.
    // In 2-col mode they span the full row (grid-column: 1/-1).
    // In the 4-col wide layout each becomes its own column.
    var inspectorPanel = el('div', { class: 'ce-panel ce-inspector' });
    grid.appendChild(inspectorPanel);

    var contextPanel = el('div', { class: 'ce-panel ce-context' });
    grid.appendChild(contextPanel);

    // Portability note (full width, subdued slate, anchors the bottom)
    var mcpCallout = el('div', { class: 'ce-mcp-callout' }, [
      el('div', { class: 'ce-mcp-callout-head' }, [
        fa('server'),
        el('span', { class: 'ce-mcp-label' }, 'Portability note')
      ]),
      (function() {
        var p = el('p', null, 'Of all these components, ');
        p.appendChild(el('span', { class: 'hl' }, 'only MCP is portable'));
        p.appendChild(document.createTextNode('. Everything else, CLAUDE.md, skills, hooks, agents, is a Claude Code convention.'));
        return p;
      })()
    ]);
    root.appendChild(mcpCallout);

    // Layer 0 (entry) renders as its own full-width row above the grid; the
    // remaining layers stack inside the grid's left column.
    var LAYER_ORDER = ['memory', 'config', 'tools', 'invocable', 'delegation', 'automation', 'external', 'state'];

    // ─────────────────────────── render funcs ──────────────────────────

    function layerLabelNodes(label) {
      var m = label.match(/^(\d+\.) (.+)/);
      if (!m) return [document.createTextNode(label)];
      return [el('span', { class: 'ce-band-num' }, m[1]), document.createTextNode(' ' + m[2])];
    }

    var ENTRY_PROMPT = 'convert the image to grayscale';
    var entryTypewriterDone = false;
    var promptText = '';
    var discoActive = false;

    function triggerDisco() {
      if (discoActive) return;
      discoActive = true;
      var overlay = el('div', { class: 'ce-disco-overlay' });
      root.appendChild(overlay);

      var W = overlay.offsetWidth;
      var H = overlay.offsetHeight;
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      canvas.style.cssText = 'position:absolute;top:0;left:0;display:block;';
      overlay.appendChild(canvas);
      var ctx = canvas.getContext('2d');

      // Grid of small tiles, each with a fixed vivid colour
      var TILE = 16, GAP = 3, STEP = TILE + GAP;
      var cols = Math.ceil(W / STEP) + 1;
      var rows = Math.ceil(H / STEP) + 1;
      var PALETTE = [
        [255, 30, 100], [255, 110, 0], [230, 210, 0],
        [0, 210, 80],   [0, 185, 255], [60, 80, 255],
        [180, 0, 255],  [255, 0, 195],
      ];
      var tileCol = [];
      // Per-tile vignette radius multiplier: wide range so the falloff edge is ragged.
      var tileRadMult = [];
      // Per-tile brightness cap: limits how bright each tile can get even when fully
      // in a beam, so illuminated areas stay varied rather than uniformly saturated.
      var tileBrightCap = [];
      for (var ti = 0; ti < rows * cols; ti++) {
        tileCol.push(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
        tileRadMult.push(0.45 + Math.random() * 0.9);
        tileBrightCap.push(0.25 + Math.random() * 0.75);
      }

      // Angles offset 45° from cardinal axes so no horizontal/vertical bands dominate.
      // Alternating speed signs mean bands travel in opposing directions.
      var beams = [
        { angle: 0.25 * Math.PI + (Math.random() - 0.5) * 0.5, phase: Math.random() * Math.PI * 2, speed:  0.55, rotSpeed:  0.11 },
        { angle: 0.75 * Math.PI + (Math.random() - 0.5) * 0.5, phase: Math.random() * Math.PI * 2, speed: -0.40, rotSpeed: -0.09 },
        { angle: 1.25 * Math.PI + (Math.random() - 0.5) * 0.5, phase: Math.random() * Math.PI * 2, speed:  0.60, rotSpeed:  0.07 },
        { angle: 1.75 * Math.PI + (Math.random() - 0.5) * 0.5, phase: Math.random() * Math.PI * 2, speed: -0.48, rotSpeed: -0.13 },
      ];

      var DURATION = 5.0, FADE_START = 4.2;
      var startTime = performance.now();
      var raf;

      function frame(now) {
        var elapsed = (now - startTime) / 1000;
        var globalAlpha = elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (DURATION - FADE_START)) : 1;

        var dt = 1 / 60;
        for (var bi = 0; bi < beams.length; bi++) {
          beams[bi].phase += beams[bi].speed * dt;
          beams[bi].angle += beams[bi].rotSpeed * dt;
        }

        ctx.clearRect(0, 0, W, H);

        // Radial centre: horizontally centred, 35% down the overlay
        // (which sits 150px above the widget, so this lands on the intro paragraph)
        var centerX = W / 2, centerY = H * 0.35;
        var maxDist = Math.sqrt(centerX * centerX + H * H); // diagonal to corner

        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var tx = c * STEP, ty = r * STEP;
            var cx = tx + TILE / 2, cy = ty + TILE / 2;

            // Radial falloff with per-tile radius jitter — breaks the hard edge.
            // Higher power (3.5) makes edges fall off more steeply.
            var dx = cx - centerX, dy = cy - centerY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var effectiveMax = maxDist * tileRadMult[r * cols + c];
            var radial = Math.pow(Math.max(0, 1 - dist / effectiveMax), 3.5);

            var idx = r * cols + c;
            var cap = tileBrightCap[idx];
            var bright = 0.06 * cap;
            for (var bi = 0; bi < beams.length; bi++) {
              var b = beams[bi];
              var proj = cx * Math.cos(b.angle) + cy * Math.sin(b.angle);
              var w = Math.pow(Math.max(0, Math.sin(proj * 0.11 + b.phase)), 4);
              bright = Math.max(bright, (0.06 + w * 0.5) * cap);
            }

            var col = tileCol[idx];
            var alpha = bright * radial * globalAlpha;
            if (alpha > 0.005) {
              ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')';
              ctx.fillRect(tx, ty, TILE, TILE);
            }
          }
        }

        if (elapsed < DURATION) {
          raf = requestAnimationFrame(frame);
        }
      }

      raf = requestAnimationFrame(frame);
      setTimeout(function() {
        cancelAnimationFrame(raf);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        discoActive = false;
      }, (DURATION + 0.2) * 1000);
    }

    function renderEntryBand() {
      entryWrap.innerHTML = '';
      var prompt = el('div', { class: 'role-code-prompt', style: 'display:flex;gap:8px;padding:16px 18px;align-items:center;' });
      prompt.appendChild(el('span', { class: 'role-code-prompt-glyph', style: 'user-select:none;flex-shrink:0' }, 'claude>'));
      var input = el('input', {
        type: 'text',
        class: 'ce-prompt-input',
        maxlength: '250',
        placeholder: 'In search of...',
        'aria-label': 'Prompt'
      });
      input.value = promptText;
      input.addEventListener('input', function(e) {
        promptText = e.target.value;
        if (promptText.toLowerCase().includes('disco')) triggerDisco();
      });
      input.addEventListener('click', function(e) { e.stopPropagation(); });
      prompt.appendChild(input);
      entryWrap.appendChild(prompt);

      if (!entryTypewriterDone) {
        entryTypewriterDone = true;
        var i = 0;
        var t = setInterval(function() {
          if (i <= ENTRY_PROMPT.length) {
            promptText = ENTRY_PROMPT.slice(0, i++);
            input.value = promptText;
          } else {
            clearInterval(t);
          }
        }, 35);
      }
    }

    function renderBands() {
      bandsWrap.innerHTML = '';
      var a = activeLayer();
      LAYER_ORDER.forEach(function(id) {
        var layer = LAYERS[id];
        var band = el('button', { class: 'ce-band' + (a === id ? ' active' : a && a !== id ? ' dimmed' : ''), type: 'button', 'data-layer': id });
        hook(band, function() { selectLayer(id); });
        if (layer.badge) {
          var titleRow = el('span', { class: 'ce-band-title', style: 'display:flex;justify-content:space-between;align-items:baseline;' });
          var labelWrap = el('span', null, layerLabelNodes(layer.label));
          titleRow.appendChild(labelWrap);
          titleRow.appendChild(el('span', { style: 'font-family:var(--font-text);letter-spacing:0;font-size:var(--size-md);' }, layer.badge));
          band.appendChild(titleRow);
        } else {
          band.appendChild(el('span', { class: 'ce-band-title' }, layerLabelNodes(layer.label)));
        }
        band.appendChild(el('span', { class: 'ce-band-sublabel' }, layer.sublabel));
        bandsWrap.appendChild(band);
      });
    }

    function renderTree() {
      treeBody.innerHTML = '';
      var hi = highlightedNodes();

      function fileRow(id, label, iconName, indent, isDir) {
        var node = NODES[id];
        var highlighted = hi.indexOf(id) !== -1;
        var selected = state.selectedNode === id;
        var included = isIncluded(id);
        var layerColor = node && LAYERS[node.layer] ? LAYERS[node.layer].color : '#aaa';

        var row = el('div', { class: 'ce-tree-row', style: 'padding-left: ' + (indent * 14) + 'px;' });

        var check = el('input', { type: 'checkbox', class: 'ce-tree-check' });
        check.checked = included;
        check.addEventListener('click', function(e) { e.stopPropagation(); });
        check.addEventListener('change', function(e) {
          e.stopPropagation();
          setIncluded(id, e.target.checked);
        });
        row.appendChild(check);

        var classes = 'ce-tree-node';
        if (isDir) classes += ' dir';
        if (selected) classes += ' selected';
        if (highlighted && !selected) classes += ' highlighted';
        if (!included) classes += ' excluded';

        var btn = el('button', { class: classes, type: 'button' });
        hook(btn, function() { selectNode(id); });
        if (highlighted && !selected) {
          btn.appendChild(el('span', { class: 'ce-layer-dot', style: 'background: rgba(0,0,0,0.35); left: 0;' }));
        }
        btn.appendChild(fa(iconName));
        btn.appendChild(el('span', { class: 'ce-label' }, label));
        row.appendChild(btn);

        return row;
      }

      // ~/.claude/ root
      var userRoot = el('button', { class: 'ce-tree-root', type: 'button' }, [
        el('span', { class: 'fa fa-chevron-right ce-chevron' + (state.expandedUser ? ' open' : '') }),
        el('span', { class: 'fa fa-home ce-home' }),
        el('span', { class: 'ce-label' }, '~/.claude/'),
        el('span', { class: 'ce-scope' }, 'user-level')
      ]);
      hook(userRoot, function() { state.expandedUser = !state.expandedUser; rerender(); });
      treeBody.appendChild(userRoot);

      if (state.expandedUser) {
        var userChildren = el('div', { class: 'ce-tree-children' });
        userChildren.appendChild(fileRow('claude-md-global', 'CLAUDE.md', 'file-text-o', 1));
        userChildren.appendChild(fileRow('settings-global', 'settings.json', 'cog', 1));
        userChildren.appendChild(fileRow('sessions', 'projects/', 'folder-o', 1, true));
        treeBody.appendChild(userChildren);
      }

      treeBody.appendChild(el('div', { class: 'ce-tree-spacer' }));

      // your-project/
      var projectRoot = el('button', { class: 'ce-tree-root', type: 'button' }, [
        el('span', { class: 'fa fa-chevron-right ce-chevron' + (state.expandedProject ? ' open' : '') }),
        el('span', { class: 'fa fa-folder ce-folder' }),
        el('span', { class: 'ce-label' }, 'your-project/'),
        el('span', { class: 'ce-scope' }, 'project-level')
      ]);
      hook(projectRoot, function() { state.expandedProject = !state.expandedProject; rerender(); });
      treeBody.appendChild(projectRoot);

      if (state.expandedProject) {
        var projectChildren = el('div', { class: 'ce-tree-children' });
        projectChildren.appendChild(fileRow('claude-md-project', 'CLAUDE.md', 'file-text-o', 1));
        projectChildren.appendChild(fileRow('claude-local', 'CLAUDE.local.md', 'file-text-o', 1));
        // `.mcp.json` and `.worktreeinclude` live at the project root,
        // not inside `.claude/`. Indent 1 keeps that hierarchy honest.
        projectChildren.appendChild(fileRow('mcp', '.mcp.json', 'server', 1));
        projectChildren.appendChild(fileRow('worktreeinclude', '.worktreeinclude', 'file-text-o', 1));
        // `.claude/` is non-selectable but should mirror other folder rows.
        // Use the same `.ce-tree-row` + `.ce-tree-node.dir` structure with a
        // checkbox spacer so the icon aligns with peer files at indent 1.
        var claudeRow = el('div', { class: 'ce-tree-row', style: 'padding-left: 14px;' });
        claudeRow.appendChild(el('span', { class: 'ce-tree-check-spacer' }));
        var claudeNode = el('div', { class: 'ce-tree-node dir non-interactive' });
        claudeNode.appendChild(fa('folder-o'));
        claudeNode.appendChild(el('span', { class: 'ce-label' }, '.claude/'));
        claudeRow.appendChild(claudeNode);
        projectChildren.appendChild(claudeRow);
        projectChildren.appendChild(fileRow('settings-project', 'settings.json', 'cog', 2));
        projectChildren.appendChild(fileRow('settings-local', 'settings.local.json', 'cog', 2));
        projectChildren.appendChild(fileRow('rules', 'rules/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('commands', 'commands/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('skills', 'skills/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('agents', 'agents/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('hooks', 'hooks/', 'folder-o', 2, true));
        treeBody.appendChild(projectChildren);
      }

      // Bulk-select footer: sits below all rows.
      // checked = all included, unchecked = none, indeterminate = mixed.
      var allIncluded = TOGGLEABLE.every(isIncluded);
      var someIncluded = TOGGLEABLE.some(isIncluded);
      var bulkRow = el('div', { class: 'ce-tree-row', style: 'padding: 8px 14px 6px; border-top: 1px solid var(--line); margin-top: auto; gap: 8px;' });
      var bulkCheck = el('input', { type: 'checkbox', class: 'ce-tree-check', style: 'margin-left: 0;' });
      bulkCheck.checked = allIncluded;
      bulkCheck.indeterminate = someIncluded && !allIncluded;
      bulkCheck.addEventListener('click', function(e) { e.stopPropagation(); });
      bulkCheck.addEventListener('change', function(e) {
        e.stopPropagation();
        setAllIncluded(e.target.checked);
      });
      var bulkLabel = el('span', {
        style: 'font-family:var(--font-mono);font-size:var(--size-xs);letter-spacing:var(--track-eyebrow);text-transform:uppercase;color:var(--ink-faint);cursor:pointer;user-select:none;'
      }, allIncluded ? 'Select None' : 'Select All');
      bulkLabel.addEventListener('click', function(e) {
        e.stopPropagation();
        setAllIncluded(!TOGGLEABLE.every(isIncluded));
      });
      bulkRow.appendChild(bulkCheck);
      bulkRow.appendChild(bulkLabel);
      treeBody.appendChild(bulkRow);
    }


    function renderImpactSummary(parent) {
      // Stats row
      var head = el('div', { class: 'ce-impact-head' });
      var always = totalAlwaysLoaded();
      var onDemand = totalOnDemand();

      head.appendChild(el('div', { class: 'ce-impact-stat' }, [
        el('div', { class: 'ce-impact-stat-label' }, 'Always loaded'),
        el('div', { class: 'ce-impact-stat-val' }, fmtTokens(always) + ' t'),
        el('div', { class: 'ce-impact-stat-sub' }, 'enters every session’s system prompt')
      ]));
      head.appendChild(el('div', { class: 'ce-impact-stat on-demand' }, [
        el('div', { class: 'ce-impact-stat-label' }, 'On-demand pool'),
        el('div', { class: 'ce-impact-stat-val' }, fmtTokens(onDemand) + ' t'),
        el('div', { class: 'ce-impact-stat-sub' }, 'loads only when triggered')
      ]));
      parent.appendChild(head);

      // Stacked bar by layer
      if (always > 0) {
        var bar = el('div', { class: 'ce-impact-bar' });
        var legend = el('div', { class: 'ce-impact-legend' });
        LAYER_ORDER.forEach(function(lid) {
          var layer = LAYERS[lid];
          var t = layerAlwaysTokens(lid);
          if (t <= 0) return;
          var pct = (t / always) * 100;
          bar.appendChild(el('div', {
            class: 'ce-impact-bar-seg',
            style: 'width: ' + pct.toFixed(2) + '%; background: ' + layer.color + ';',
            title: layer.label.replace(/^\d+\. /, '') + ': ' + fmtTokens(t) + ' tokens'
          }));
          legend.appendChild(el('span', { class: 'ce-impact-legend-item' }, [
            el('span', { class: 'ce-impact-legend-swatch', style: 'background: ' + layer.color }),
            el('span', null, layer.label.replace(/^\d+\. /, '') + ' · ' + fmtTokens(t) + 't')
          ]));
        });
        parent.appendChild(bar);
        parent.appendChild(legend);
      }

      // Excluded list
      var excluded = TOGGLEABLE.filter(function(id) { return !isIncluded(id); });
      if (excluded.length > 0) {
        parent.appendChild(el('div', { class: 'ce-inspector-section-label' }, 'Excluded from environment'));
        var list = el('ul', { class: 'ce-impact-list' });
        excluded.forEach(function(id) {
          var n = NODES[id];
          var t = n.sections
            ? n.sections.reduce(function(s, sec) { return s + sec.tokens; }, 0)
            : (n.tokens || 0);
          list.appendChild(el('li', null, n.label + (t > 0 ? ' - was ' + fmtTokens(t) + ' tokens' : '')));
        });
        parent.appendChild(list);
      }

      // Hint about CLAUDE.md sections
      var sectionsMoved = 0;
      var sectionsTotal = 0;
      var cmd = NODES['claude-md-project'];
      if (cmd && cmd.sections) {
        cmd.sections.forEach(function(s) {
          if (s.fixed) return;
          sectionsTotal++;
          if (sectionMode(s.id) === 'skill') sectionsMoved++;
        });
      }
      var hint = el('div', { class: 'ce-impact-hint' });
      if (sectionsMoved === 0) {
        hint.appendChild(document.createTextNode('Tip: open '));
        var link = el('button', { class: 'ce-hint-link', type: 'button' }, 'CLAUDE.md (project)');
        hook(link, function() { selectNode('claude-md-project'); });
        hint.appendChild(link);
        hint.appendChild(document.createTextNode(' to move sections into skills - they’ll only load when triggered, not in every session.'));
      } else {
        hint.appendChild(document.createTextNode(sectionsMoved + ' of ' + sectionsTotal + ' movable CLAUDE.md sections are deferred to skills. Open '));
        var link2 = el('button', { class: 'ce-hint-link', type: 'button' }, 'CLAUDE.md (project)');
        hook(link2, function() { selectNode('claude-md-project'); });
        hint.appendChild(link2);
        hint.appendChild(document.createTextNode(' to revisit.'));
      }
      parent.appendChild(hint);
    }

    function renderSectionEditor(parent, node) {
      parent.appendChild(el('div', { class: 'ce-inspector-section-label' }, 'Sections - choose where each lives'));

      // Roll-up totals so the user can see the impact of moving sections.
      var inlineSum = 0;
      var skillSum = 0;
      node.sections.forEach(function(s) {
        if (sectionMode(s.id) === 'inline') inlineSum += s.tokens;
        else skillSum += (s.skillCost || s.tokens);
      });
      var totalTokens = inlineSum + skillSum;

      var summary = el('div', { class: 'ce-section-summary' });
      summary.appendChild(el('span', null, [
        el('span', { class: 'label' }, 'Inline (always loaded): '),
        el('span', { class: 'val' }, fmtTokens(inlineSum) + ' tokens')
      ]));
      summary.appendChild(el('span', null, [
        el('span', { class: 'label' }, 'In skills (on-demand): '),
        el('span', { class: 'val on-demand' }, fmtTokens(skillSum) + ' tokens')
      ]));
      parent.appendChild(summary);

      // Visual ratio: inline vs skill split.
      if (totalTokens > 0) {
        var inlinePct = (inlineSum / totalTokens) * 100;
        var bar = el('div', { class: 'ce-section-bar' });
        bar.appendChild(el('div', {
          class: 'ce-section-bar-inline',
          style: 'width: ' + inlinePct.toFixed(2) + '%;',
          title: 'Inline: ' + fmtTokens(inlineSum) + ' t'
        }));
        bar.appendChild(el('div', {
          class: 'ce-section-bar-skill',
          style: 'width: ' + (100 - inlinePct).toFixed(2) + '%;',
          title: 'Skill: ' + fmtTokens(skillSum) + ' t'
        }));
        parent.appendChild(bar);
      }

      var sectionsWrap = el('div', { class: 'ce-sections', style: 'margin-top: 8px;' });
      node.sections.forEach(function(s) {
        var mode = sectionMode(s.id);
        var rowClass = 'ce-section-row';
        if (mode === 'skill') rowClass += ' in-skill';
        if (s.fixed) rowClass += ' fixed';
        var row = el('div', { class: rowClass });

        var labelCell = el('div', { class: 'ce-section-label' });
        labelCell.appendChild(document.createTextNode(s.label));
        if (s.fixed) {
          labelCell.appendChild(el('span', { class: 'ce-section-note' }, s.fixedNote || 'Stays inline.'));
        } else if (mode === 'skill' && s.skillTarget) {
          var note = el('span', { class: 'ce-section-note' });
          note.appendChild(document.createTextNode('Now lives in: '));
          note.appendChild(renderDescription(s.skillTarget));
          labelCell.appendChild(note);
        } else if (s.skillTarget) {
          var note2 = el('span', { class: 'ce-section-note' });
          note2.appendChild(document.createTextNode('Could move to: '));
          note2.appendChild(renderDescription(s.skillTarget));
          labelCell.appendChild(note2);
        }
        row.appendChild(labelCell);

        var costStr;
        if (mode === 'inline') costStr = fmtTokens(s.tokens) + ' t';
        else costStr = '+' + fmtTokens(s.skillCost || s.tokens) + ' t';
        row.appendChild(el('div', { class: 'ce-section-cost' }, costStr));

        var toggle = el('div', { class: 'ce-section-toggle' });
        var inlineBtn = el('button', { type: 'button', class: mode === 'inline' ? 'on' : '' }, 'Inline');
        var skillBtn = el('button', { type: 'button', class: mode === 'skill' ? 'on skill-mode' : '' }, '→ Skill');
        if (s.fixed) {
          skillBtn.disabled = true;
          skillBtn.style.cursor = 'not-allowed';
          skillBtn.style.opacity = '0.4';
        } else {
          hook(inlineBtn, function() { setSectionMode(s.id, 'inline'); });
          hook(skillBtn, function() { setSectionMode(s.id, 'skill'); });
        }
        if (s.fixed) hook(inlineBtn, function() {});
        toggle.appendChild(inlineBtn);
        toggle.appendChild(skillBtn);
        row.appendChild(toggle);

        sectionsWrap.appendChild(row);
      });
      parent.appendChild(sectionsWrap);

      parent.appendChild(el('p', { class: 'ce-impact-caveat' },
        'Token estimates are for illustrative purposes only.'));
    }

    // ────────────────────────── context panel ───────────────────────────
    //
    // Visualises the impact of the file-tree checkboxes. Four buckets,
    // each tied to a directive in the official docs:
    //
    //  1. Aggregated text  - CLAUDE.md files concatenated in read order
    //                        (filesystem root → working dir, .local
    //                        appended after .md), plus auto-memory
    //                        MEMORY.md when included.
    //  2. Settings         - permissions/model/etc. merged across the
    //                        included scopes. Arrays union; scalars
    //                        override (highest scope wins).
    //  3. Subagents        - the descriptions Claude can dispatch on,
    //                        loaded with the agents/ folder.
    //  4. Hooks            - tool-lifecycle scripts that fire when
    //                        their matchers hit.
    //
    // Order mirrors the precedence in the docs. Excluded items render
    // an empty-state line so the user can see the consequence of a
    // checkbox flip without scrolling back up.

    // Files contributing to the merged instruction stream, in read order.
    var INSTRUCTION_REFS = [
      { id: 'claude-md-global',  label: '~/.claude/CLAUDE.md' },
      { id: 'claude-md-project', label: './CLAUDE.md' },
      { id: 'claude-local',      label: './CLAUDE.local.md' },
      { id: 'rules',             label: '.claude/rules/' },
      { id: 'sessions',          label: '~/.claude/projects/<project>/memory/MEMORY.md' }
    ];

    var SETTINGS_REFS = [
      { id: 'settings-global',  label: '~/.claude/settings.json' },
      { id: 'settings-project', label: '.claude/settings.json' },
      { id: 'settings-local',   label: '.claude/settings.local.json' }
    ];

    // Best-effort JSON parse of a node's example. Examples are hand-
    // written illustrative snippets, so the parse may fail; treat that
    // as "nothing to merge" rather than throwing.
    function parseSettingsExample(id) {
      var n = NODES[id];
      if (!n || !n.example) return null;
      try { return JSON.parse(n.example); } catch (e) { return null; }
    }

    // Merge per the settings doc:
    //  - arrays concatenated and deduplicated across scopes
    //  - scalars and nested objects: higher-precedence scope wins
    // Iterate from lowest to highest precedence so later writes overwrite.
    function mergeSettings(includedRefs) {
      var out = {};
      includedRefs.forEach(function(ref) {
        var obj = parseSettingsExample(ref.id);
        if (!obj) return;
        deepMergeInto(out, obj);
      });
      return out;
    }

    function deepMergeInto(target, source) {
      for (var k in source) {
        if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
        var v = source[k];
        if (Array.isArray(v)) {
          var existing = Array.isArray(target[k]) ? target[k] : [];
          var merged = existing.concat(v);
          // Dedupe primitives; objects pass through unchanged.
          var seen = {};
          target[k] = merged.filter(function(item) {
            if (typeof item !== 'string' && typeof item !== 'number') return true;
            var key = typeof item + ':' + item;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
          });
        } else if (v && typeof v === 'object') {
          target[k] = deepMergeInto(
            (target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) ? target[k] : {},
            v
          );
        } else {
          target[k] = v;
        }
      }
      return target;
    }

    function makeSection(label, hint) {
      var s = el('div', { class: 'ce-context-section' });
      s.appendChild(el('div', { class: 'ce-inspector-section-label' }, label));
      if (hint) {
        var p = el('p', { class: 'ce-context-hint' });
        p.appendChild(renderDescription(hint));
        s.appendChild(p);
      }
      return s;
    }

    function emptyLine(text) {
      return el('p', { class: 'ce-context-empty' }, text);
    }

    function renderContext() {
      contextPanel.innerHTML = '';
      contextPanel.classList.toggle('collapsed', !state.contextOpen);

      var head = el('div', { class: 'ce-panel-head ce-panel-head-toggle' }, [
        el('span', { class: 'ce-panel-head-label' }, 'Context'),
        el('span', { class: 'fa fa-chevron-right ce-panel-chevron' + (state.contextOpen ? ' open' : '') })
      ]);
      hook(head, function() {
        state.contextOpen = !state.contextOpen;
        rerender();
      });
      contextPanel.appendChild(head);

      if (!state.contextOpen) return;

      var body = el('div', { class: 'ce-context-body ce-panel-body-scroll' });
      contextPanel.appendChild(body);

      // 1. Aggregated text -- what enters the system prompt as instructions.
      var instr = makeSection(
        'Instructions in context',
        'Concatenated in this read order. Loaded into the system prompt at session start; the docs note Claude `may pick one arbitrarily` when files conflict.'
      );
      var anyInstr = false;
      INSTRUCTION_REFS.forEach(function(ref) {
        if (!isIncluded(ref.id)) return;
        var n = NODES[ref.id];
        if (!n || !n.example) return;
        anyInstr = true;
        instr.appendChild(el('div', { class: 'ce-context-file-label' }, ref.label));
        instr.appendChild(el('pre', { class: 'ce-context-snippet' }, n.example));
      });
      if (!anyInstr) instr.appendChild(emptyLine('No instruction files included. Claude starts with the built-in system prompt only.'));
      body.appendChild(instr);

      // 2. Settings -- merged config across included scopes.
      var settings = makeSection(
        'Settings (runtime, not in context)',
        'Arrays like `permissions.allow`/`deny` concatenate and dedupe across scopes; scalars take the highest-precedence value. Governs what Claude can do; never enters the system prompt.'
      );
      var includedSettings = SETTINGS_REFS.filter(function(r) { return isIncluded(r.id); });
      if (includedSettings.length === 0) {
        settings.appendChild(emptyLine('No settings files included. Claude Code falls back to its built-in defaults.'));
      } else {
        var merged = mergeSettings(includedSettings);
        if (Object.keys(merged).length === 0) {
          settings.appendChild(emptyLine('Included settings files contain no overrides.'));
        } else {
          settings.appendChild(el('div', { class: 'ce-context-file-label' },
            'merged from ' + includedSettings.map(function(r) { return r.label; }).join(' + ')));
          settings.appendChild(el('pre', { class: 'ce-context-snippet' },
            JSON.stringify(merged, null, 2)));
        }
      }
      body.appendChild(settings);

      // 3. Subagents -- triggerable via @-mention or description match.
      var agents = makeSection(
        'Triggerable subagents',
        'Each agent\'s frontmatter `description` sits in the parent system prompt so Claude can dispatch. The body becomes the subagent\'s own system prompt and runs in a fresh context window.'
      );
      if (isIncluded('agents') && NODES.agents && NODES.agents.example) {
        agents.appendChild(el('div', { class: 'ce-context-file-label' }, '.claude/agents/'));
        agents.appendChild(el('pre', { class: 'ce-context-snippet' }, NODES.agents.example));
      } else {
        agents.appendChild(emptyLine('.claude/agents/ excluded. No subagents available; everything runs in the main context window.'));
      }
      body.appendChild(agents);

      // 4. Hooks -- shell-side triggers on tool lifecycle events.
      var hooks = makeSection(
        'Active hooks',
        'Configured in `settings.json` (or `hooks/`); fire deterministically on tool lifecycle events (`PreToolUse`, `PostToolUse`, `SubagentStop`, etc.). Run shell-side, never enter the system prompt.'
      );
      if (isIncluded('hooks') && NODES.hooks && NODES.hooks.example) {
        hooks.appendChild(el('div', { class: 'ce-context-file-label' }, '.claude/hooks/ (or settings.json `hooks` key)'));
        hooks.appendChild(el('pre', { class: 'ce-context-snippet' }, NODES.hooks.example));
      } else {
        hooks.appendChild(emptyLine('hooks/ excluded. Tool calls run without any pre/post automation.'));
      }
      body.appendChild(hooks);
    }

    function renderInspector() {
      inspectorPanel.innerHTML = '';
      inspectorPanel.classList.toggle('collapsed', !state.inspectorOpen);

      var head = el('div', { class: 'ce-panel-head ce-panel-head-toggle' }, [
        el('span', { class: 'ce-panel-head-label' }, 'Inspector'),
        el('span', { class: 'fa fa-chevron-right ce-panel-chevron' + (state.inspectorOpen ? ' open' : '') })
      ]);
      hook(head, function() {
        state.inspectorOpen = !state.inspectorOpen;
        rerender();
      });
      inspectorPanel.appendChild(head);

      if (!state.inspectorOpen) return;

      var body = el('div', { class: 'ce-inspector-body ce-panel-body-scroll' });
      inspectorPanel.appendChild(body);

      // Empty state → simple help message.
      if (!state.selectedNode && !state.selectedLayer) {
        body.appendChild(el('div', { class: 'ce-inspector-empty' }, [
          el('p', null, 'Click a layer band to see how its files combine, or click a file in the tree to inspect it directly.')
        ]));
        return;
      }

      // Layer view
      if (state.selectedLayer) {
        var layer = LAYERS[state.selectedLayer];

        if (state.selectedLayer === 'memory') {
          // Tips first (no heading)
          var tips = el('ul', { class: 'ce-instr-tips' });
          ['<200 lines',
           'Conventions, common commands, architecture',
           'Adherence to instruction ∝ specific/concise nature of instruction'
          ].forEach(function(tip) { tips.appendChild(el('li', null, tip)); });
          body.appendChild(tips);

          // "Instructions can be viewed as" styled like a description paragraph
          var intro = el('p', { class: 'ce-inspector-desc' }, 'Instructions can be viewed as');
          body.appendChild(intro);

          var tbl = el('table', { class: 'ce-instr-table' });
          var thead = el('thead');
          thead.appendChild(el('tr', null, [
            el('th', null, ''),
            el('th', null, 'File'),
            el('th', null, 'Conceptual'),
            el('th', null, 'Controlled By')
          ]));
          tbl.appendChild(thead);
          var tbody = el('tbody');
          [
            { icon: '🧬', file: 'CLAUDE.md', concept: 'Mechanism to guide behaviour', by: 'User 👨🏾‍💻' },
            { icon: '🧠', file: 'MEMORY.md', concept: 'Accumulated knowledge through experience', by: '🤖' }
          ].forEach(function(row) {
            tbody.appendChild(el('tr', null, [
              el('td', null, row.icon),
              el('td', null, row.file),
              el('td', null, row.concept),
              el('td', null, row.by)
            ]));
          });
          tbl.appendChild(tbody);
          body.appendChild(tbl);
        } else {
          body.appendChild(el('h3', null, layer.sublabel));
          var desc = el('p', { class: 'ce-inspector-desc' });
          desc.appendChild(renderDescription(layer.description));
          body.appendChild(desc);
        }

        // Precedence chain (only for layers with multiple ordered files, not memory)
        if (state.selectedLayer !== 'memory' && layer.precedenceFiles && layer.precedenceFiles.length > 1) {
          body.appendChild(el('div', { class: 'ce-inspector-section-label' }, 'Precedence (highest → lowest)'));
          var chain = el('div', { class: 'ce-precedence-chain' });
          layer.precedenceFiles.forEach(function(fid, idx) {
            if (idx > 0) chain.appendChild(el('span', { class: 'ce-precedence-sep' }, '>'));
            var btn = el('button', { type: 'button', class: 'ce-precedence-file' }, NODES[fid].label);
            hook(btn, function() { selectNode(fid); });
            chain.appendChild(btn);
          });
          body.appendChild(chain);
        }

        // Aggregation behaviour
        if (layer.aggregation) {
          body.appendChild(el('div', { class: 'ce-inspector-section-label' }, 'How files in this layer combine'));
          var agg = el('div', { class: 'ce-inspector-pill aggregation' });
          agg.appendChild(renderDescription(layer.aggregation));
          body.appendChild(agg);
        }

        // Concrete interaction example (aggregation + override demonstration)
        if (layer.interactionExample) {
          body.appendChild(el('div', { class: 'ce-inspector-section-label' }, 'Worked example'));
          body.appendChild(el('pre', { class: 'ce-inspector-example' }, layer.interactionExample));
        }


        return;
      }

      // Node view
      var node = NODES[state.selectedNode];
      var pLayer = LAYERS[node.layer];
      var crumb = el('div', { class: 'ce-inspector-layer-crumb' });
      var layerLink = el('button', { class: 'ce-inspector-layer-label', type: 'button' },
        '← ' + pLayer.label);
      hook(layerLink, function() { selectLayer(node.layer); });
      crumb.appendChild(layerLink);
      body.appendChild(crumb);

      body.appendChild(el('div', { class: 'ce-title-row' }, [
        fa(node.icon),
        el('h3', null, node.title)
      ]));

      var desc2 = el('p', { class: 'ce-inspector-desc' });
      desc2.appendChild(renderDescription(node.description));
      body.appendChild(desc2);

      if (node.priority) {
        body.appendChild(el('div', { class: 'ce-inspector-pill' }, node.priority));
      }
      if (node.flow) {
        body.appendChild(el('div', { class: 'ce-inspector-pill flow' }, node.flow));
      }

      // Section editor (only for CLAUDE.md project)
      if (node.sections) {
        renderSectionEditor(body, node);
      }

      if (node.extended) {
        body.appendChild(el('div', { class: 'ce-inspector-section-label' }, node.extended.heading));
        var extBody = el('div', { class: 'ce-inspector-extended-body' });
        node.extended.body.forEach(function(item) {
          var row = el('div', { class: 'ce-inspector-extended-item' });
          row.appendChild(el('div', { class: 'ce-inspector-extended-item-label' }, item.label));
          var t = el('p', { class: 'ce-inspector-extended-item-text' });
          t.appendChild(renderDescription(item.text));
          row.appendChild(t);
          extBody.appendChild(row);
        });
        body.appendChild(extBody);
      }
      if (node.example) {
        body.appendChild(el('div', { class: 'ce-inspector-section-label', style: 'margin-top: 8px;' }, 'Example'));
        body.appendChild(el('pre', { class: 'ce-inspector-example' }, node.example));
      }
    }

    function renderPortabilityNote() {
      // Only relevant when Layer 7 (External Tools / MCP) is the focus.
      var visible = activeLayer() === 'external';
      mcpCallout.style.display = visible ? '' : 'none';
    }

    // In the 4-col wide layout, synchronise inspector + context heights to
    // match the taller of the bands/filesystem columns. Temporarily zeroes
    // their heights so they don't inflate the grid row measurement.
    function syncWideHeights() {
      if (window.innerWidth < 1600) {
        inspectorPanel.style.height = '';
        contextPanel.style.height = '';
        return;
      }
      inspectorPanel.style.height = '0';
      contextPanel.style.height = '0';
      // The bands/filesystem cells share grid row 2 with inspector/context.
      // With inspector/context zeroed (and box-sizing: border-box), row 2's
      // height is determined by the bands and filesystem natural heights.
      var h = Math.max(leftCol.offsetHeight, rightCol.offsetHeight);
      inspectorPanel.style.height = h + 'px';
      contextPanel.style.height = h + 'px';
    }

    function rerender() {
      renderEntryBand();
      renderBands();
      renderTree();
      renderInspector();
      renderContext();
      renderPortabilityNote();
      syncWideHeights();
    }

    rerender();

    var _resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(syncWideHeights, 50);
    });

    return {
      selectLayer: selectLayer,
      highlightBand: function(layerId) {
        root.querySelectorAll('.ce-band').forEach(function(b) { b.classList.remove('ce-band-soft-hover'); });
        var target = root.querySelector('.ce-band[data-layer="' + layerId + '"]');
        if (target) target.classList.add('ce-band-soft-hover');
      },
      clearBandHighlight: function() {
        root.querySelectorAll('.ce-band').forEach(function(b) { b.classList.remove('ce-band-soft-hover'); });
      }
    };
  };
})();
