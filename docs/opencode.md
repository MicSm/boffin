# Boffin on OpenCode

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
- If the host only has `opencode.jsonc`, boffinit does not create a competing `opencode.json`. Add `".boffin/AGENTS.md"` to that file's `instructions` array, or use the root-`AGENTS.md` inject fallback after host smoke fails.
- Update never resets a chosen `.boffin/profile`.

## Uninstall

```bash
npx boffinit opencode uninstall
```

Removes OpenCode-owned files and the `.boffin/AGENTS.md` instruction entry. Shared `.boffin/packs` and `.boffin/VERSION` stay if Cursor is still installed.
