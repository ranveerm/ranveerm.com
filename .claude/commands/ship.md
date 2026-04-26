# /ship

Commit the current changes (using the guidelines below), then propagate them to `main` and push to `origin`. If the work was done on a feature branch, rebase that branch on `main` afterwards so it stays current.

## Workflow

1. **Capture the working branch.**
   - Run `git rev-parse --abbrev-ref HEAD` and remember the result as `<branch>`.

2. **Commit any pending changes** (skip if `git status` is clean).
   Follow the same conventions as `/commit`:
   - Run `git status`, `git diff HEAD`, and `git log --oneline -8` in parallel to understand the state and follow the project's commit-message style.
   - Pick the right emoji prefix(es) per the guide below.
   - Draft a concise message: `<emoji(s)> <imperative summary>` (≤ 72 chars total). Optional body explains *why*, not *what*.
   - Stage **specific files** by name (never `git add .` / `-A`). Never include `.env`, credentials, or local-only configs.
   - Commit with a HEREDOC, ending with `Co-Authored-By: Claude <noreply@anthropic.com>`.

3. **Refresh local `main`.**
   - `git fetch origin`
   - If `<branch>` is `main`, run `git pull --ff-only origin main`.
   - Otherwise, `git checkout main && git pull --ff-only origin main`.

4. **Merge the working branch into `main`** (only if `<branch>` ≠ `main`).
   - `git merge --ff-only <branch>`
   - If the merge can't fast-forward, **stop and ask the user** — their branch likely needs to be rebased on the new `main` first. Don't force.

5. **Push `main` to `origin`.**
   - `git push origin main`

6. **Return to the working branch and rebase** (only if `<branch>` ≠ `main`).
   - `git checkout <branch>`
   - `git rebase main` — usually a no-op after the fast-forward merge, but safe to run and brings in any independent commits to `main` that landed during the operation.

7. **Confirm.** Run `git status` to verify a clean tree on `<branch>`.

## Emoji prefix guide (same as `/commit`)

Pick one or more, most specific first:

| Emoji | When to use |
|-------|-------------|
| ➕ | New files added |
| 🗑️ | Files deleted |
| 🧹 | Cleanup / dead code removal |
| 🪛 | Fine-tuning / small tweaks |
| 🎨 | Visual / UI changes |
| 🚀 | CI/CD / build / deployment |
| 🪄 | New logic / features |
| 🧪 | Tests added or updated |

Multiple emojis are fine when the commit genuinely spans categories (e.g. `🪄🎨` for a new feature with visual work).

## Safety rules

- **Never amend** an existing commit — always create a new one.
- **Never skip hooks** (`--no-verify`).
- **Never force-push** to `main` (or any shared branch).
- **Never commit secrets** — warn the user and stop if any appear in the diff.
- If any step fails (merge conflict, push rejection, dirty tree, hook failure), **stop and explain** rather than working around. Diagnose the root cause; let the user decide how to proceed.
- Use `git pull --ff-only` (not a plain `pull`) so an unexpected diverge surfaces as an error instead of an automatic merge commit.
