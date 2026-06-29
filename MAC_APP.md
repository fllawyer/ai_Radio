# Claudio macOS App 开发说明

本项目已经加入 Electron 外壳，可以把现有 PWA/Node 服务打包成 macOS 桌面 App。

## 运行开发版

```bash
cd "/Users/lifang/Downloads/个人 AI 电台"
git pull
npm install
npm run app:dev
```

启动后会打开一个 Claudio 桌面窗口。窗口内部仍然使用原来的 PWA 页面，但服务由 App 内部自动启动，不需要手动先执行 `npm start`。

## 打包成本机 App

只生成 `.app` 目录，适合本机测试：

```bash
npm run app:pack
```

生成位置：

```text
dist/mac/Claudio.app
```

## 打包 DMG 安装包

```bash
npm run app:build
```

生成位置一般为：

```text
dist/Claudio-0.1.0-arm64.dmg
```

Intel Mac 上会生成 `x64`，Apple Silicon 上会生成 `arm64`。

## 数据保存位置

macOS App 运行时会把运行数据保存到系统的应用数据目录，不再写到项目根目录：

```text
~/Library/Application Support/Claudio/state.json
~/Library/Application Support/Claudio/cache/
```

## 当前限制

1. 目前是未签名 App，本机测试可以运行；发给别人安装时可能会被 Gatekeeper 拦截。
2. 需要正式分发时，应配置 Apple Developer ID 签名和 notarization。
3. 现阶段 App 使用本地 HTTP 服务承载 PWA，后续可以再改成更原生的菜单栏 App、托盘 App 或开机自启动。 
