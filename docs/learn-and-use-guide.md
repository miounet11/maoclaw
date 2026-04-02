# Learn And Use maoclaw

This guide is for people who are new to `maoclaw` and want the fastest path from zero to productive use.

The goal is simple:

- install it
- connect one provider
- run one successful prompt
- learn the few commands that matter every day

## What maoclaw is

`maoclaw` is an open-source Rust agent runtime.
You can use it directly in the terminal, run it as an RPC backend, embed it in a product, or package it as a desktop app.

If you are just starting, ignore the bigger architecture story and focus on one thing:

get one working interactive loop first.

## Step 1: Install it

Install the latest public build:

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

Then confirm the install:

```bash
mao --version
mao --help
```

If you are migrating from older docs or older habits, you may still see `pi` in some compatibility paths.
For new users, prefer `mao`.

## Step 2: Set one provider key

Pick one provider and set one API key.

Examples:

```bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
export AZURE_OPENAI_API_KEY="your-key"
```

Then inspect what the runtime can see:

```bash
mao --list-providers
mao --list-models
```

If provider setup is unclear, use:

- [providers.md](providers.md)
- [provider-auth-troubleshooting.md](provider-auth-troubleshooting.md)

## Step 3: Run your first successful prompt

Start interactive mode:

```bash
mao
```

Or run a one-shot prompt:

```bash
mao "Summarize this repository"
```

If you want non-interactive output:

```bash
mao -p "Explain this error"
mao --mode json -p "Return a structured summary"
```

At this point, you are already using the real runtime.

## Step 4: Learn the core daily workflow

Most users only need a small set of habits.

### Habit A: stay in one session

Use interactive mode when you want continuity:

```bash
mao
mao --continue
```

This is the fastest way to get useful memory and context without rebuilding everything every time.

### Habit B: use one-shot mode for automation

Use print or JSON mode when you want:

- shell scripting
- CI glue
- external wrappers
- structured post-processing

Examples:

```bash
mao -p "Summarize recent changes"
mao --mode json -p "Return a release summary"
```

### Habit C: check your environment before guessing

Use the built-in health and config commands:

```bash
mao doctor
mao config --show
```

If something feels wrong, these commands are usually better than blind debugging.

## Step 5: Learn what you can customize

Once the base flow works, there are four important customization layers:

- skills
- prompt templates
- themes
- extensions

Start with:

- [skills.md](skills.md)
- [prompt-templates.md](prompt-templates.md)
- [themes.md](themes.md)
- [extension-architecture.md](extension-architecture.md)

Do not try to learn every extension/runtime detail on day one.
Get one working session loop first, then add customization one layer at a time.

## Step 6: Choose your real usage mode

`maoclaw` supports multiple usage patterns.
Pick the one that matches your job instead of trying all of them at once.

### Mode A: terminal-first individual usage

Best for:

- developers
- researchers
- operators
- power users

Use:

- `mao`
- `mao --continue`
- `mao doctor`

### Mode B: shell automation

Best for:

- scripts
- CI jobs
- small wrappers

Use:

- `mao -p "..."`
- `mao --mode json -p "..."`

### Mode C: integration backend

Best for:

- editor integrations
- external UI shells
- custom clients

Use:

```bash
mao --mode rpc
```

Then read [rpc.md](rpc.md).

### Mode D: product shell / desktop distribution

Best for:

- non-terminal users
- internal team rollout
- branded distribution

Use:

- desktop package artifacts
- the same provider/session model as the CLI

Then read [deployment-guide.md](deployment-guide.md).

## Common beginner mistakes

### 1. Trying every feature before basic success

Do not start with:

- themes
- desktop packaging
- RPC integration
- extension loading

Start with:

- install
- one provider key
- one successful prompt

### 2. Mixing command names

For new usage, prefer `mao`.
If you also see `pi`, treat it as compatibility, not the main learning path.

### 3. Skipping health checks

When provider auth or config looks wrong, run:

```bash
mao doctor
mao config --show
```

### 4. Treating the desktop app as a different runtime

It is not a separate backend.
The desktop surface uses the same core runtime model.

## A 10-minute learning plan

If you want the shortest reasonable onboarding path:

1. Install `maoclaw`.
2. Run `mao --version`.
3. Set one provider key.
4. Run `mao --list-providers`.
5. Run `mao "hello"` or enter `mao` interactive mode.
6. Run `mao doctor`.
7. Read `docs/deployment-guide.md`.
8. Read `docs/skills.md` only after the first successful session.

## Where to go next

After the first successful loop:

- installation and deployment: [deployment-guide.md](deployment-guide.md)
- providers and auth: [providers.md](providers.md)
- troubleshooting: [troubleshooting.md](troubleshooting.md)
- session behavior: [session.md](session.md)
- RPC integration: [rpc.md](rpc.md)
- SDK embedding: [sdk.md](sdk.md)
- customization: [reskin-guide.md](reskin-guide.md)

If you are a team evaluating whether to fork or brand the product, read [reskin-guide.md](reskin-guide.md) next.
