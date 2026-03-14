# Quick Start

This page gives the shortest path from zero to a first successful `maoclaw` session.

## 1. Who This Is For

Recommended if you want to:

- use an AI coding agent directly in a local repository
- keep the familiar `pi` workflow while moving to the Rust runtime
- validate CLI, session, tooling, and integration basics quickly

## 2. What You Need

- a macOS development machine
- a working terminal
- at least one provider API key
- a local project directory

Current recommended providers:

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## 3. Install

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

Verify:

```bash
pi --version
pi --help
```

## 4. Configure a Provider

Anthropic:

```bash
export ANTHROPIC_API_KEY="your-key"
```

OpenAI:

```bash
export OPENAI_API_KEY="your-key"
```

Google / Gemini:

```bash
export GOOGLE_API_KEY="your-key"
```

## 5. Start

From your project directory:

```bash
pi
```

Or start with a prompt:

```bash
pi "Summarize this repository structure and its main modules"
```

## 6. Recommended First Tests

Run these five actions first:

1. ask for a repository summary
2. search for a TODO, FIXME, or function
3. explain an error
4. suggest a small edit
5. continue the previous session

Examples:

```bash
pi @src/main.rs "Explain what this file does"
pi "Find the three highest-priority risks in this repository"
pi --continue
```

## 7. Next

Continue with:

- [Installation and Deployment](installation-and-deployment.md)
- [Usage and Configuration](usage-and-configuration.md)
- [Providers and API Keys](provider-and-auth.md)
- [Integrations and Automation](integrations.md)
