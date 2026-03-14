# Integrations and Automation

This page explains how to integrate `maoclaw` with a client, IDE, or automation system.

## 1. RPC Mode

The cleanest integration seam is:

```bash
pi --mode rpc
```

It communicates over stdin/stdout using JSON Lines and works well for:

- IDE frontends
- custom desktop shells
- automation controllers
- agent proxy or orchestration layers

Protocol reference:

- [../../rpc.md](../../rpc.md)

## 2. Lightweight Automation

If you do not need a long-lived client first, start with:

```bash
pi -p "Summarize this project"
pi --mode json -p "Return structured output"
```

That is much simpler than building a full RPC client from day one.

## 3. Desktop Shell

The desktop app and the CLI share the same Rust runtime, provider model, and session model.  
The desktop surface is a product shell, not a separate backend stack.

## 4. Recommended Integration Strategy

- lowest effort: `-p` or `--mode json`
- session and event driven: `--mode rpc`
- full GUI product: build a client on top of RPC

## 5. Session and Resource Considerations

For integrations, also plan around:

- settings paths
- session persistence
- skills, prompts, and themes
- provider credential sources

References:

- [../../settings.md](../../settings.md)
- [../../session.md](../../session.md)
- [../../skills.md](../../skills.md)
