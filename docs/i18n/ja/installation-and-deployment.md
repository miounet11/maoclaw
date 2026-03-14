# インストールとデプロイ

このページでは、`猫爪 / maoclaw` のインストール、アップグレード、ソースビルド、パッケージング方法を整理します。

## 1. ローカルインストール

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

インストール後:

```bash
pi --version
pi --help
```

## 2. バージョン固定の展開

チーム評価、CI イメージ、再現可能な配布に向いています。

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | \
  bash -s -- --version v0.1.8 --yes --easy-mode
```

## 3. ソースからビルド

```bash
git clone https://github.com/miounet11/maoclaw.git
cd maoclaw
cargo build --release

./target/release/pi --version
./target/release/maoclaw --version
```

## 4. macOS デスクトップパッケージ

デスクトップバイナリと `.app` を作成:

```bash
cargo build --release --bin pi_desktop --features desktop-iced
bash scripts/build_macos_app.sh --install
```

インストーラーパッケージを作成:

```bash
bash scripts/build_macos_pkg.sh
```

主な出力:

- `~/Applications/maoclaw.app`
- `dist/maoclaw.app`
- `dist/maoclaw.pkg`

## 5. アップグレード方針

- 個人利用: 最新インストーラーで更新
- チーム利用: バージョン固定で段階的に検証
- リリース前: [更新ログ](changelog.md) とルートの [CHANGELOG.md](../../CHANGELOG.md) を確認

## 6. 想定デプロイ形態

- ローカル CLI 導入
- バージョン固定のチーム展開
- コントリビュータ向けソースビルド
- デモや GUI 配布向けの macOS デスクトップパッケージ
