# 猫爪 v0.1 Release Notes（Draft）

Status: Draft  
Audience: Trial users, partners, internal stakeholders  
Release type: 小范围试用版 / Trial Beta  
Companions: [maozhua-v0.1-quick-start.md](maozhua-v0.1-quick-start.md), [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md), [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md), [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md), [../STATUS.md](../STATUS.md), [../CHANGELOG.md](../CHANGELOG.md)

## 概览

猫爪 v0.1 是首个面向小范围试用用户的产品版本。

这个版本的目标不是宣布“已经完全替代现有 Pi / OpenClaw 体系”，而是把当前 Rust 运行时和终端产品能力，整理成一个可以安装、可以试用、可以反馈的首版产品。

它采用的是 migration-first 路线：

- 先让现有 Pi 用户有可信的迁移主路径
- 先让高频 CLI 工作流完成上线验证
- 先把不能承诺的边界说清楚

本版本重点提供：

- 交互式终端 AI coding workflow
- 基础 print 模式与 RPC 模式
- 四类主 provider 支持
- 7 个内置工具
- 会话保存、继续与恢复
- 基础扩展与自定义能力
- 面向 macOS 的优先试用体验

## 适合谁

猫爪 v0.1 适合：

- 想试用 AI coding agent 的开发者
- 想评估终端工作流产品的技术客户
- 愿意给出高质量反馈的设计伙伴

## 当前重点能力

### 1. 终端优先体验

猫爪提供交互式终端主体验，适合在代码仓库中直接开展分析、搜索、问答和轻量修改工作。

### 2. 7 个内置工具

当前内置工具包括：

- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

### 3. 会话能力

支持：

- 保存会话
- `--continue` 继续上一次会话
- `--resume` 恢复旧会话
- 基础分支与压缩主路径

### 4. 自定义能力

支持：

- skills
- prompt templates
- themes
- 基础扩展运行时

## 已知边界

猫爪 v0.1 当前**不宣称**：

- strict drop-in replacement
- 完整 SDK drop-in parity
- 完整 JSON/RPC parity
- 完整第三方扩展生态兼容
- OpenClaw V2 全产品层默认成熟交付

## 建议试用方式

建议第一轮试用优先围绕以下场景：

1. 仓库结构总结
2. 代码搜索与定位
3. 错误解释
4. 轻量代码修改建议
5. 会话保存与恢复

## 平台与安装

首版优先支持 macOS 试用。

推荐安装方式：

- `miounet11/maoclaw` GitHub Release
- GitHub Release 二进制
- `install.sh`
- 源码构建（适合技术用户）

## 反馈重点

我们最希望收到以下反馈：

- 安装是否顺畅
- 首次配置是否顺畅
- 对话是否稳定
- 工具调用是否稳定
- 哪些高频场景最有价值
- 哪些问题最影响继续试用

## 对外推荐说明

推荐对外使用如下口径：

> 猫爪 v0.1 是一个小范围试用版，适合早期开发者和设计伙伴客户试用。它重点提供终端优先的 AI coding workflow，并保留当前 `pi` 命令兼容路径。它支持已验证的迁移路径，但尚未通过 strict drop-in certification。

## 下一步

猫爪 v0.1 的目标是收集真实试用反馈，并据此推进后续版本在以下方向上的完善：

- `v0.2`：扩大 migration-safe 覆盖面
- `v0.3`：增强 integration / RPC / SDK 可信度
- `v0.4`：进入 strict replacement certification track

详细路线见 [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md)。
