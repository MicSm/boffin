# Boffin on OpenCode

Boffin installs on OpenCode as a project-local host: shared packs, an always-on
contract via `opencode.json`, and native skills and commands. Cursor and
OpenCode can coexist in the same project.

Prerequisite: OpenCode is installed and a provider is connected (`/connect`).

Project install (default):

```bash
cd /path/to/project
npx boffinit opencode
opencode
```

## What you get

- Always-on contract via `opencode.json` `instructions` -> `.boffin/AGENTS.md`
- Skills: `boffin`, `boffin-review` under `.opencode/skills/`
- Commands: `/boffin`, `/boffin-review` under `.opencode/commands/`
- Profile in `.boffin/profile` (`lite` | `full` | `max`; default `full`)

## Troubleshooting

- Skill names must be unique. Boffin ships only under `.opencode/skills/` (not also under `.claude/skills/`).
- `SKILL.md` frontmatter needs `name` and `description` (1-1024 chars); `name` must match the directory.
- If the host only has `opencode.jsonc`, boffinit does not create a competing `opencode.json`. Add `".boffin/AGENTS.md"` to that file's `instructions` array manually (boffinit prints this note and still installs packs, skills, and commands).
- Update never resets a chosen `.boffin/profile`.

## Uninstall

```bash
npx boffinit opencode uninstall
```

Removes OpenCode-owned files and the `.boffin/AGENTS.md` instruction entry. Shared `.boffin/packs` and `.boffin/VERSION` stay if Cursor is still installed.
