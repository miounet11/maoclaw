# 猫爪 v0.1 Quick Start

Status: Draft  
Audience: Trial users, design partners, early adopters  
Brand: 猫爪  
Companions: [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md), [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md), [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md), [../STATUS.md](../STATUS.md), [../README.md](../README.md)

## 1. 这是什么

猫爪 v0.1 是一个终端优先的 AI coding agent 试用版。

它的上线思路是 migration-first：

- 先把一条可信的 Pi 迁移主路径做出来
- 先支持可以被验证的高频 CLI 工作流
- 不在首版就宣称 strict drop-in replacement

它适合你在本地代码仓库中做这些事情：

- 读代码并解释结构
- 搜索符号、TODO 和关键逻辑
- 修改文件中的小问题
- 调用 shell 命令
- 保存和继续会话

> 当前主仓库是 `miounet11/maoclaw`，但首版兼容命令仍然使用 `pi`。

## 2. 试用前你需要准备什么

建议准备以下条件：

- 一台 macOS 设备
- 一个可正常使用的终端
- 至少一个模型提供方的可用凭据
- 一个你想试用的本地项目目录

首版优先推荐的 provider：

- Anthropic
- OpenAI
- Gemini
- Azure OpenAI

## 3. 最短成功路径

如果你只想尽快跑通一次成功体验，建议按下面 5 步做。

### Step 1: 安装

使用安装脚本安装：

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

安装完成后，确认命令可用：

```bash
pi --version
```

如果你机器上已经有旧版 TypeScript `pi`，安装器可能会提示迁移或保留旧命令。

推荐优先采用两条路径之一：

- adopt existing `pi`：把当前主命令迁到 Rust 版本
- keep existing `pi`：先保留旧版，再按文档做并存评估

详细迁移路径见 [integrator-migration-playbook.md](integrator-migration-playbook.md)。

## 4. 配置一个 provider

最简单的方式是设置环境变量。

例如 Anthropic：

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

例如 OpenAI：

```bash
export OPENAI_API_KEY="your-key-here"
```

配置完成后，可以直接进入试用目录。

## 5. 启动猫爪

进入你的项目目录后运行：

```bash
pi
```

或者直接带一句初始问题：

```bash
pi "请总结这个仓库的结构和主要模块"
```

## 6. 先试 3 个最稳的用法

### 用法 A：读代码

```bash
pi @src/main.rs "解释这个文件做了什么"
```

### 用法 B：让它帮你找问题

```bash
pi "帮我找出这个仓库里最值得优先修复的 3 个风险点"
```

### 用法 C：继续上一次会话

```bash
pi --continue
```

## 7. 试用时推荐做的 5 个场景

1. 让它总结仓库结构
2. 让它定位某个函数或模块
3. 让它搜索 TODO / FIXME / 某个关键字
4. 让它解释报错或测试失败
5. 让它对一个小文件给出修改建议

## 8. 常见工作流

### 8.1 单次提问

```bash
pi -p "这个错误最可能是什么原因？"
```

### 8.2 从文件带上下文提问

```bash
pi @Cargo.toml "这个项目有哪些关键依赖？"
```

### 8.3 恢复旧会话

```bash
pi --resume
```

### 8.4 指定模型

```bash
pi --model claude-opus-4 "帮我审查这个模块的设计"
```

## 9. 你应该期待什么

猫爪 v0.1 重点保证这些体验：

- 能安装
- 能开始一次成功会话
- 能进行基本代码理解与工具调用
- 能保存并继续会话

你**不应该**期待这些在首版就完全成熟：

- 与 TS Pi 完全无差异兼容
- 所有 RPC/SDK 接入场景都稳定
- 所有扩展生态都可直接复用

## 10. 如果第一次没跑通

建议按这个顺序排查：

1. `pi --version` 是否可运行
2. API Key 是否已正确设置
3. 当前目录是否是你想分析的项目目录
4. provider 是否可用
5. 是否先从最简单的问题开始

如果仍然失败，请记录：

- 你使用的命令
- 报错信息
- 当前系统环境
- 使用的 provider

## 11. 试用建议

为了更快判断猫爪是否适合你，建议第一轮试用只关注下面三个问题：

1. 它能不能快速理解你的仓库？
2. 它能不能稳定完成常见提问和搜索？
3. 它能不能帮你减少一次小型分析或改动工作？

## 12. 下一步读什么

如果你想继续深入：

- 看 [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md) 了解首版支持范围
- 看 [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md) 了解首版边界
- 看 [integrator-migration-playbook.md](integrator-migration-playbook.md) 了解迁移与安装路径
- 看 [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md) 了解后续升级路线
- 看 [../STATUS.md](../STATUS.md) 了解当前公开口径
- 看 [../README.md](../README.md) 了解更完整的能力说明
