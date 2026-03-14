# Provider 与 API 密钥配置

本页说明如何为 `猫爪 / maoclaw` 配置模型服务商。

## 1. 最快的配置方式

先设置环境变量，然后直接运行 `pi`。

```bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
export AZURE_OPENAI_API_KEY="your-key"
```

验证：

```bash
pi --list-providers
pi --list-models
```

## 2. 首选 Provider

当前最推荐的起步组合：

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## 3. 常见问题

最常见的失败原因：

- API Key 没有设置
- Key 已失效
- 环境变量名称写错
- Provider 选错

排查时先确认：

```bash
echo "$ANTHROPIC_API_KEY"
echo "$OPENAI_API_KEY"
```

## 4. 更完整的 Provider 参考

如果你要使用更多运营商、区域 Provider 或 OpenAI-compatible 网关，请继续阅读：

- [../../providers.md](../../providers.md)
- [../../provider-auth-troubleshooting.md](../../provider-auth-troubleshooting.md)

这些文档已经整理了 Provider ID、别名、环境变量和认证故障排查方式。

## 5. 面向小白用户的推荐顺序

1. 先选一个主 Provider
2. 只配置一个 API Key
3. 先跑通 `pi`
4. 再考虑多 Provider、多模型、多网关切换

这样能显著降低首次使用失败率。
