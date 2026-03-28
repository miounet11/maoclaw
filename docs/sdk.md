# SDK Cookbook and Migration Guide

This guide is for teams embedding Pi as a Rust library and migrating from the TypeScript SDK surface.

## Install

```toml
[dependencies]
pi = { path = "." }
futures = "0.3"
```

## Migration Map (TypeScript -> Rust)

| TypeScript surface | Rust SDK surface |
| --- | --- |
| `createAgentSession(options)` | `pi::sdk::create_agent_session(SessionOptions)` |
| `session.prompt(text, onEvent)` | `AgentSessionHandle::prompt(text, on_event)` |
| `session.prompt(contentBlocks, onEvent)` | `AgentSessionHandle::prompt_with_content(blocks, on_event)` |
| `session.subscribe(listener)` | `AgentSessionHandle::subscribe(listener)` |
| `unsubscribe()` | `AgentSessionHandle::unsubscribe(subscription_id)` |
| `session.setModel(provider, model)` | `AgentSessionHandle::set_model(provider, model)` |
| `session.setThinkingLevel(level)` | `AgentSessionHandle::set_thinking_level(level)` |
| `session.setSessionName(name)` | `AgentSessionHandle::set_session_name(name)` |
| `session.newSession(parentSession?)` | `AgentSessionHandle::new_session(parent_session)` |
| `session.switchSession(path)` | `AgentSessionHandle::switch_session(path)` |
| `session.fork(entryId)` | `AgentSessionHandle::fork(entry_id)` |
| `session.compact()` | `AgentSessionHandle::compact(on_event)` |
| `session.abort()` | `AgentSessionHandle::new_abort_handle()` + `prompt_with_abort(...)` |
| `session.steer(...)`, `session.followUp(...)` | `RpcTransportClient::steer(...)`, `RpcTransportClient::follow_up(...)` or in-process `queue_steering(...)` / `queue_follow_up(...)` + `continue_turn(...)` |
| RPC bridge client | `RpcTransportClient` / `SessionTransport::RpcSubprocess` |

## Recipe 1: Create In-Process Session and Prompt

```rust
use futures::executor::block_on;
use pi::sdk::{AgentEvent, SessionOptions, create_agent_session};

fn main() -> pi::sdk::Result<()> {
    let mut session = block_on(create_agent_session(SessionOptions {
        provider: Some("openai".to_string()),
        model: Some("gpt-4o".to_string()),
        api_key: Some(std::env::var("OPENAI_API_KEY").unwrap_or_default()),
        no_session: true,
        ..SessionOptions::default()
    }))?;

    let message = block_on(session.prompt("Summarize src/sdk.rs", |event: AgentEvent| {
        eprintln!("{event:?}");
    }))?;

    println!("{message:#?}");
    Ok(())
}
```

## Recipe 1b: Prompt With Explicit Content Blocks

```rust
use futures::executor::block_on;
use pi::model::{ContentBlock, TextContent};
use pi::sdk::{SessionOptions, create_agent_session};

fn main() -> pi::sdk::Result<()> {
    let mut session = block_on(create_agent_session(SessionOptions::default()))?;
    let blocks = vec![ContentBlock::Text(TextContent::new("Summarize the repo state"))];

    let message = block_on(session.prompt_with_content(blocks, |_event| {}))?;
    println!("{message:#?}");
    Ok(())
}
```

## Recipe 2: Session-Level Subscribers and Typed Hooks

```rust
use futures::executor::block_on;
use pi::sdk::{SessionOptions, create_agent_session};
use std::sync::Arc;

fn main() -> pi::sdk::Result<()> {
    let options = SessionOptions {
        on_tool_start: Some(Arc::new(|tool, args| eprintln!("tool start: {tool} {args}"))),
        on_tool_end: Some(Arc::new(|tool, output, is_error| {
            eprintln!("tool end: {tool}, error={is_error}, output={output:?}");
        })),
        on_stream_event: Some(Arc::new(|ev| eprintln!("stream: {ev:?}"))),
        ..SessionOptions::default()
    };

    let mut session = block_on(create_agent_session(options))?;
    let sub_id = session.subscribe(|event| eprintln!("session event: {event:?}"));

    let _ = block_on(session.prompt("read Cargo.toml", |_| {}))?;
    let _removed = session.unsubscribe(sub_id);
    Ok(())
}
```

## Recipe 3: Prompt Cancellation

```rust
use futures::executor::block_on;
use pi::sdk::{AgentSessionHandle, SessionOptions, create_agent_session};

fn main() -> pi::sdk::Result<()> {
    let mut session = block_on(create_agent_session(SessionOptions::default()))?;

    let (abort_handle, abort_signal) = AgentSessionHandle::new_abort_handle();
    let fut = session.prompt_with_abort("long running prompt", abort_signal, |_| {});
    abort_handle.abort();
    let _ = block_on(fut);
    Ok(())
}
```

## Recipe 4: Model and Thinking Controls

```rust
use futures::executor::block_on;
use pi::model::ThinkingLevel;
use pi::sdk::{SessionOptions, create_agent_session};

fn main() -> pi::sdk::Result<()> {
    let mut session = block_on(create_agent_session(SessionOptions::default()))?;
    block_on(session.set_model("openai", "gpt-4o"))?;
    block_on(session.set_thinking_level(ThinkingLevel::Low))?;

    let state = block_on(session.state())?;
    println!("provider={} model={}", state.provider, state.model_id);
    Ok(())
}
```

## Recipe 4b: Queue Modes And Pending Messages

```rust
use futures::executor::block_on;
use pi::agent::QueueMode;
use pi::sdk::{SessionOptions, create_agent_session};

fn main() -> pi::sdk::Result<()> {
    let mut session = block_on(create_agent_session(SessionOptions::default()))?;
    session.set_queue_modes(QueueMode::All, QueueMode::OneAtATime);
    session.queue_follow_up("Run one more pass after the current turn");

    let state = block_on(session.state())?;
    println!("pending={}", state.pending_message_count);
    Ok(())
}
```

## Recipe 4c: Session Lifecycle Controls

```rust
use futures::executor::block_on;
use pi::sdk::{SessionOptions, create_agent_session};

fn main() -> pi::sdk::Result<()> {
    let mut session = block_on(create_agent_session(SessionOptions::default()))?;
    block_on(session.set_session_name("demo"))?;

    let _ = block_on(session.new_session(None))?;
    let _ = block_on(session.fork("entry-id"))?;
    Ok(())
}
```

## Recipe 5: Load Extensions in SDK Sessions

```rust
use futures::executor::block_on;
use pi::sdk::{SessionOptions, create_agent_session};
use std::path::PathBuf;

fn main() -> pi::sdk::Result<()> {
    let session = block_on(create_agent_session(SessionOptions {
        extension_paths: vec![PathBuf::from("extensions/my_extension.js")],
        extension_policy: Some("safe".to_string()),
        repair_policy: Some("ask".to_string()),
        ..SessionOptions::default()
    }))?;

    if session.has_extensions() {
        eprintln!("extensions loaded");
    }
    Ok(())
}
```

## Recipe 6: Use RPC Transport Client

```rust
use futures::executor::block_on;
use pi::sdk::{RpcTransportClient, RpcTransportOptions};

fn main() -> pi::sdk::Result<()> {
    let mut rpc = RpcTransportClient::connect(RpcTransportOptions::default())?;

    let state = block_on(rpc.get_state())?;
    println!("rpc session id: {}", state.session_id);

    let events = block_on(rpc.prompt("Hello from RPC"))?;
    println!("received {} rpc events", events.len());

    rpc.shutdown()?;
    Ok(())
}
```

## Recipe 7: Unified Transport Adapter (In-Process or RPC)

```rust
use futures::executor::block_on;
use pi::sdk::{SessionOptions, SessionTransport};

fn main() -> pi::sdk::Result<()> {
    let mut transport = block_on(SessionTransport::in_process(SessionOptions::default()))?;

    let _result = block_on(transport.prompt("Status?", |_event| {}))?;
    let _state = block_on(transport.state())?;
    transport.shutdown()?;
    Ok(())
}
```

## Compatibility Notes for Migrating Integrators

- `SessionOptions::default().no_session` is `true` (ephemeral by default).
- In-process `AgentSessionHandle` exposes prompt/state/model/thinking/session-lifecycle/compaction flows plus queue inspection/control (`set_session_name`, `new_session`, `switch_session`, `fork`, `queue_steering`, `queue_follow_up`, `set_queue_modes`, `pending_message_count`).
- `prompt_with_content` accepts user-facing text/image blocks only. Unsupported block kinds fail closed instead of being silently ignored.
- `SessionTransport` now exposes `prompt_with_content`, `set_thinking_level`, `set_queue_modes`, `set_session_name`, `new_session`, `switch_session`, and `fork` so callers can share more logic between in-process and RPC transports.
- `SessionTransport::prompt` returns `SessionPromptResult`, which is `InProcess(AssistantMessage)` or `RpcEvents(Vec<Value>)` depending on backend.
- Extension loading is opt-in via `extension_paths`, with `extension_policy`/`repair_policy` controls.

## Verified Reference Surfaces

- `src/sdk.rs`
- `tests/sdk_api.rs`
- `tests/sdk_unit.rs`
- `tests/sdk_integration.rs`
