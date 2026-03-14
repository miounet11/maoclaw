# 使用与配置

本页覆盖 `猫爪 / maoclaw` 的常用命令、资源目录和设置方式。

## 1. 常用命令

交互式启动：

```bash
pi
```

单次提问：

```bash
pi -p "解释这个错误最可能的原因"
```

带文件上下文提问：

```bash
pi @Cargo.toml "这个项目有哪些关键依赖？"
```

继续会话：

```bash
pi --continue
pi --resume
```

指定模型：

```bash
pi --model claude-opus-4 "帮我审查这个模块设计"
```

查看 Provider 与模型：

```bash
pi --list-providers
pi --list-models
```

## 2. 自动化模式

```bash
pi -p "输出一段简短总结"
pi --mode json -p "返回结构化摘要"
pi --mode rpc
```

## 3. 设置文件路径

全局设置：

- `~/.pi/agent/settings.json`

项目级设置：

- `.pi/settings.json`

查看实际加载路径：

```bash
pi config
```

优先级从高到低：

1. CLI 参数
2. 环境变量
3. 项目设置
4. 全局设置
5. 内置默认值

## 4. Skills / Prompts / Themes

全局目录：

- `~/.pi/agent/skills/`

项目目录：

- `.pi/skills/`

相关文档：

- [../../skills.md](../../skills.md)
- [../../prompt-templates.md](../../prompt-templates.md)
- [../../themes.md](../../themes.md)

## 5. 建议的设置思路

- 个人开发者：只配一个默认 Provider 和默认模型
- 团队仓库：在 `.pi/settings.json` 写项目级默认值
- 深度使用者：再逐步引入 skills、prompts、themes

## 6. 当前兼容命名说明

- 产品名：`猫爪 / maoclaw`
- 兼容命令：`pi`

这不是安装错误，而是当前迁移阶段的兼容策略。
