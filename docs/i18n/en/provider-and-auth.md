# Providers and API Keys

This page explains how to configure model providers for `maoclaw`.

## 1. Fastest Setup

Set one provider key and then run `pi`.

```bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
export AZURE_OPENAI_API_KEY="your-key"
```

Verify:

```bash
pi --list-providers
pi --list-models
```

## 2. Recommended Providers

The easiest starting path today is:

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## 3. Common Failure Modes

Most authentication failures come from:

- missing API keys
- expired keys
- wrong environment variable names
- choosing the wrong provider

Quick checks:

```bash
echo "$ANTHROPIC_API_KEY"
echo "$OPENAI_API_KEY"
```

## 4. Full Provider Reference

If you need more operators, regional providers, or OpenAI-compatible gateways, continue with:

- [../../providers.md](../../providers.md)
- [../../provider-auth-troubleshooting.md](../../provider-auth-troubleshooting.md)

Those references already map provider IDs, aliases, env vars, endpoints, and failure signatures.

## 5. Recommended New-User Order

1. choose one primary provider
2. configure one API key
3. get `pi` working
4. only then add multiple providers, models, or gateway routing

That sequence lowers first-run failure rates substantially.
