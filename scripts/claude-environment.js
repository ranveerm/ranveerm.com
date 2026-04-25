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
      label: 'Layer 0: User Input',
      sublabel: "The user's request",
      color: '#d97706',
      description: 'The prompt. Everything else exists to shape how this is interpreted before reaching the model.',
      aggregation: 'A single input - no precedence to resolve.',
      nodes: ['prompt']
    },
    memory: {
      label: 'Layer 1: Persistent Memory',
      sublabel: 'Instructions loaded into system prompt',
      color: '#0891b2',
      description: 'Markdown files merged into the system prompt. Claude sees these as **instructions**, persistent, session-wide guidance for how to behave, what conventions to follow, and what commands exist.',
      aggregation: 'All present `CLAUDE.md` files are **concatenated** into the system prompt at session start. Content accumulates rather than overrides, but where guidance directly conflicts the deeper file wins.',
      precedenceFiles: ['claude-local', 'claude-md-project', 'claude-md-global'],
      interactionExample:
        '# How three CLAUDE.md files merge\n' +
        '\n' +
        '~/.claude/CLAUDE.md   "Use TypeScript strict mode"   ← kept (no conflict)\n' +
        'CLAUDE.md (project)   "Use npm for installs"          ← overridden by .local\n' +
        'CLAUDE.local.md       "Use pnpm instead of npm"       ← wins\n' +
        '\n' +
        '→ What Claude follows after merge:\n' +
        '   • Use TypeScript strict mode   (aggregated from global)\n' +
        '   • Use pnpm                     (override resolved to .local)',
      nodes: ['claude-local', 'claude-md-project', 'claude-md-global', 'rules']
    },
    config: {
      label: 'Layer 2: Permissions',
      sublabel: 'Behavioural controls',
      color: '#7c3aed',
      description: 'Permissions, model selection, and feature toggles. Defines what Claude can do without asking.',
      aggregation: 'Permission `allow` and `deny` arrays **union** across all three files. Other keys deep-merge, with deeper files overriding shallower ones. None of this enters the model context - it only governs runtime behaviour.',
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
      label: 'Layer 3: Tools',
      sublabel: 'Primitive actions',
      color: '#db2777',
      description: 'The fundamental actions Claude can take. Built-ins like Read, Write, Bash, Grep are always available. Everything else in the environment either restricts these, orchestrates them, or extends them.',
      aggregation: 'Built-in tool definitions are always present in the system prompt. Settings and agents can only **restrict** them; MCP and skills can **extend** them.',
      nodes: ['builtin-tools']
    },
    invocable: {
      label: 'Layer 4: Invocable Knowledge',
      sublabel: 'Workflows and commands',
      color: '#d97706',
      description: 'Reusable patterns. Skills auto-load based on natural language; commands are invoked explicitly with a slash.',
      aggregation: 'Discovered at session start but not loaded. Each skill\'s short description (~30 tokens) is in context so Claude can match; **bodies load on demand**. Commands only enter context on explicit `/command` invocation.',
      nodes: ['skills', 'commands']
    },
    delegation: {
      label: 'Layer 5: Delegation',
      sublabel: 'Specialised agents',
      color: '#e11d48',
      description: 'Spawn focused subagents that run in their own fresh context windows. Only a summary returns to the main conversation.',
      aggregation: 'Only the agent\'s description is loaded into the parent system prompt. The agent\'s own system prompt and any files it reads stay isolated in its **fresh context window** - only the final summary returns.',
      nodes: ['agents']
    },
    automation: {
      label: 'Layer 6: Automation',
      sublabel: 'Event-driven scripts',
      color: '#059669',
      description: 'Shell scripts triggered by tool events. Enforce standards without model involvement, formatters, linters, validators.',
      aggregation: 'Hooks fire deterministically on tool lifecycle events. **Zero model context cost** - they run shell-side, outside the model loop.',
      nodes: ['hooks']
    },
    external: {
      label: 'Layer 7: External Tools',
      sublabel: 'Protocol-based integrations',
      color: '#2563eb',
      description: 'MCP is the odd one out: an OPEN PROTOCOL, not a Claude Code convention. Portable across Cursor, VS Code, and other clients.',
      aggregation: 'When an MCP server is connected, its tool definitions are added to the system prompt - same context cost model as built-in tools.',
      nodes: ['mcp']
    },
    state: {
      label: 'Layer 8: State and Isolation',
      sublabel: 'Session management',
      color: '#64748b',
      description: 'How Claude remembers across sessions and isolates parallel work.',
      aggregation: 'On-disk only. Nothing here enters context until you `--resume` a session - and even then, only the prior turn transcript is replayed.',
      nodes: ['sessions', 'worktrees']
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
      description: 'Personal **instructions** for this project. Gitignored, only you see it. Personal inputs (`.local`) take precedence over the team-level CLAUDE.md.',
      example: '# My personal tweaks\nUse pnpm instead of npm locally\nMy debug port is 3001\nSkip the Docker setup, I run Postgres natively',
      priority: 'Highest-priority instruction file',
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
      priority: 'Lowest-priority instruction file (project-level takes precedence over these)',
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
      description: "Markdown workflows invoked via natural language. Claude auto-loads them when your phrasing matches the skill's description. Each skill lives in its own folder with a SKILL.md file and optional supporting files. **Not** part of MCP, Claude Code-specific convention.",
      example: '# .claude/skills/deploy/SKILL.md\n---\nname: deploy\ndescription: Triggered when user says\n  "deploy", "ship it", "push to prod"\nallowed-tools: [Read, Bash]\n---\n1. Run full test suite\n2. Bump version in package.json\n3. Create git tag\n4. Push to main',
      priority: 'Auto-invoked by natural-language match',
      tokens: 0,
      tokenNote: 'Each skill\'s description (~30 tokens) is in context so Claude can match. Bodies load on demand only when triggered.'
    },
    commands: {
      layer: 'invocable', label: 'commands/', icon: 'bolt',
      title: 'commands/',
      description: 'Custom slash commands. Every `.md` file becomes `/project:name`. Explicit invocation, you type the command.',
      example: '# .claude/commands/review.md\n---\ndescription: Review current branch\n---\n## Diff\n!`git diff main...HEAD`\n\nReview for security issues and missing tests.',
      priority: 'Manual invocation (/project:review)',
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
      description: 'MCP server configuration. Unlike everything else here, MCP is an OPEN PROTOCOL, portable across Cursor, VS Code, and other clients. Extends Claude with external tools (databases, GitHub, Jira).',
      example: '{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["@modelcontextprotocol/server-postgres"]\n    },\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"]\n    }\n  }\n}',
      priority: 'Works with ANY MCP-compatible client',
      tokens: 500,
      tokenNote: 'Tool definitions from each connected server join the system prompt - same cost model as built-in tools.'
    },
    worktrees: {
      layer: 'state', label: 'worktrees/', icon: 'sitemap',
      title: 'worktrees/',
      description: 'Git worktree isolation for parallel Claude sessions. Each worktree has its own branch and working directory. Created via `claude --worktree <n>`.',
      example: '.claude/worktrees/\n├── feature-auth/     (branch: worktree-feature-auth)\n├── bugfix-123/       (branch: worktree-bugfix-123)\n└── experiment-refactor/',
      priority: 'Run multiple Claude sessions in parallel without collisions',
      tokens: 0,
      tokenNote: 'Filesystem isolation. No model context impact.'
    },
    sessions: {
      layer: 'state', label: 'projects/', icon: 'sitemap',
      title: '~/.claude/projects/',
      description: 'Session history stored per project directory. Each worktree gets its own session storage. Resumable via `claude --resume`.',
      example: '~/.claude/projects/\n└── Users-you-projects-myapp/\n    ├── sessions/\n    │   └── session-abc123.json\n    └── memory/\n        └── MEMORY.md',
      priority: 'Auto-memory: Claude saves observations across sessions',
      tokens: 0,
      tokenNote: 'On-disk only. Replayed transcripts only enter context on `--resume`.'
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
      '.claudeenv { max-width: 960px; margin: 0 auto; padding: 8px 0 24px; color: #333; --accent: #6a9fb5; --border: rgba(106, 159, 181, 0.22); --hairline: rgba(106, 159, 181, 0.12); --muted: #777; --card: #ffffff; --subdued: rgba(100, 116, 139, 0.16); --subdued-bg: rgba(100, 116, 139, 0.04); --subdued-fg: #475569; }',
      '.claudeenv .ce-intro { color: #777; font-size: 0.92rem; max-width: 620px; margin: 0 auto 20px; line-height: 1.5; }',

      /* Two-column grid: left = layer bands, right = file tree.
         align-items: stretch lets the file-tree panel grow to match the
         layer-bands column height. minmax(0, 1fr) prevents long strings
         in either column from pushing the layout wider. */
      '.claudeenv .ce-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: stretch; }',
      '@media (max-width: 760px) { .claudeenv .ce-grid { grid-template-columns: 1fr; } }',

      /* Layer bands */
      '.claudeenv .ce-bands { display: flex; flex-direction: column; gap: 8px; height: 100%; }',
      '.claudeenv .ce-bands-entry { height: auto; margin-bottom: 16px; }',
      '.claudeenv .ce-bands-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }',
      '.claudeenv .ce-bands-header h3 { margin: 4px 0 0; font-size: 1.15rem; font-weight: 500; color: #222; }',
      '.claudeenv .ce-entry-band { width: 100%; text-align: left; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 0; cursor: pointer; transition: border-color 0.2s, background 0.2s, opacity 0.2s; font: inherit; color: inherit; }',
      '.claudeenv .ce-entry-band.active { border-color: #d97706; background: rgba(217, 119, 6, 0.06); }',
      '.claudeenv .ce-entry-band.dimmed { opacity: 0.35; }',
      '.claudeenv .ce-entry-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }',
      '.claudeenv .ce-entry-head .fa { color: #333; font-size: 0.85rem; }',
      '.claudeenv .ce-entry-head .ce-layer-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: #333; }',
      '.claudeenv .ce-entry-cmd { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.88rem; color: #333; margin-bottom: 4px; }',
      '.claudeenv .ce-entry-cmd .dim { color: #aaa; }',
      '.claudeenv .ce-entry-cmd .mark { color: #d97706; }',
      '.claudeenv .ce-entry-note { font-size: 0.78rem; color: #777; margin: 0; }',
      '.claudeenv .ce-connector { display: flex; justify-content: center; margin: 2px 0; }',
      '.claudeenv .ce-connector::before { content: ""; width: 1px; height: 8px; background: linear-gradient(to bottom, transparent, var(--border), transparent); }',
      '.claudeenv .ce-band { width: 100%; text-align: left; border: 1px solid var(--border); border-radius: 6px; background: transparent; padding: 10px 14px; position: relative; cursor: pointer; transition: opacity 0.2s, background 0.2s, border-color 0.2s; font: inherit; color: inherit; }',
      '.claudeenv .ce-band.dimmed { opacity: 0.3; }',
      '.claudeenv .ce-band.active { background: rgba(0,0,0,0.07); border-color: rgba(0,0,0,0.30); }',
      '.claudeenv .ce-band:hover:not(.dimmed) { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.20); }',
      '.claudeenv .ce-band-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 3px; }',
      '.claudeenv .ce-band-title { display: block; font-size: 0.95rem; font-weight: 400; color: #333; }',
      '.claudeenv .ce-band-sublabel { display: block; font-size: 0.78rem; color: #777; margin-top: 3px; }',
      '.claudeenv .ce-band .ce-entry-cmd { margin-top: 8px; margin-bottom: 0; }',
      '.claudeenv .ce-band-count { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; color: #aaa; flex-shrink: 0; }',
      '.claudeenv .ce-band-desc { font-size: 0.78rem; color: #666; line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-clear-btn { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em; color: #999; background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }',
      '.claudeenv .ce-clear-btn:hover { color: #333; border-color: var(--accent); }',

      /* File tree panel: stretches to match the layer-bands column. */
      '.claudeenv .ce-panel { border: 1px solid var(--border); border-radius: 10px; background: var(--card); margin-bottom: 16px; overflow: hidden; }',
      '.claudeenv .ce-tree-panel { display: flex; flex-direction: column; height: 100%; margin-bottom: 0; }',
      '.claudeenv .ce-tree-panel .ce-tree { flex: 1; }',
      '.claudeenv .ce-panel-head { border-bottom: 1px solid var(--hairline); padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }',
      '.claudeenv .ce-panel-head-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #999; }',
      '.claudeenv .ce-panel-head .fa { color: #bbb; font-size: 0.72rem; }',
      '.claudeenv .ce-tree-controls { display: flex; gap: 4px; }',
      '.claudeenv .ce-mini-btn { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: #777; background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; cursor: pointer; }',
      '.claudeenv .ce-mini-btn:hover { color: #222; border-color: var(--accent); }',
      '.claudeenv .ce-tree { padding: 8px 6px; }',
      '.claudeenv .ce-tree-root { display: flex; align-items: center; gap: 6px; padding: 3px 8px; width: 100%; text-align: left; background: transparent; border: none; font: inherit; color: #777; cursor: pointer; border-radius: 4px; }',
      '.claudeenv .ce-tree-root:hover { color: #333; background: rgba(0,0,0,0.03); }',
      '.claudeenv .ce-tree-root .ce-chevron { font-size: 0.65rem; color: #aaa; transition: transform 0.2s; width: 10px; }',
      '.claudeenv .ce-tree-root .ce-chevron.open { transform: rotate(90deg); }',
      /* All directory icons share the file-icon colour, but directory labels are emphasised (bold). */
      '.claudeenv .ce-tree-root .ce-home,',
      '.claudeenv .ce-tree-root .ce-folder { color: #aaa; }',
      '.claudeenv .ce-tree-root .ce-label { font-weight: 600; }',
      '.claudeenv .ce-tree-root .ce-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; }',
      '.claudeenv .ce-tree-root .ce-scope { margin-left: auto; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: #bbb; }',
      '.claudeenv .ce-tree-children { margin-left: 10px; border-left: 1px solid var(--hairline); padding-left: 2px; }',
      '.claudeenv .ce-tree-spacer { height: 6px; }',
      /* Tree row layout: [checkbox] [label-button] */
      '.claudeenv .ce-tree-row { display: flex; align-items: center; gap: 4px; }',
      /* Custom checkbox - identical visual in both states (filled grey box). */
      /* Only the centred white tick appears when checked.                 */
      '.claudeenv .ce-tree-check { appearance: none; -webkit-appearance: none; -moz-appearance: none; width: 14px; height: 14px; flex-shrink: 0; margin: 0 2px 0 6px; cursor: pointer; border: 1.5px solid #aaa; border-radius: 3px; background: #aaa; position: relative; vertical-align: middle; }',
      '.claudeenv .ce-tree-check:checked::after { content: ""; position: absolute; left: 50%; top: 45%; width: 4px; height: 7px; border: solid #fff; border-width: 0 1.5px 1.5px 0; transform: translate(-50%, -50%) rotate(45deg); }',
      '.claudeenv .ce-tree-check:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }',
      '.claudeenv .ce-tree-check[disabled] { opacity: 0.5; cursor: not-allowed; }',
      '.claudeenv .ce-tree-node { flex: 1; display: flex; align-items: center; gap: 6px; padding: 3px 8px; min-width: 0; text-align: left; background: transparent; border: none; font: inherit; color: #777; cursor: pointer; border-radius: 4px; position: relative; }',
      '.claudeenv .ce-tree-node:hover { color: #333; background: rgba(0,0,0,0.03); }',
      '.claudeenv .ce-tree-node.selected { background: rgba(0,0,0,0.07); color: #333; }',
      '.claudeenv .ce-tree-node.highlighted { background: rgba(106, 159, 181, 0.08); color: #333; }',
      '.claudeenv .ce-tree-node.excluded { opacity: 0.45; text-decoration: line-through; text-decoration-color: rgba(0,0,0,0.25); }',
      '.claudeenv .ce-tree-node .fa { font-size: 0.75rem; color: #aaa; flex-shrink: 0; }',
      /* All directory icons share the file-icon colour; the label gets emphasis. */
      '.claudeenv .ce-tree-node.dir .fa { color: #aaa; }',
      '.claudeenv .ce-tree-node.dir .ce-label { font-weight: 600; }',
      '.claudeenv .ce-tree-node .ce-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.76rem; }',
      '.claudeenv .ce-tree-node .ce-token-tag { margin-left: auto; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.6rem; color: #aaa; padding-left: 6px; }',
      '.claudeenv .ce-tree-node.included-bold .ce-token-tag { color: #333; }',
      '.claudeenv .ce-tree-node .ce-layer-dot { position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; }',
      /* Spacer that mirrors a checkbox slot for non-toggleable folder rows. */
      '.claudeenv .ce-tree-check-spacer { display: inline-block; width: 14px; flex-shrink: 0; margin: 0 2px 0 6px; }',
      /* Non-interactive folder row (e.g. `.claude/`) - same visual as other */
      /* folders but no hover / cursor. */
      '.claudeenv .ce-tree-node.non-interactive { cursor: default; }',
      '.claudeenv .ce-tree-node.non-interactive:hover { background: transparent; color: #777; }',
      '.claudeenv .ce-panel-foot { border-top: 1px solid var(--hairline); padding: 8px 14px; background: rgba(106, 159, 181, 0.04); font-size: 0.72rem; color: #777; line-height: 1.5; }',
      '.claudeenv .ce-panel-foot .star { color: #d97706; }',
      '.claudeenv .ce-tree-totals { border-top: 1px solid var(--hairline); padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #555; background: rgba(217, 119, 6, 0.03); }',
      '.claudeenv .ce-tree-totals .stack { display: flex; flex-direction: column; gap: 2px; }',
      '.claudeenv .ce-tree-totals .label { color: #888; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.6rem; }',
      '.claudeenv .ce-tree-totals .val { color: #333; font-weight: 600; font-size: 0.85rem; }',
      '.claudeenv .ce-tree-totals .val.on-demand { color: #333; }',
      '.claudeenv .ce-tree-totals .ce-totals-caveat { grid-column: 1 / -1; font-style: italic; font-size: 0.62rem; color: #999; margin-top: 4px; font-family: inherit; line-height: 1.4; }',

      /* Inspector */
      '.claudeenv .ce-inspector { margin-top: 16px; }',
      '.claudeenv .ce-inspector-body { padding: 8px 16px 16px; }',
      '.claudeenv .ce-inspector-layer-crumb { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }',
      '.claudeenv .ce-inspector-layer-dot { width: 8px; height: 8px; border-radius: 50%; }',
      '.claudeenv .ce-inspector-layer-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; background: none; border: none; padding: 0; cursor: pointer; color: #777; }',
      '.claudeenv .ce-inspector h3 { font-size: 1.15rem; font-weight: 500; color: #222; margin: 0 0 4px; }',
      '.claudeenv .ce-inspector .ce-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.claudeenv .ce-inspector .ce-title-row .fa { color: var(--accent); font-size: 0.95rem; }',
      '.claudeenv .ce-inspector-desc { color: #555; font-size: 0.82rem; line-height: 1.55; margin: 0 0 8px; }',
      '.claudeenv .ce-inspector-pill { background: rgba(106, 159, 181, 0.06); border-left: 3px solid var(--accent); padding: 7px 12px; margin-bottom: 10px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.72rem; color: #555; border-radius: 2px; }',
      '.claudeenv .ce-inspector-pill.flow { border-left-color: #0891b2; background: rgba(8, 145, 178, 0.05); }',
      '.claudeenv .ce-inspector-pill.aggregation { border-left-color: #d97706; background: rgba(217, 119, 6, 0.05); color: #555; line-height: 1.55; font-family: inherit; font-size: 0.78rem; }',
      '.claudeenv .ce-precedence-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-bottom: 12px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; }',
      '.claudeenv .ce-precedence-file { background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; font: inherit; cursor: pointer; color: #333; }',
      '.claudeenv .ce-precedence-file:hover { border-color: rgba(0,0,0,0.35); color: #000; }',
      '.claudeenv .ce-precedence-sep { color: #aaa; font-weight: 600; }',
      '.claudeenv .ce-inspector-pill.token { border-left-color: #b45309; background: rgba(180, 83, 9, 0.05); color: #555; line-height: 1.55; font-family: inherit; font-size: 0.78rem; }',
      '.claudeenv .ce-inspector-section-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #aaa; margin-bottom: 4px; margin-top: 4px; }',
      '.claudeenv .ce-inspector-extended-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }',
      '.claudeenv .ce-inspector-extended-item { border-left: 1px solid var(--border); padding: 2px 0 2px 10px; }',
      '.claudeenv .ce-inspector-extended-item-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.68rem; color: #d97706; margin-bottom: 1px; }',
      '.claudeenv .ce-inspector-extended-item-text { font-size: 0.77rem; color: #555; line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-inspector-example { background: #fafafa; border: 1px solid var(--hairline); border-radius: 6px; padding: 10px 12px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.72rem; color: #333; white-space: pre; overflow-x: auto; line-height: 1.5; margin: 0; }',

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
      '.claudeenv .ce-impact-head { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 14px; }',
      '.claudeenv .ce-impact-stat { flex: 1; min-width: 150px; border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; background: rgba(217, 119, 6, 0.02); }',
      '.claudeenv .ce-impact-stat.on-demand { background: rgba(106, 159, 181, 0.04); }',
      '.claudeenv .ce-impact-stat-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: #888; margin-bottom: 4px; }',
      '.claudeenv .ce-impact-stat-val { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 1.3rem; font-weight: 600; color: #b45309; }',
      '.claudeenv .ce-impact-stat.on-demand .ce-impact-stat-val { color: #0891b2; }',
      '.claudeenv .ce-impact-stat-sub { font-size: 0.7rem; color: #888; margin-top: 2px; }',
      '.claudeenv .ce-impact-bar { display: flex; height: 14px; border-radius: 3px; overflow: hidden; margin-bottom: 8px; background: rgba(0,0,0,0.04); }',
      '.claudeenv .ce-impact-bar-seg { height: 100%; transition: width 0.25s; }',
      '.claudeenv .ce-impact-legend { display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 0.7rem; color: #555; margin-bottom: 14px; }',
      '.claudeenv .ce-impact-legend-item { display: inline-flex; align-items: center; gap: 6px; }',
      '.claudeenv .ce-impact-legend-swatch { width: 8px; height: 8px; border-radius: 2px; }',
      '.claudeenv .ce-impact-list { font-size: 0.75rem; color: #777; line-height: 1.6; margin: 0; padding-left: 14px; }',
      '.claudeenv .ce-impact-hint { font-size: 0.78rem; color: #555; line-height: 1.55; background: rgba(217, 119, 6, 0.04); border-left: 3px solid #d97706; padding: 8px 12px; border-radius: 2px; margin-top: 12px; }',
      '.claudeenv .ce-impact-hint .ce-hint-link { color: #b45309; background: none; border: none; font: inherit; cursor: pointer; text-decoration: underline; padding: 0; }',
      '.claudeenv .ce-impact-caveat { font-style: italic; font-size: 0.7rem; color: #999; margin: 14px 0 0; line-height: 1.5; }',

      /* CLAUDE.md section toggles */
      '.claudeenv .ce-sections { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }',
      '.claudeenv .ce-section-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: rgba(0,0,0,0.01); }',
      '.claudeenv .ce-section-bar { display: flex; height: 8px; border-radius: 3px; overflow: hidden; background: rgba(0,0,0,0.06); margin: 6px 0 4px; }',
      '.claudeenv .ce-section-bar-inline { background: rgba(180, 83, 9, 0.55); transition: width 0.3s; }',
      '.claudeenv .ce-section-bar-skill { background: rgba(8, 145, 178, 0.55); transition: width 0.3s; }',
      '.claudeenv .ce-section-row.in-skill { background: rgba(8, 145, 178, 0.04); border-color: rgba(8, 145, 178, 0.2); }',
      '.claudeenv .ce-section-row.fixed { opacity: 0.85; }',
      '.claudeenv .ce-section-label { font-size: 0.78rem; color: #333; font-family: inherit; min-width: 0; }',
      '.claudeenv .ce-section-label .ce-section-note { display: block; font-size: 0.68rem; color: #888; margin-top: 2px; line-height: 1.4; font-family: inherit; }',
      '.claudeenv .ce-section-cost { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.7rem; color: #b45309; min-width: 56px; text-align: right; white-space: nowrap; }',
      '.claudeenv .ce-section-row.in-skill .ce-section-cost { color: #0891b2; }',
      '.claudeenv .ce-section-row.fixed .ce-section-cost { color: #888; }',
      '.claudeenv .ce-section-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }',
      '.claudeenv .ce-section-toggle button { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.74rem; padding: 4px 10px; background: transparent; border: none; cursor: pointer; color: #888; border-right: 1px solid var(--border); }',
      '.claudeenv .ce-section-toggle button:last-child { border-right: none; }',
      '.claudeenv .ce-section-toggle button.on { background: rgba(0,0,0,0.06); color: #333; font-weight: 600; }',
      '.claudeenv .ce-section-toggle button.on.skill-mode { background: rgba(0,0,0,0.06); color: #333; }',
      '.claudeenv .ce-section-summary { display: flex; gap: 14px; font-size: 0.75rem; color: #555; margin-top: 6px; flex-wrap: wrap; }',
      '.claudeenv .ce-section-summary .label { color: #888; }',
      '.claudeenv .ce-section-summary .val { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #b45309; font-weight: 600; }',
      '.claudeenv .ce-section-summary .val.on-demand { color: #0891b2; }',

      /* Empty state */
      '.claudeenv .ce-inspector-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: #999; }',
      '.claudeenv .ce-inspector-empty .fa { font-size: 1.4rem; color: #ccc; margin-bottom: 10px; }',
      '.claudeenv .ce-inspector-empty p { font-size: 0.8rem; margin: 0; max-width: 260px; line-height: 1.55; }',
      '.claudeenv .ce-close-btn { color: #aaa; background: transparent; border: none; cursor: pointer; font-size: 0.85rem; padding: 2px 4px; }',
      '.claudeenv .ce-close-btn:hover { color: #333; }',

      /* Portability note (subdued slate, not blue) */
      '.claudeenv .ce-mcp-callout { border: 1px solid var(--subdued); background: var(--subdued-bg); border-radius: 8px; padding: 12px 14px; margin-top: 16px; }',
      '.claudeenv .ce-mcp-callout-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.claudeenv .ce-mcp-callout-head .fa { color: var(--subdued-fg); }',
      '.claudeenv .ce-mcp-callout-head .ce-mcp-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--subdued-fg); font-weight: 600; }',
      '.claudeenv .ce-mcp-callout p { font-size: 0.8rem; color: #555; line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-mcp-callout .hl { color: var(--subdued-fg); font-weight: 600; }',

      /* Inline markdown */
      '.claudeenv .ce-bold { font-weight: 600; }',
      '.claudeenv .ce-code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.82em; background: rgba(8, 145, 178, 0.08); color: #0e7490; padding: 1px 4px; border-radius: 3px; }'
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
      sectionMode: {}
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

    // Layer 0: full-width band above the grid.
    var entryWrap = el('div', { class: 'ce-bands ce-bands-entry' });
    root.appendChild(entryWrap);

    var grid = el('div', { class: 'ce-grid' });
    root.appendChild(grid);

    var leftCol  = el('div', null);
    var rightCol = el('div', { style: 'display: flex; flex-direction: column;' });
    grid.appendChild(leftCol);
    grid.appendChild(rightCol);

    var bandsWrap = el('div', { class: 'ce-bands' });
    leftCol.appendChild(bandsWrap);

    // Right column: file tree only (now full-height, with checkboxes)
    var treePanel = el('div', { class: 'ce-panel ce-tree-panel' });
    var treeHead = el('div', { class: 'ce-panel-head' });
    treeHead.appendChild(el('span', { class: 'ce-panel-head-label' }, 'Filesystem'));
    var treeControls = el('div', { class: 'ce-tree-controls' });
    // Single toggle: label flips between "select all" and "select none"
    // depending on whether everything toggleable is currently included.
    var bulkBtn = el('button', { class: 'ce-mini-btn', type: 'button' }, 'select all');
    function updateBulkBtnLabel() {
      var allIncluded = TOGGLEABLE.every(isIncluded);
      bulkBtn.innerText = allIncluded ? 'select none' : 'select all';
    }
    hook(bulkBtn, function() {
      var allIncluded = TOGGLEABLE.every(isIncluded);
      setAllIncluded(!allIncluded);
    });
    treeControls.appendChild(bulkBtn);
    treeHead.appendChild(treeControls);
    treePanel.appendChild(treeHead);

    var treeBody = el('div', { class: 'ce-tree' });
    treePanel.appendChild(treeBody);

    rightCol.appendChild(treePanel);

    // Inspector (full width, sits directly below the grid)
    var inspectorPanel = el('div', { class: 'ce-panel ce-inspector' });
    root.appendChild(inspectorPanel);

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

    function renderEntryBand() {
      entryWrap.innerHTML = '';
      var a = activeLayer();
      var layer = LAYERS.entry;
      var band = el('button', { class: 'ce-band' + (a === 'entry' ? ' active' : a && a !== 'entry' ? ' dimmed' : ''), type: 'button' });
      hook(band, function() { selectLayer('entry'); });
      band.appendChild(el('span', { class: 'ce-band-title' }, layer.label));
      var cmd = el('div', { class: 'ce-entry-cmd' });
      cmd.appendChild(el('span', { class: 'dim' }, '$ '));
      cmd.appendChild(el('span', { class: 'dim' }, 'claude '));
      cmd.appendChild(el('span', { class: 'dim' }, '"'));
      cmd.appendChild(el('span', { class: 'mark' }, 'convert the image to grayscale'));
      cmd.appendChild(el('span', { class: 'dim' }, '"'));
      band.appendChild(cmd);
      entryWrap.appendChild(band);
    }

    function renderBands() {
      bandsWrap.innerHTML = '';
      var a = activeLayer();
      LAYER_ORDER.forEach(function(id) {
        var layer = LAYERS[id];
        var band = el('button', { class: 'ce-band' + (a === id ? ' active' : a && a !== id ? ' dimmed' : ''), type: 'button' });
        hook(band, function() { selectLayer(id); });
        band.appendChild(el('span', { class: 'ce-band-title' }, layer.label));
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
        projectChildren.appendChild(fileRow('mcp', '.mcp.json', 'server', 2));
        projectChildren.appendChild(fileRow('rules', 'rules/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('commands', 'commands/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('skills', 'skills/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('agents', 'agents/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('hooks', 'hooks/', 'folder-o', 2, true));
        projectChildren.appendChild(fileRow('worktrees', 'worktrees/', 'folder-o', 2, true));
        treeBody.appendChild(projectChildren);
      }
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
            title: layer.label + ': ' + fmtTokens(t) + ' tokens'
          }));
          legend.appendChild(el('span', { class: 'ce-impact-legend-item' }, [
            el('span', { class: 'ce-impact-legend-swatch', style: 'background: ' + layer.color }),
            el('span', null, layer.label.replace(/^Layer \d+: /, '') + ' · ' + fmtTokens(t) + 't')
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

    function renderInspector() {
      inspectorPanel.innerHTML = '';

      var head = el('div', { class: 'ce-panel-head' }, [
        el('span', { class: 'ce-panel-head-label' }, 'Inspector')
      ]);
      inspectorPanel.appendChild(head);

      var body = el('div', { class: 'ce-inspector-body' });
      inspectorPanel.appendChild(body);

      // Empty state → simple help message.
      if (!state.selectedNode && !state.selectedLayer) {
        body.appendChild(el('div', { class: 'ce-inspector-empty' }, [
          fa('info-circle'),
          el('p', null, 'Click a layer band to see how its files combine, or click a file in the tree to inspect it directly.')
        ]));
        return;
      }

      // Layer view
      if (state.selectedLayer) {
        var layer = LAYERS[state.selectedLayer];
        body.appendChild(el('h3', null, layer.sublabel));
        var desc = el('p', { class: 'ce-inspector-desc' });
        desc.appendChild(renderDescription(layer.description));
        body.appendChild(desc);

        // Precedence chain (only for layers with multiple ordered files)
        if (layer.precedenceFiles && layer.precedenceFiles.length > 1) {
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

    function rerender() {
      renderEntryBand();
      renderBands();
      renderTree();
      renderInspector();
      renderPortabilityNote();
      updateBulkBtnLabel();
    }

    rerender();
  };
})();
