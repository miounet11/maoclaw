# FAQ

## What is maoclaw?

`猫爪 / maoclaw` is an independently developed AI coding agent project from China built around a terminal-first Rust runtime.

## Why is the command still `pi`?

Because the current release keeps the compatibility command to reduce migration friction. That is intentional.

## Is this already a fully stable commercial release?

Not yet. The public posture is still trial release plus active iteration.

## Is it a full replacement for Pi / OpenClaw today?

That claim would be too strong. The current direction is migration-first, not strict drop-in replacement.

## What is it best for right now?

- local repository analysis
- code search and explanation
- lightweight edit suggestions
- session continuation
- baseline RPC integration

## Which built-in tools are currently available?

- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

## Which providers are the best starting point?

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## What should I check if first run fails?

1. `pi --version`
2. API key is present
3. current directory is correct
4. provider is available
5. start with the simplest command first

## Where is the longer FAQ?

- [../../maozhua-v0.1-faq.md](../../maozhua-v0.1-faq.md)
