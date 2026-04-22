// Interactive topology of the Claude Code environment.
// Vanilla-JS port of the original React component, retuned for the site's
// light theme. Bidirectional selection: click a layer to highlight its
// files, click a file to highlight its layer. The right-hand inspector
// shows the detail view for whichever is selected.
//
// Usage:  <div id="claudeenv-demo"></div>
//         <script>createClaudeEnvironment('claudeenv-demo');</script>

(function() {

  // ───────────── Data model (layers ↔ files, bidirectional) ─────────────

  var LAYERS = {
    entry: {
      label: 'Layer 0: Entry',
      sublabel: "the user's request",
      color: '#d97706',
      description: 'The prompt. Everything else exists to shape how this is interpreted before reaching the model.',
      nodes: ['prompt']
    },
    memory: {
      label: 'Layer 1: Persistent Memory',
      sublabel: 'instructions loaded into system prompt',
      color: '#0891b2',
      description: 'Markdown files merged into the system prompt. Claude sees these as **instructions**, persistent, session-wide guidance for how to behave, what conventions to follow, and what commands exist.',
      nodes: ['claude-local', 'claude-md-project', 'claude-md-global', 'rules']
    },
    config: {
      label: 'Layer 2: Configuration',
      sublabel: 'behavioural controls',
      color: '#7c3aed',
      description: 'Permissions, model selection, and feature toggles. Defines what Claude can do without asking.',
      nodes: ['settings-local', 'settings-project', 'settings-global']
    },
    tools: {
      label: 'Layer 3: Tools',
      sublabel: 'primitive actions',
      color: '#db2777',
      description: 'The fundamental actions Claude can take. Built-ins like Read, Write, Bash, Grep are always available. Everything else in the environment either restricts these, orchestrates them, or extends them.',
      nodes: ['builtin-tools']
    },
    invocable: {
      label: 'Layer 4: Invocable Knowledge',
      sublabel: 'workflows & commands',
      color: '#d97706',
      description: 'Reusable patterns. Skills auto-load based on natural language; commands are invoked explicitly with a slash.',
      nodes: ['skills', 'commands']
    },
    delegation: {
      label: 'Layer 5: Delegation',
      sublabel: 'specialised actors',
      color: '#e11d48',
      description: 'Spawn focused subagents that run in their own fresh context windows. Only a summary returns to the main conversation.',
      nodes: ['agents']
    },
    automation: {
      label: 'Layer 6: Automation',
      sublabel: 'event-driven scripts',
      color: '#059669',
      description: 'Shell scripts triggered by tool events. Enforce standards without model involvement, formatters, linters, validators.',
      nodes: ['hooks']
    },
    external: {
      label: 'Layer 7: External Tools',
      sublabel: 'protocol-based integrations',
      color: '#2563eb',
      description: 'MCP is the odd one out: an OPEN PROTOCOL, not a Claude Code convention. Portable across Cursor, VS Code, and other clients.',
      nodes: ['mcp']
    },
    state: {
      label: 'Layer 8: State & Isolation',
      sublabel: 'session management',
      color: '#64748b',
      description: 'How Claude remembers across sessions and isolates parallel work.',
      nodes: ['sessions', 'worktrees']
    }
  };

  var NODES = {
    prompt: {
      layer: 'entry', label: 'claude "…"', icon: 'terminal',
      title: 'User Prompt',
      description: 'The natural language request. Every other component in the environment exists to shape how Claude interprets and acts on this input.',
      flow: 'Prompt → merged with all context layers → model → tool calls → response',
      example: '$ claude "refactor the auth handler to use zod schemas"'
    },
    'claude-local': {
      layer: 'memory', label: 'CLAUDE.local.md', icon: 'file-text-o',
      title: 'CLAUDE.local.md',
      description: 'Personal **instructions** for this project. Gitignored, only you see it. Personal inputs (`.local`) take precedence over the team-level CLAUDE.md.',
      example: '# My personal tweaks\nUse pnpm instead of npm locally\nMy debug port is 3001\nSkip the Docker setup, I run Postgres natively',
      priority: 'Highest-priority instruction file'
    },
    'claude-md-project': {
      layer: 'memory', label: 'CLAUDE.md', icon: 'file-text-o',
      title: 'CLAUDE.md (project)',
      description: 'Project-level **instructions** committed to git. Team-shared memory for build commands, architecture, conventions. Loaded in full at session start.',
      example: '# Acme API\n\n## Commands\nnpm run dev\nnpm run test\n\n## Conventions\n- Validate with zod\n- Return { data, error, meta }\n- Never expose stack traces',
      priority: 'Team-level instructions'
    },
    'claude-md-global': {
      layer: 'memory', label: '~/.claude/CLAUDE.md', icon: 'file-text-o',
      title: '~/.claude/CLAUDE.md',
      description: 'Global **instructions** that apply to every project on your machine. Your personal preferences across all work.',
      example: '## Global preferences\n- Always use TypeScript strict mode\n- Prefer functional patterns\n- Explain reasoning before big changes',
      priority: 'Lowest-priority instruction file (project-level takes precedence over these)'
    },
    rules: {
      layer: 'memory', label: 'rules/', icon: 'book',
      title: 'rules/',
      description: "Modular **instruction** files that load alongside CLAUDE.md. The ~200-line threshold is a guideline, not a hard rule, split out when CLAUDE.md becomes unwieldy, or when different team members own different areas. Filenames don't affect behaviour; path-scoping is controlled entirely by frontmatter.",
      example: '# .claude/rules/api-conventions.md\n---\npaths:\n  - "src/handlers/**/*.ts"\n  - "src/api/**/*.ts"\n---\n# API Development Rules\n- All endpoints must validate with zod\n- Return { data, error } shape\n- Never expose internal error details',
      priority: 'Two loading modes depending on frontmatter',
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
      example: '{\n  "permissions": {\n    "allow": ["Bash(docker:*)"]\n  }\n}'
    },
    'settings-project': {
      layer: 'config', label: 'settings.json', icon: 'cog',
      title: 'settings.json (project)',
      description: 'Team-shared configuration. Permissions, model selection, tool allowlists, attribution settings.',
      example: '{\n  "permissions": {\n    "allow": ["Bash(npm test:*)", "Read(**)"],\n    "deny": ["Bash(rm:*)"]\n  },\n  "model": "claude-opus-4-7"\n}',
      priority: 'Team-level config'
    },
    'settings-global': {
      layer: 'config', label: '~/.claude/settings.json', icon: 'cog',
      title: '~/.claude/settings.json',
      description: 'Global config across all projects. Your default permission stance and machine-wide preferences.',
      priority: 'Lowest-priority config (project-level takes precedence over these)'
    },
    'builtin-tools': {
      layer: 'tools', label: 'built-in tools', icon: 'wrench',
      title: 'Built-in Tools',
      description: "The primitive actions Claude can take in your environment. These aren't files, they're capabilities baked into Claude Code. Every other layer interacts with tools: settings control which are allowed, skills describe when to use them, hooks fire around them, MCP adds new ones.",
      example: 'Read        , read a file\nWrite       , create a new file\nEdit        , modify an existing file\nBash        , run shell commands\nGrep        , search across files\nGlob        , match file patterns\nTask        , delegate to a subagent\nWebFetch    , fetch a URL',
      priority: 'Always available, cannot be removed, only restricted',
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
      priority: 'Auto-invoked by natural-language match'
    },
    commands: {
      layer: 'invocable', label: 'commands/', icon: 'bolt',
      title: 'commands/',
      description: 'Custom slash commands. Every `.md` file becomes `/project:name`. Explicit invocation, you type the command.',
      example: '# .claude/commands/review.md\n---\ndescription: Review current branch\n---\n## Diff\n!`git diff main...HEAD`\n\nReview for security issues and missing tests.',
      priority: 'Manual invocation (/project:review)'
    },
    agents: {
      layer: 'delegation', label: 'agents/', icon: 'android',
      title: 'agents/ (subagents)',
      description: 'Specialised subagents that run in their own **fresh context windows**. They have their own system prompt, restricted tool access, and optional model choice. The parent conversation receives only the subagent\u2019s final summary, not the files it read, tools it called, or intermediate reasoning.',
      example: '# .claude/agents/security-auditor.md\n---\nname: security-auditor\ndescription: Use PROACTIVELY after code\n  changes to check for security issues.\ntools: [Read, Grep, Glob]\nmodel: inherit\n---\nYou are a senior security specialist.\nFocus only on auth, input validation,\nand data exposure risks.\nReport findings with severity ratings.',
      priority: 'Invoked by description match, `@agent-name`, or via /agents',
      extended: {
        heading: 'Why subagents matter',
        body: [
          { label: 'Context isolation', text: "Main session stays clean. An audit that reads 40 files doesn\u2019t pollute your main conversation, only the summary returns. This is the primary reason to use them." },
          { label: 'Parallel execution', text: 'Multiple subagents run concurrently. A code review can dispatch style-checker, security-scanner, and test-coverage at once, minutes → seconds.' },
          { label: 'Tool restriction', text: "Scope each agent\u2019s tools precisely. A read-only reviewer doesn\u2019t need Write or Bash; a security auditor doesn\u2019t need Edit." },
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
      priority: 'Automatic on tool events'
    },
    mcp: {
      layer: 'external', label: '.mcp.json', icon: 'server',
      title: '.mcp.json',
      description: 'MCP server configuration. Unlike everything else here, MCP is an OPEN PROTOCOL, portable across Cursor, VS Code, and other clients. Extends Claude with external tools (databases, GitHub, Jira).',
      example: '{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["@modelcontextprotocol/server-postgres"]\n    },\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"]\n    }\n  }\n}',
      priority: 'Works with ANY MCP-compatible client'
    },
    worktrees: {
      layer: 'state', label: 'worktrees/', icon: 'sitemap',
      title: 'worktrees/',
      description: 'Git worktree isolation for parallel Claude sessions. Each worktree has its own branch and working directory. Created via `claude --worktree <n>`.',
      example: '.claude/worktrees/\n├── feature-auth/     (branch: worktree-feature-auth)\n├── bugfix-123/       (branch: worktree-bugfix-123)\n└── experiment-refactor/',
      priority: 'Run multiple Claude sessions in parallel without collisions'
    },
    sessions: {
      layer: 'state', label: 'projects/', icon: 'sitemap',
      title: '~/.claude/projects/',
      description: 'Session history stored per project directory. Each worktree gets its own session storage. Resumable via `claude --resume`.',
      example: '~/.claude/projects/\n└── Users-you-projects-myapp/\n    ├── sessions/\n    │   └── session-abc123.json\n    └── memory/\n        └── MEMORY.md',
      priority: 'Auto-memory: Claude saves observations across sessions'
    }
  };

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

  // ────────────────────────────── styles ───────────────────────────────

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = [
      '.claudeenv { max-width: 960px; margin: 0 auto; padding: 8px 0 24px; color: #333; --accent: #6a9fb5; --border: rgba(106, 159, 181, 0.22); --hairline: rgba(106, 159, 181, 0.12); --muted: #777; --card: #ffffff; }',
      '.claudeenv .ce-intro { color: #777; font-size: 0.92rem; max-width: 620px; margin: 0 auto 20px; line-height: 1.5; }',
      '.claudeenv .ce-section-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; letter-spacing: 0.25em; text-transform: uppercase; color: #999; }',
      /* Two equal columns. minmax(0, 1fr) prevents long strings inside the
         file tree or inspector from pushing either column wider than its
         share, which would make the layout jiggle on selection change. */
      '.claudeenv .ce-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: start; }',
      '@media (max-width: 760px) { .claudeenv .ce-grid { grid-template-columns: 1fr; } }',

      /* Layer bands */
      '.claudeenv .ce-bands { display: flex; flex-direction: column; gap: 2px; }',
      '.claudeenv .ce-bands-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }',
      '.claudeenv .ce-bands-header h3 { margin: 4px 0 0; font-size: 1.15rem; font-weight: 500; color: #222; }',
      '.claudeenv .ce-entry-band { width: 100%; text-align: left; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s, background 0.2s, opacity 0.2s; font: inherit; color: inherit; }',
      '.claudeenv .ce-entry-band.active { border-color: #d97706; background: rgba(217, 119, 6, 0.06); }',
      '.claudeenv .ce-entry-band.dimmed { opacity: 0.35; }',
      '.claudeenv .ce-entry-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }',
      '.claudeenv .ce-entry-head .fa { color: #d97706; font-size: 0.85rem; }',
      '.claudeenv .ce-entry-head .ce-layer-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: #d97706; }',
      '.claudeenv .ce-entry-cmd { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.88rem; color: #333; margin-bottom: 4px; }',
      '.claudeenv .ce-entry-cmd .dim { color: #aaa; }',
      '.claudeenv .ce-entry-cmd .mark { color: #b45309; }',
      '.claudeenv .ce-entry-note { font-size: 0.78rem; color: #777; margin: 0; }',
      '.claudeenv .ce-connector { display: flex; justify-content: center; margin: 6px 0; }',
      '.claudeenv .ce-connector::before { content: ""; width: 1px; height: 14px; background: linear-gradient(to bottom, transparent, var(--border), transparent); }',
      '.claudeenv .ce-band { width: 100%; text-align: left; border: none; background: transparent; padding: 10px 0 10px 14px; position: relative; cursor: pointer; transition: opacity 0.2s, background 0.2s; font: inherit; color: inherit; border-left: 2px solid currentColor; }',
      '.claudeenv .ce-band.dimmed { opacity: 0.3; }',
      '.claudeenv .ce-band.active { background: linear-gradient(90deg, rgba(0,0,0,0.02), transparent); }',
      '.claudeenv .ce-band:hover:not(.dimmed) { background: rgba(0,0,0,0.02); }',
      '.claudeenv .ce-band-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 3px; }',
      '.claudeenv .ce-band-title { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; }',
      '.claudeenv .ce-band-sublabel { font-size: 0.78rem; color: #999; font-style: italic; }',
      '.claudeenv .ce-band-count { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; color: #aaa; flex-shrink: 0; }',
      '.claudeenv .ce-band-desc { font-size: 0.78rem; color: #666; line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-clear-btn { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em; color: #999; background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }',
      '.claudeenv .ce-clear-btn:hover { color: #333; border-color: var(--accent); }',

      /* File tree */
      '.claudeenv .ce-panel { border: 1px solid var(--border); border-radius: 10px; background: var(--card); margin-bottom: 16px; overflow: hidden; }',
      '.claudeenv .ce-panel-head { border-bottom: 1px solid var(--hairline); padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }',
      '.claudeenv .ce-panel-head-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #999; }',
      '.claudeenv .ce-panel-head .fa { color: #bbb; font-size: 0.72rem; }',
      '.claudeenv .ce-tree { padding: 8px 6px; }',
      '.claudeenv .ce-tree-root { display: flex; align-items: center; gap: 6px; padding: 3px 8px; width: 100%; text-align: left; background: transparent; border: none; font: inherit; color: #555; cursor: pointer; border-radius: 4px; }',
      '.claudeenv .ce-tree-root:hover { color: #222; background: rgba(0,0,0,0.02); }',
      '.claudeenv .ce-tree-root .ce-chevron { font-size: 0.65rem; color: #aaa; transition: transform 0.2s; width: 10px; }',
      '.claudeenv .ce-tree-root .ce-chevron.open { transform: rotate(90deg); }',
      '.claudeenv .ce-tree-root .ce-home { color: #7c3aed; }',
      '.claudeenv .ce-tree-root .ce-folder { color: #d97706; }',
      '.claudeenv .ce-tree-root .ce-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; }',
      '.claudeenv .ce-tree-root .ce-scope { margin-left: auto; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: #bbb; }',
      '.claudeenv .ce-tree-children { margin-left: 10px; border-left: 1px solid var(--hairline); padding-left: 2px; }',
      '.claudeenv .ce-tree-spacer { height: 6px; }',
      '.claudeenv .ce-tree-node { display: flex; align-items: center; gap: 6px; padding: 3px 8px; width: 100%; text-align: left; background: transparent; border: none; font: inherit; color: #777; cursor: pointer; border-radius: 4px; position: relative; }',
      '.claudeenv .ce-tree-node:hover { color: #333; background: rgba(0,0,0,0.03); }',
      '.claudeenv .ce-tree-node.selected { background: rgba(217, 119, 6, 0.12); color: #9a3412; }',
      '.claudeenv .ce-tree-node.highlighted { background: rgba(106, 159, 181, 0.08); color: #333; }',
      '.claudeenv .ce-tree-node .fa { font-size: 0.75rem; color: #aaa; flex-shrink: 0; }',
      '.claudeenv .ce-tree-node.dir .fa { color: #0891b2; }',
      '.claudeenv .ce-tree-node .ce-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.76rem; }',
      '.claudeenv .ce-tree-node .ce-layer-dot { position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; }',
      '.claudeenv .ce-tree-static { display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 22px; color: #888; }',
      '.claudeenv .ce-tree-static .fa { color: #0891b2; font-size: 0.75rem; }',
      '.claudeenv .ce-tree-static .ce-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.76rem; }',
      '.claudeenv .ce-panel-foot { border-top: 1px solid var(--hairline); padding: 8px 14px; background: rgba(106, 159, 181, 0.04); font-size: 0.72rem; color: #777; line-height: 1.5; }',
      '.claudeenv .ce-panel-foot .star { color: #d97706; }',

      /* Inspector */
      '.claudeenv .ce-inspector { min-height: 280px; }',
      '.claudeenv .ce-inspector-body { padding: 16px; }',
      '.claudeenv .ce-inspector-layer-crumb { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }',
      '.claudeenv .ce-inspector-layer-dot { width: 8px; height: 8px; border-radius: 50%; }',
      '.claudeenv .ce-inspector-layer-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; background: none; border: none; padding: 0; cursor: pointer; }',
      '.claudeenv .ce-inspector h3 { font-size: 1.15rem; font-weight: 500; color: #222; margin: 2px 0 10px; }',
      '.claudeenv .ce-inspector .ce-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }',
      '.claudeenv .ce-inspector .ce-title-row .fa { color: var(--accent); font-size: 0.95rem; }',
      '.claudeenv .ce-inspector-desc { color: #555; font-size: 0.82rem; line-height: 1.65; margin: 0 0 14px; }',
      '.claudeenv .ce-inspector-pill { background: rgba(106, 159, 181, 0.06); border-left: 3px solid var(--accent); padding: 7px 12px; margin-bottom: 10px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.72rem; color: #555; border-radius: 2px; }',
      '.claudeenv .ce-inspector-pill.flow { border-left-color: #0891b2; background: rgba(8, 145, 178, 0.05); }',
      '.claudeenv .ce-inspector-section-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #aaa; margin-bottom: 6px; }',
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

      /* Empty state */
      '.claudeenv .ce-inspector-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: #999; }',
      '.claudeenv .ce-inspector-empty .fa { font-size: 1.4rem; color: #ccc; margin-bottom: 10px; }',
      '.claudeenv .ce-inspector-empty p { font-size: 0.8rem; margin: 0; max-width: 260px; line-height: 1.55; }',
      '.claudeenv .ce-close-btn { color: #aaa; background: transparent; border: none; cursor: pointer; font-size: 0.85rem; padding: 2px 4px; }',
      '.claudeenv .ce-close-btn:hover { color: #333; }',

      /* MCP callout */
      '.claudeenv .ce-mcp-callout { border: 1px solid rgba(37, 99, 235, 0.3); background: rgba(37, 99, 235, 0.05); border-radius: 8px; padding: 12px 14px; }',
      '.claudeenv .ce-mcp-callout-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.claudeenv .ce-mcp-callout-head .fa { color: #2563eb; }',
      '.claudeenv .ce-mcp-callout-head .ce-mcp-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: #2563eb; font-weight: 600; }',
      '.claudeenv .ce-mcp-callout p { font-size: 0.8rem; color: #555; line-height: 1.55; margin: 0; }',
      '.claudeenv .ce-mcp-callout .hl { color: #1d4ed8; font-weight: 600; }',

      /* Inline markdown */
      '.claudeenv .ce-bold { color: #9a3412; font-weight: 600; }',
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
      expandedProject: true
    };

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

    // Click anywhere outside the widget's interactive surfaces deselects
    // the current layer/file. Interactive surfaces call stopPropagation
    // on their own handlers so the document listener only fires for
    // clicks that landed in empty space.
    //
    // Using stopPropagation rather than a closest-match check dodges a
    // timing bug: internal click handlers rerender the widget, which
    // detaches the original event target from the DOM before the
    // document listener runs — so `target.closest()` would see no
    // ancestors and misclassify the click as "outside".
    document.addEventListener('click', function() {
      clearSelection();
    });

    // Helper: wraps a click handler so it won't bubble to the document.
    function hook(el, fn) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        fn(e);
      });
    }

    // Intro
    root.appendChild(el('p', { class: 'ce-intro' },
      'Click a layer band to see the files inside it; click a file to jump back to its layer.'
    ));

    var grid = el('div', { class: 'ce-grid' });
    root.appendChild(grid);

    var leftCol  = el('div', null);
    var rightCol = el('div', null);
    grid.appendChild(leftCol);
    grid.appendChild(rightCol);

    // Left: header + entry band + regular bands
    var leftHeader = el('div', { class: 'ce-bands-header' }, [
      el('div', null, [
        el('span', { class: 'ce-section-label' }, '§ 01'),
        el('h3', null, 'Flow of influence')
      ]),
      null // clear button goes here, rebuilt each render
    ]);
    leftCol.appendChild(leftHeader);

    var entryBand = el('button', { class: 'ce-entry-band', type: 'button' });
    hook(entryBand, function() { selectLayer('entry'); });
    leftCol.appendChild(entryBand);

    var entryConnector = el('div', { class: 'ce-connector' });
    leftCol.appendChild(entryConnector);

    var bandsWrap = el('div', { class: 'ce-bands' });
    leftCol.appendChild(bandsWrap);

    // Right: file tree panel + inspector panel + MCP callout
    var treePanel = el('div', { class: 'ce-panel' });
    treePanel.appendChild(el('div', { class: 'ce-panel-head' }, [
      el('span', { class: 'ce-panel-head-label' }, '§ 02: Filesystem'),
      fa('sitemap')
    ]));
    var treeBody = el('div', { class: 'ce-tree' });
    treePanel.appendChild(treeBody);
    treePanel.appendChild(el('div', { class: 'ce-panel-foot' }, [
      el('span', { class: 'star' }, '\u2605 '),
      renderDescription('Personal inputs (`.local`) take precedence over team files. Project-level takes precedence over user-level.')
    ]));
    rightCol.appendChild(treePanel);

    var inspectorPanel = el('div', { class: 'ce-panel ce-inspector' });
    rightCol.appendChild(inspectorPanel);

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
    rightCol.appendChild(mcpCallout);

    // Ordered layer ids (excluding 'entry' which has its own featured band)
    var LAYER_ORDER = ['memory', 'config', 'tools', 'invocable', 'delegation', 'automation', 'external', 'state'];

    // ─────────────────────────── render funcs ──────────────────────────

    function renderEntryBand() {
      var a = activeLayer();
      entryBand.classList.toggle('active', a === 'entry');
      entryBand.classList.toggle('dimmed', a !== null && a !== 'entry');
      entryBand.innerHTML = '';
      entryBand.appendChild(el('div', { class: 'ce-entry-head' }, [
        fa('terminal'),
        el('span', { class: 'ce-layer-label' }, 'Layer 0: Entry')
      ]));
      var cmd = el('div', { class: 'ce-entry-cmd' });
      cmd.appendChild(el('span', { class: 'dim' }, '$ '));
      cmd.appendChild(document.createTextNode('claude '));
      cmd.appendChild(el('span', { class: 'dim' }, '"'));
      cmd.appendChild(el('span', { class: 'mark' }, 'refactor the auth handler'));
      cmd.appendChild(el('span', { class: 'dim' }, '"'));
      entryBand.appendChild(cmd);
      entryBand.appendChild(el('p', { class: 'ce-entry-note' },
        'The user prompt. Everything else exists to shape how this is interpreted.'));
    }

    function renderBands() {
      bandsWrap.innerHTML = '';
      var a = activeLayer();
      LAYER_ORDER.forEach(function(id) {
        var layer = LAYERS[id];
        var band = el('button', { class: 'ce-band' + (a === id ? ' active' : a && a !== id ? ' dimmed' : ''), type: 'button', style: 'color: ' + layer.color });
        hook(band, function() { selectLayer(id); });
        band.appendChild(el('div', { class: 'ce-band-head' }, [
          el('div', { style: 'display: flex; align-items: baseline; gap: 10px; min-width: 0;' }, [
            el('span', { class: 'ce-band-title', style: 'color: ' + layer.color }, layer.label),
            el('span', { class: 'ce-band-sublabel' }, layer.sublabel)
          ]),
          el('span', { class: 'ce-band-count' },
            layer.nodes.length + ' ' + (layer.nodes.length === 1 ? 'file' : 'files'))
        ]));
        var desc = el('p', { class: 'ce-band-desc' });
        desc.appendChild(renderDescription(layer.description));
        band.appendChild(desc);
        bandsWrap.appendChild(band);
      });
    }

    function renderClearButton() {
      // Remove existing clear button (second child of leftHeader)
      while (leftHeader.children.length > 1) leftHeader.removeChild(leftHeader.lastChild);
      if (activeLayer()) {
        var btn = el('button', { class: 'ce-clear-btn', type: 'button' }, [fa('times'), document.createTextNode(' clear')]);
        hook(btn, clearSelection);
        leftHeader.appendChild(btn);
      } else {
        leftHeader.appendChild(document.createElement('span'));
      }
    }

    function renderTree() {
      treeBody.innerHTML = '';
      var hi = highlightedNodes();

      function treeNode(id, label, iconName, indent, isDir) {
        var node = NODES[id];
        var highlighted = hi.indexOf(id) !== -1;
        var selected = state.selectedNode === id;
        var layerColor = node && LAYERS[node.layer] ? LAYERS[node.layer].color : '#aaa';
        var btn = el('button', {
          class: 'ce-tree-node' + (isDir ? ' dir' : '') + (selected ? ' selected' : '') + (highlighted && !selected ? ' highlighted' : ''),
          type: 'button',
          style: 'padding-left: ' + (indent * 14 + 8) + 'px;'
        });
        hook(btn, function() { selectNode(id); });
        if (highlighted && !selected) {
          btn.appendChild(el('span', { class: 'ce-layer-dot', style: 'background: ' + layerColor + '; left: ' + (indent * 14) + 'px;' }));
        }
        btn.appendChild(fa(iconName));
        btn.appendChild(el('span', { class: 'ce-label' }, label));
        return btn;
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
        userChildren.appendChild(treeNode('claude-md-global', 'CLAUDE.md', 'file-text-o', 1));
        userChildren.appendChild(treeNode('settings-global', 'settings.json', 'cog', 1));
        userChildren.appendChild(treeNode('sessions', 'projects/', 'folder-o', 1, true));
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
        projectChildren.appendChild(treeNode('claude-md-project', 'CLAUDE.md', 'file-text-o', 1));
        projectChildren.appendChild(treeNode('claude-local', 'CLAUDE.local.md', 'file-text-o', 1));
        projectChildren.appendChild(el('div', { class: 'ce-tree-static' }, [
          fa('folder'),
          el('span', { class: 'ce-label' }, '.claude/')
        ]));
        projectChildren.appendChild(treeNode('settings-project', 'settings.json', 'cog', 2));
        projectChildren.appendChild(treeNode('settings-local', 'settings.local.json', 'cog', 2));
        projectChildren.appendChild(treeNode('mcp', '.mcp.json', 'server', 2));
        projectChildren.appendChild(treeNode('rules', 'rules/', 'folder-o', 2, true));
        projectChildren.appendChild(treeNode('commands', 'commands/', 'folder-o', 2, true));
        projectChildren.appendChild(treeNode('skills', 'skills/', 'folder-o', 2, true));
        projectChildren.appendChild(treeNode('agents', 'agents/', 'folder-o', 2, true));
        projectChildren.appendChild(treeNode('hooks', 'hooks/', 'folder-o', 2, true));
        projectChildren.appendChild(treeNode('worktrees', 'worktrees/', 'folder-o', 2, true));
        treeBody.appendChild(projectChildren);
      }
    }

    function renderInspector() {
      inspectorPanel.innerHTML = '';

      var head = el('div', { class: 'ce-panel-head' }, [
        el('span', { class: 'ce-panel-head-label' }, '§ 03: Inspector')
      ]);
      if (state.selectedNode || state.selectedLayer) {
        var closeBtn = el('button', { class: 'ce-close-btn', type: 'button' }, fa('times'));
        hook(closeBtn, clearSelection);
        head.appendChild(closeBtn);
      }
      inspectorPanel.appendChild(head);

      // Empty state
      if (!state.selectedNode && !state.selectedLayer) {
        inspectorPanel.appendChild(el('div', { class: 'ce-inspector-empty' }, [
          fa('info-circle'),
          el('p', null, 'Click a layer band to see its files in precedence order, or click a file in the tree to inspect it directly.')
        ]));
        return;
      }

      var body = el('div', { class: 'ce-inspector-body' });
      inspectorPanel.appendChild(body);

      // Layer view
      if (state.selectedLayer) {
        var layer = LAYERS[state.selectedLayer];
        body.appendChild(el('div', { class: 'ce-inspector-layer-crumb' }, [
          el('span', { class: 'ce-inspector-layer-dot', style: 'background: ' + layer.color }),
          el('span', { class: 'ce-inspector-layer-label', style: 'color: ' + layer.color }, layer.label)
        ]));
        body.appendChild(el('h3', null, layer.sublabel));
        var desc = el('p', { class: 'ce-inspector-desc' });
        desc.appendChild(renderDescription(layer.description));
        body.appendChild(desc);

        body.appendChild(el('div', { class: 'ce-inspector-section-label' },
          layer.nodes.length > 1 ? 'Files in this layer, higher = takes precedence' : 'File in this layer'));

        var pyramid = el('div', { class: 'ce-pyramid' });
        layer.nodes.forEach(function(nodeId, idx) {
          var n = NODES[nodeId];
          var item = el('button', {
            class: 'ce-pyramid-item' + (idx === 0 ? ' first' : ''),
            type: 'button',
            style: 'border-color: ' + (idx === 0 ? layer.color + '60' : 'var(--border)') +
                   (layer.nodes.length > 1 ? '; margin-left: ' + (idx * 6) + 'px; margin-right: ' + (idx * 6) + 'px' : '')
          });
          hook(item, function() { selectNode(nodeId); });
          if (layer.nodes.length > 1) {
            item.appendChild(el('span', { class: 'ce-pyramid-num', style: 'color: ' + (idx === 0 ? layer.color : '#aaa') }, String(idx + 1)));
          }
          item.appendChild(fa(n.icon, null));
          var main = el('div', { class: 'ce-pyramid-main' });
          main.appendChild(el('div', { class: 'ce-pyramid-label' }, n.label));
          if (n.priority) main.appendChild(el('div', { class: 'ce-pyramid-priority' }, n.priority));
          item.appendChild(main);
          item.appendChild(fa('external-link', 'ce-pyramid-arrow'));
          pyramid.appendChild(item);
        });
        body.appendChild(pyramid);
        return;
      }

      // Node view
      var node = NODES[state.selectedNode];
      var pLayer = LAYERS[node.layer];
      var crumb = el('div', { class: 'ce-inspector-layer-crumb' });
      crumb.appendChild(el('span', { class: 'ce-inspector-layer-dot', style: 'background: ' + pLayer.color }));
      var layerLink = el('button', { class: 'ce-inspector-layer-label', type: 'button', style: 'color: ' + pLayer.color },
        '\u2190 ' + pLayer.label);
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

    function rerender() {
      renderEntryBand();
      renderBands();
      renderClearButton();
      renderTree();
      renderInspector();
    }

    rerender();
  };
})();
