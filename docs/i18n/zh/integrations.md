# 集成与自动化

本页说明如何把 `猫爪 / maoclaw` 接入你的客户端、IDE 或自动化流程。

## 1. RPC 模式

最稳定的集成入口是：

```bash
pi --mode rpc
```

它通过 stdin/stdout 传输 JSON Lines。适合：

- IDE 前端
- 自定义桌面壳层
- 自动化控制器
- Agent 代理或编排程序

详细协议参考：

- [../../rpc.md](../../rpc.md)

## 2. 自动化输出

如果你不需要持续会话，可以先用：

```bash
pi -p "总结这个项目"
pi --mode json -p "返回结构化结果"
```

这比一开始就构建完整 RPC 客户端更轻量。

## 3. 桌面壳层

当前桌面版与 CLI 共用同一 Rust 运行时、Provider 和会话模型。  
也就是说，桌面不是另一套后端，只是不同的产品表面。

## 4. 适合的集成策略

- 需要最小工作量：先用 `-p` 或 `--mode json`
- 需要会话和事件：用 `--mode rpc`
- 需要图形界面：在 RPC 之上构建自己的客户端

## 5. 会话与资源

在集成场景里，建议同时考虑：

- 设置文件
- 会话持久化
- skills / prompts / themes
- Provider 凭据来源

相关文档：

- [../../settings.md](../../settings.md)
- [../../session.md](../../session.md)
- [../../skills.md](../../skills.md)
