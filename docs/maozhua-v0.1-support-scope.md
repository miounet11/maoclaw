# 猫爪 v0.1 支持范围

Status: Draft  
Audience: Product, engineering, design, operations, trial customers  
Brand strategy: 对外品牌为“猫爪”，首版保留 `pi` 命令兼容  
Companions: [maozhua-v0.1-trial-release-plan.md](maozhua-v0.1-trial-release-plan.md), [../README.md](../README.md), [../FEATURE_PARITY.md](../FEATURE_PARITY.md), [releasing.md](releasing.md), [dropin-certification-verdict.json](dropin-certification-verdict.json)

## 1. 文档目的

本文档定义猫爪 v0.1 小范围试用版的**明确支持范围**。

它回答三个问题：

1. 这个版本我们支持什么
2. 这个版本我们优先保证什么
3. 这个版本哪些内容不在承诺范围内

本文件是对外与对内统一口径的依据。

## 2. 版本定位

猫爪 v0.1 是一个**小范围试用版**，不是严格替代现有 Pi / OpenClaw 的正式发布版。

本版本的目标是：

- 让试用用户顺利安装与启动
- 让试用用户完成核心 AI coding workflow
- 让团队收集高质量真实反馈
- 为 v0.2 Beta 和更深兼容层做准备

## 3. 品牌与命名范围

### 3.1 对外品牌

对外产品品牌统一使用：**猫爪**。

### 3.2 技术标识

首版继续保留以下技术标识：

- 主仓库：`maoclaw`
- crate / package：`maoclaw`
- library crate：`pi`
- binary：`pi` / `maoclaw`
- 兼容命令：`pi`

### 3.3 用户沟通方式

对外推荐统一表述：

> 猫爪 / maoclaw 是独立发布的终端优先 AI coding agent 产品，并保留 `pi` 兼容命令用于迁移。

## 4. 平台支持范围

### 4.1 首版主平台

首版主平台为：

- macOS（优先支持）

### 4.2 次级验证平台

可做基本验证，但不作为首版承诺重点的平台：

- Linux
- Windows

### 4.3 平台优先级原则

如果不同平台的体验和稳定性存在差异，首版以 **macOS 用户路径稳定** 为第一优先级。

## 5. 运行模式支持范围

猫爪 v0.1 支持以下运行模式：

### 5.1 Interactive 模式

支持内容：

- 默认启动进入交互式 TUI
- 实时流式响应
- 工具调用
- 会话继续和恢复
- 基本 slash command 工作流
- 文件与命令补全

这是首版最重要、最需要重点保证的模式。

### 5.2 Print 模式

支持内容：

- 单次消息输出到 stdout
- 适合脚本化和快速查询
- 可与模型/提示/上下文参数组合使用

### 5.3 RPC 模式

支持内容：

- 基础 stdin/stdout JSON 协议
- 适合简单 IDE / 自动化接入试用

注意：

- 首版支持基础 RPC 使用
- 不承诺与上游 TS 实现的全量命令语义和事件顺序完全一致

## 6. Provider 支持范围

### 6.1 首版重点支持的 Provider

首版重点支持以下 Provider：

- Anthropic
- OpenAI
- Google Gemini
- Azure OpenAI

### 6.2 首版保证范围

对以上 Provider，首版重点保证：

- 基础鉴权配置可完成
- 基本对话可用
- 流式响应可用
- 工具调用主路径可用
- 常见错误具备基本可理解提示

### 6.3 首版不在重点保证范围的 Provider

以下内容不纳入 v0.1 首版承诺：

- Amazon Bedrock
- Google Vertex
- GitHub Copilot provider
- XAI
- Groq
- Cerebras
- OpenRouter
- Mistral
- 自定义 provider 的严格兼容交付

## 7. 工具支持范围

猫爪 v0.1 支持以下 7 个内置工具：

- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

### 7.1 首版保证内容

- 工具定义可被模型使用
- 工具主路径执行稳定
- 结果具备基本截断与元数据
- 常见文件与目录操作场景可用
- `bash` 工具具备基本超时与清理能力

### 7.2 首版重点演示用例

建议至少覆盖以下演示用例：

1. 读源码并解释
2. 搜索 TODO 或关键符号
3. 修改一个文件中的小问题
4. 运行一个测试命令
5. 列出目录并定位目标文件

## 8. 会话与历史支持范围

### 8.1 首版支持

- JSONL 会话保存
- `--continue` 继续上一次会话
- `--resume` 打开会话选择
- 基本分支能力
- 会话压缩主路径

### 8.2 首版承诺边界

首版只承诺当前可用的会话主路径体验。

不对以下内容做成熟交付承诺：

- 会话系统的严格上游语义完全一致
- V2 存储层默认启用
- 所有迁移命令都达到正式可依赖级别

## 9. 交互体验支持范围

### 9.1 首版支持

- 多行输入
- 基础快捷键交互
- `@` 文件引用补全
- `/` 命令补全
- 基础主题能力
- 技能与 Prompt Template 的调用

### 9.2 首版优先保证的交互路径

- 启动应用
- 输入问题
- 调用工具
- 查看流式输出
- 继续上一轮会话
- 恢复旧会话

### 9.3 首版不承诺

- 所有 slash command 与上游完全一致
- 所有交互热键在所有平台一致
- 所有终端环境下表现完全一致

## 10. 扩展与自定义支持范围

### 10.1 首版支持

- skills
- prompt templates
- themes
- 基础 JS 扩展运行时
- 基础 capability-gated extension model

### 10.2 首版承诺边界

首版只承诺“基础扩展运行时可用”，不承诺：

- 全量扩展 CLI flag 透传语义完全成熟
- 全量生命周期 hook parity
- OpenClaw 插件生态兼容
- 复杂第三方扩展的正式商用稳定性

## 11. 安装与分发支持范围

### 11.1 首版支持的安装方式

- GitHub Release 二进制下载
- `install.sh` 安装脚本
- `cargo build --release` 源码构建

### 11.2 首版重点保证

- macOS 安装脚本主路径
- 版本校验与基本完整性验证
- 已有 `pi` 用户的迁移或并存路径说明

### 11.3 首版不承诺

- 所有企业离线环境完全覆盖
- 所有 shell / PATH 情况下零摩擦安装
- 所有历史安装状态自动修复

## 12. 文档支持范围

猫爪 v0.1 对外至少提供以下文档：

- 产品介绍
- Quick Start
- macOS 安装说明
- 支持矩阵
- 已知限制
- FAQ
- Release Notes
- 反馈通道说明

## 13. 质量门禁范围

进入试用发布前，以下项目属于首版硬门禁：

- `cargo check --all-targets`
- `cargo fmt --check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test --all-targets` 达到发布要求
- 安装器 smoke test 通过
- 关键用户链路 smoke test 通过

## 14. 明确不在本版本承诺中的事项

以下事项明确不在猫爪 v0.1 承诺中：

- 严格替代 TS Pi / OpenClaw
- 完整 SDK drop-in parity
- 全量 JSON/RPC parity
- 全量扩展生态兼容
- OpenClaw V2 全产品层交付
- 桌面 GUI shell
- 云同步与多端协同
- Browser Operator 全量成熟交付

## 15. 试用发布判定

只有以下问题的答案都为“是”，才可以对外试用：

1. 试用用户能安装吗？
2. 试用用户能在 10 分钟内开始第一次可用对话吗？
3. 工具调用主路径稳定吗？
4. 文档和产品口径一致吗？
5. 我们知道这个版本不支持什么吗？

如果其中任一答案为“否”，则不应进入试用发布。

## 16. 一句话总结

猫爪 v0.1 支持范围的核心原则是：

> **只承诺已经能稳定交付给试用用户的能力；其余能力一律归入已知限制或后续版本规划。**
