# Claudio 云端部署说明

## 推荐方案

推荐先部署为“轻量云端版”：

- Node.js HTTP 服务常驻云服务器
- DeepSeek API 负责 AI 回复
- PWA 页面通过浏览器访问
- TTS 本地大模型暂不放云上，未安装时自动降级为文本模式
- Docker 版把 `data/state.json` 和 `cache/` 挂载为持久化数据

这样 Mac 不需要一直开着。

---

## 方案 A：Docker Compose 部署，推荐

### 1. 服务器准备

服务器建议：

- Ubuntu 22.04 / 24.04
- 1 核 1G 起步即可跑文本版
- 如果要跑本地 TTS，大模型和推理成本会明显增加，不建议先做

安装 Docker：

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker
```

### 2. 上传项目

可以用 Git，也可以用 `scp/rsync` 上传整个项目目录。

示例：

```bash
cd /opt
sudo mkdir -p claudio
sudo chown -R $USER:$USER /opt/claudio
```

把项目文件放到：

```bash
/opt/claudio
```

### 3. 配置环境变量

```bash
cd /opt/claudio
cp .env.example .env
nano .env
```

填入：

```bash
PORT=3000
NODE_ENV=production
DEEPSEEK_API_KEY=sk-xxxx
# Docker Compose 会自动覆盖成 /app/data/state.json
STATE_FILE=state.json
```

### 4. 启动

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f claudio
```

检查状态：

```bash
curl http://127.0.0.1:3000/healthz
```

浏览器访问：

```text
http://服务器IP:3000
```

---

## 方案 B：PM2 部署

适合你已经在服务器上直接装 Node.js 的情况。

### 1. 安装 Node.js 和 PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### 2. 配置环境变量

```bash
cd /opt/claudio
cp .env.example .env
nano .env
```

PM2 不会自动读取 `.env`，可以这样启动：

```bash
set -a
source .env
set +a
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

查看日志：

```bash
pm2 logs claudio
```

重启：

```bash
pm2 restart claudio
```

---

## 绑定域名和 HTTPS

如果你有域名，例如：

```text
radio.fllawyer.net
```

可以用 Cloudflare Tunnel 或 Nginx 反代。

### Nginx 反代示例

```nginx
server {
    listen 80;
    server_name radio.fllawyer.net;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后用 certbot 申请 HTTPS。

---

## 以后怎么让我直接改云端

有两种方式：

### 方式 1：Git 仓库同步，推荐

流程：

1. 本地项目提交到 GitHub 私有仓库
2. 云服务器 `git clone` 这个仓库
3. 我在本地项目里改代码
4. 你推送到 GitHub
5. 云服务器执行：

```bash
cd /opt/claudio
git pull
docker compose up -d --build
```

优点：安全、可回滚、不会把服务器改乱。

### 方式 2：把云服务器目录接入 Devspace

如果你把云服务器上的项目目录作为 Devspace 工作区开放，我就可以直接编辑云上的文件。

推荐云端路径：

```bash
/opt/claudio
```

但注意：

- 不要把服务器 root 权限随意暴露
- `.env` 不要提交 Git
- Docker 版运行数据在 `data/state.json`，不要频繁覆盖
- 修改后需要重启容器或 PM2

---

## 当前项目的云端限制

### 1. 本地 TTS 不建议第一阶段上云

当前 TTS 是 `mlx-speech`，更偏 Apple Silicon 本地运行。普通 Linux 云服务器不一定适配，且模型较大。

云端第一阶段建议：

```text
AI 文字 DJ + PWA 页面
```

后续要语音，可以再接：

```text
外部 TTS API
或单独的本地 Mac/边缘设备做语音合成
```

### 2. 网易云音乐 API 需要单独部署

如果要真正搜歌/播歌，需要另起 NeteaseCloudMusicApi 服务，并配置：

```bash
NCM_API_BASE=http://127.0.0.1:3001
```

### 3. API Key 不要写入 Git

`.env` 已加入 `.gitignore`，云端应通过 `.env` 或服务器环境变量保存密钥。
