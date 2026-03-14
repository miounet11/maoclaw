# 快速开始

本页提供从零到首次成功运行 `猫爪 / maoclaw` 的最短路径。

## 1. 适用对象

推荐给以下用户：

- 想在本地代码仓库里直接使用 AI coding agent
- 希望保留 `pi` 工作流但升级到底层 Rust 运行时
- 希望快速验证 CLI、会话、工具调用和基础集成能力

## 2. 你需要准备什么

- 一台 macOS 开发机器
- 一个终端
- 至少一个可用的模型服务商 API Key
- 一个本地项目目录

当前优先推荐：

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## 3. 安装

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

验证安装：

```bash
pi --version
pi --help
```

## 4. 配置一个 Provider

最简单的方法是先设置一个环境变量。

Anthropic：

```bash
export ANTHROPIC_API_KEY="your-key"
```

OpenAI：

```bash
export OPENAI_API_KEY="your-key"
```

Google / Gemini：

```bash
export GOOGLE_API_KEY="your-key"
```

## 5. 启动

进入你的项目目录后执行：

```bash
pi
```

或直接带一句任务：

```bash
pi "请总结这个仓库的结构和主要模块"
```

## 6. 第一轮建议测试

建议先测试这 5 个动作：

1. 让它总结仓库结构
2. 让它搜索 TODO / FIXME / 某个函数
3. 让它解释一个报错
4. 让它提出一个小改动建议
5. 让它继续上一次会话

示例：

```bash
pi @src/main.rs "解释这个文件做了什么"
pi "帮我找出这个仓库最值得优先修复的 3 个风险点"
pi --continue
```

## 7. 下一步

首次跑通后，继续阅读：

- [安装与部署](installation-and-deployment.md)
- [使用与配置](usage-and-configuration.md)
- [Provider 与 API 密钥配置](provider-and-auth.md)
- [集成与自动化](integrations.md)
