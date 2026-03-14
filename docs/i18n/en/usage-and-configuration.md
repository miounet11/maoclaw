# Usage and Configuration

This page covers common commands, resource paths, and settings for `maoclaw`.

## 1. Common Commands

Interactive:

```bash
pi
```

Single prompt:

```bash
pi -p "Explain the most likely cause of this error"
```

Prompt with file context:

```bash
pi @Cargo.toml "What are the key dependencies in this project?"
```

Continue sessions:

```bash
pi --continue
pi --resume
```

Choose a model:

```bash
pi --model claude-opus-4 "Review the design of this module"
```

Inspect providers and models:

```bash
pi --list-providers
pi --list-models
```

## 2. Automation Modes

```bash
pi -p "Return a short summary"
pi --mode json -p "Return structured output"
pi --mode rpc
```

## 3. Settings Paths

Global settings:

- `~/.pi/agent/settings.json`

Project settings:

- `.pi/settings.json`

Inspect effective config paths:

```bash
pi config
```

Precedence order:

1. CLI flags
2. environment variables
3. project settings
4. global settings
5. built-in defaults

## 4. Skills, Prompts, and Themes

Global directory:

- `~/.pi/agent/skills/`

Project directory:

- `.pi/skills/`

References:

- [../../skills.md](../../skills.md)
- [../../prompt-templates.md](../../prompt-templates.md)
- [../../themes.md](../../themes.md)

## 5. Recommended Setup Pattern

- solo developers: configure one default provider and one default model
- project teams: add repo-level defaults in `.pi/settings.json`
- advanced users: layer in skills, prompts, and themes later

## 6. Naming Compatibility

- product name: `猫爪 / maoclaw`
- compatibility command: `pi`

That naming split is intentional in the current release.
