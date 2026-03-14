# 安装与部署

本页说明如何安装、升级、源码构建和打包 `猫爪 / maoclaw`。

## 1. 本地安装

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

安装后检查：

```bash
pi --version
pi --help
```

## 2. 固定版本部署

适合团队评估、CI 镜像和可重复安装：

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | \
  bash -s -- --version v0.1.8 --yes --easy-mode
```

## 3. 源码构建

```bash
git clone https://github.com/miounet11/maoclaw.git
cd maoclaw
cargo build --release

./target/release/pi --version
./target/release/maoclaw --version
```

## 4. macOS 桌面版

构建桌面二进制与 `.app`：

```bash
cargo build --release --bin pi_desktop --features desktop-iced
bash scripts/build_macos_app.sh --install
```

构建安装包：

```bash
bash scripts/build_macos_pkg.sh
```

常见输出：

- `~/Applications/maoclaw.app`
- `dist/maoclaw.app`
- `dist/maoclaw.pkg`

## 5. 升级建议

- 个人用户：直接用最新安装脚本升级
- 团队用户：固定版本后灰度验证
- 发行前：同步检查 [版本更新日志](changelog.md) 和根目录 [CHANGELOG.md](../../CHANGELOG.md)

## 6. 适合的部署形态

- 本地 CLI：最适合个人开发者
- 固定版本安装：最适合团队试运行
- 源码构建：最适合贡献者和定制分发
- macOS 桌面包：最适合产品演示和图形化使用
