# 猫爪 v0.1 FAQ

Status: Draft  
Audience: Trial users, partners, internal team  
Companions: [maozhua-v0.1-quick-start.md](maozhua-v0.1-quick-start.md), [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md), [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md), [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md), [../STATUS.md](../STATUS.md)

## 1. 猫爪是什么？

猫爪是一个终端优先的 AI coding agent 产品。

当前品牌命名规则是：

- 中文名称：`猫爪`
- 英文 / 全球名称：`maoclaw`
- 日文对外表述：`猫爪 / maoclaw`

当前对外沟通语言目标是：

- 中文
- 英文
- 日文

你可以把它理解为：

- 一个能在本地代码仓库里工作的问题分析助手
- 一个能调用文件、搜索、shell 等工具的终端型 AI 工作流产品
- 一个强调速度、低资源占用和可扩展性的试用版产品

## 2. 为什么命令还是 `pi`？

猫爪是当前对外产品品牌，但首版保留 `pi` 命令以保持兼容和降低迁移成本。

这是有意设计，不是安装错误。

## 3. 猫爪是不是 `pi_agent_rust`？

可以理解为：

- `maoclaw` 是当前主仓库和发布包名
- `pi` 仍然是兼容命令与库名的一部分
- `pi_agent_rust` 只保留为历史上游/迁移语境中的旧名称

当前已经完成主仓库与发布包名切换，但不会在首版一次性移除所有兼容命名。

## 4. 它已经是正式版了吗？

不是。

猫爪 v0.1 是**小范围试用版**。

它适合：

- 早期开发者试用
- 设计伙伴客户试用
- 小范围真实工作流验证

它暂时不适合被描述为“正式商用稳定版”。

## 5. 它是不是可以完全替代原来的 Pi / OpenClaw？

不能这样承诺。

当前版本可以兼容 Pi 工作流主路径，但不能宣称是 strict drop-in replacement。

更准确的说法是：

- v0.1 是 migration-first public trial
- 它支持已验证的迁移路径
- 它还没有拿到 strict replacement certification

## 6. 首版最适合哪些人？

最适合：

- 经常在终端里工作的人
- 希望快速理解代码仓库的人
- 愿意尝试新工具并反馈问题的人
- 需要 AI 辅助搜索、解释、修改代码的人

## 7. 首版最推荐哪些使用方式？

优先推荐：

- 交互式使用
- 单次 print 模式
- 代码理解、搜索、解释、轻量修改
- 会话继续和恢复

## 8. 目前最推荐哪些 provider？

首版优先推荐：

- Anthropic
- OpenAI
- Gemini
- Azure OpenAI

## 9. 它支持哪些工具？

当前支持 7 个内置工具：

- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

## 10. 它支持 IDE / 自动化接入吗？

支持基础 RPC 模式，但首版不承诺完整 JSON/RPC 兼容。

如果你要做深度 IDE 接入或自动化编排，建议把它视为试验性能力，而不是正式稳定接口。

## 11. 它支持 SDK 嵌入吗？

当前不建议把 SDK 嵌入作为首版主卖点。

如果你的场景强依赖 SDK contract parity，建议先列为评估项目，而不是直接上线。

## 12. 它支持扩展吗？

支持基础扩展运行时、skills、prompt templates 和 themes。

但首版不承诺：

- 所有第三方扩展都可直接复用
- 所有扩展 hook 行为都完全一致
- OpenClaw 插件生态兼容

## 13. 它支持 macOS 以外的平台吗？

项目本身具备跨平台基础，但首版优先支持 macOS。

Linux / Windows 可验证，但不是首版对外重点承诺平台。

## 14. 为什么有些文档里还会看到 Pi / OpenClaw？

因为当前产品既有品牌独立化目标，也有兼容迁移目标。

- 猫爪 / maoclaw：当前仓库、发布与产品名
- Pi：现有命令与兼容层
- OpenClaw：部分产品路线、代理协作形态与历史上下文

首版会优先统一用户可见文档，但内部技术和历史名称不会一次性全部清除。

## 15. 我第一次试用应该做什么？

建议按这个顺序：

1. 安装
2. 配置一个 provider
3. 在本地仓库里启动 `pi`
4. 先让它总结仓库结构
5. 再让它做搜索、解释和轻量修改

## 16. 如果安装时发现机器上已经有旧版 `pi` 怎么办？

这是正常情况。

安装器会尝试提供迁移、保留旧版或并存的路径。首版文档会明确说明推荐做法。

建议把它理解成三种选择：

- fresh install：你本机没有旧版 `pi`
- adopt existing `pi`：把主命令切换到 Rust 版本
- keep existing `pi`：保留旧版，先做并存评估

如果你是团队评估者，先走 keep-existing 路径通常更稳。

## 17. 首版最容易出问题的地方是什么？

通常是：

- provider 配置
- 旧版 `pi` 迁移
- 个别终端环境差异
- 深度 RPC / SDK / 扩展接入

## 18. 出现问题时应该提供什么信息？

建议反馈以下内容：

- 你执行的命令
- 当前系统和终端环境
- 使用的 provider
- 错误输出或截图
- 是否可以稳定复现

## 19. 这个版本最重要的价值是什么？

对试用用户来说，首版最重要的价值不是“完美兼容”，而是：

- 快速启动
- 快速理解代码
- 稳定完成常见 AI coding 工作流
- 让团队验证产品方向是否正确

## 20. 下一版会重点补什么？

按当前计划，路线会分为四段：

- `v0.1`：migration-first public trial
- `v0.2`：migration confidence beta
- `v0.3`：integration beta
- `v0.4`：certification track

详细路线见 [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md)。
