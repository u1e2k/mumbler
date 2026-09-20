# mumbler

一人用Twitterのように素早くメモを書き込み、今日のデイリーノートに自動追記するプラグイン

## 特徴

- **クイック入力**: サイドバーからワンクリックで素早くメモを入力
- **自動追記**: メモは自動的にその日のデイリーノートに追記される
- **シンプル**: 複雑な操作は不要、すぐに使えるデザイン

## インストール

1. 本プラグインのリポジトリをクローン
2. `npm install` で依存パッケージをインストール
3. `npm run build` でビルド
4. 生成された `main.js` と `manifest.json` をObsidianのプラグインフォルダに配置

## 開発

### ローカルVaultへの直接出力設定（任意）

`env.example.json` をコピーして `env.json` を作成し、ローカルのVaultパスを指定すると、ビルド時に自動でプラグインフォルダへ成果物が反映されます。

```json
{
  "vaultPath": "C:/path/to/your/Obsidian Vault"
}
```
※ `env.json` は `.gitignore` に含まれているため、GitHub等にコミットされることはありません。

### コマンド

```bash
# 依存関係のインストール
npm install

# 開発モードで起動 (変更監視 & 自動ビルド・自動コピー)
npm run dev

# 本番ビルド
npm run build
```