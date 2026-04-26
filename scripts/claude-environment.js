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
      description: 'Everything else exists to shape how this is interpreted before reaching the model.',
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
      /* Design-language foundation. The widget's local vars alias the   */
      /* site-wide tokens (defined in _sass/_theme.scss) so palette       */
      /* migrations and dark-mode flips happen in one place.             */
      '.claudeenv { max-width: 960px; margin: 0 auto; padding: 8px 0 24px; color: var(--ink-primary); font-family: var(--font-text); --accent: var(--coral); --border: var(--line); --hairline: var(--line); --muted: var(--ink-muted); --card: var(--paper-raised); --subdued: var(--line); --subdued-bg: var(--paper-inset); --subdued-fg: var(--ink-muted); }',
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
      /* Layer 0 entry band -- viz.frame recipe (kept for legacy markup). */
      '.claudeenv .ce-entry-band { width: 100%; text-align: left; background: var(--paper-raised); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 0; cursor: pointer; transition: border-color 0.2s, background 0.2s, opacity 0.2s; font: inherit; color: inherit; }',
      '.claudeenv .ce-entry-band.active { border-color: var(--ink-muted); background: var(--paper-inset); }',
      '.claudeenv .ce-entry-band.dimmed { opacity: 0.35; }',
      '.claudeenv .ce-entry-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }',
      '.claudeenv .ce-entry-head .fa { color: var(--ink-primary); font-size: 0.85rem; }',
      '.claudeenv .ce-entry-head .ce-layer-label { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-primary); }',
      /* code.text + code.string for the prompt example: $ + cmd dim,    */
      /* highlighted argument coral.                                      */
      '.claudeenv .ce-entry-cmd { font-family: var(--font-mono); font-size: var(--size-md); color: var(--ink-primary); margin-bottom: 4px; }',
      '.claudeenv .ce-entry-cmd .dim { color: var(--ink-faint); }',
      '.claudeenv .ce-entry-cmd .mark { color: var(--coral); }',
      '.claudeenv .ce-entry-note { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-muted); margin: 0; }',
      '.claudeenv .ce-connector { display: flex; justify-content: center; margin: 2px 0; }',
      '.claudeenv .ce-connector::before { content: ""; width: 1px; height: 8px; background: linear-gradient(to bottom, transparent, var(--border), transparent); }',
      /* Layer band -- viz.row recipe. Active state stays neutral grey  */
      /* per the user's selection-colour preference (overrides the     */
      /* design's coral inset shadow).                                  */
      '.claudeenv .ce-band { width: 100%; text-align: left; background: var(--paper-raised); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; position: relative; cursor: pointer; transition: opacity 0.2s, background 0.2s, border-color 0.2s; font: inherit; color: inherit; }',
      '.claudeenv .ce-band.dimmed { opacity: 0.3; }',
      /* viz.row-selected: paper-inset bg, ink-muted border, coral inset
         shadow on the left edge -- matches the design language\'s
         `viz.* + code.* in context` exemplar. */
      '.claudeenv .ce-band.active { background: var(--paper-inset); border-color: var(--ink-muted); box-shadow: inset 3px 0 0 var(--coral); }',
      '.claudeenv .ce-band:hover:not(.dimmed) { background: var(--paper-inset); border-color: var(--ink-faint); }',
      '.claudeenv .ce-band-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 3px; }',
      /* viz.row-title: ink-primary, display, lg, weight 500, snug. */
      '.claudeenv .ce-band-title { display: block; font-family: var(--font-display); font-size: var(--size-lg); font-weight: 500; line-height: var(--lh-snug); letter-spacing: var(--track-snug); color: var(--ink-primary); }',
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
      '.claudeenv .ce-tree-panel .ce-tree { flex: 1; }',
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
      '.claudeenv .ce-inspector { margin-top: 16px; }',
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

      /* Portability note -- viz.callout recipe (coral wash + rule). */
      '.claudeenv .ce-mcp-callout { border-left: 3px solid var(--coral); background: var(--coral-wash); border-radius: 0 6px 6px 0; padding: 12px 14px; margin-top: 16px; }',
      '.claudeenv .ce-mcp-callout-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.claudeenv .ce-mcp-callout-head .fa { color: var(--coral); }',
      '.claudeenv .ce-mcp-callout-head .ce-mcp-label { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--coral); font-weight: 600; }',
      '.claudeenv .ce-mcp-callout p { font-family: var(--font-display); font-size: var(--size-md); color: var(--ink-secondary); line-height: var(--lh-normal); margin: 0; }',
      '.claudeenv .ce-mcp-callout .hl { color: var(--ink-primary); font-weight: 600; }',

      /* Inline markdown -- bold inherits colour; inline code uses code.chip. */
      '.claudeenv .ce-bold { font-weight: 600; }',
      '.claudeenv .ce-code { font-family: var(--font-mono); font-size: 0.82em; background: var(--paper-inset); color: var(--sx-keyword); border: 1px solid var(--line); padding: 1px 6px; border-radius: 999px; }'
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
