# Claudio 施工图

> 项目定位：个人 AI 电台 · Claudio · 读懂听歌习惯 → 规划声音 → 像 DJ 那样播报

---

## 架构分层

```
┌──────────────────────────────────────────────────────────────┐
│                     第四层 · 交互表层                          │
│  ┌──────────┐  ┌─────────────────────────────────────────┐  │
│  │   PWA    │  │           HTTP CONTRACT                  │  │
│  │ :8080    │  │  POST /api/chat     GET /api/plan/today │  │
│  │ Player   │  │  GET  /api/now      WS  /stream         │  │
│  │ Profile  │  │  GET  /api/next     GET /api/taste      │  │
│  │ Settings │  │                                          │  │
│  └──────────┘  └─────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                   第三层 · 运行时聚合                          │
│  ┌─────────────────────┐  ┌────────────────────────────┐    │
│  │   CONTEXT WINDOW    │  │     MODEL · 前向过程         │    │
│  │   6 片粘成 prompt    │  │  compute(fragments) →      │    │
│  │  system + taste     │  │  {say, play[], reason,     │    │
│  │  + env + memory     │  │   segue}                    │    │
│  │  + input + trace    │  │                             │    │
│  └─────────────────────┘  └────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│                   第二层 · 本地大脑                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ ROUTER   │ │ CONTEXT   │ │ CLAUDE   │ │ SCHEDULER│      │
│  │ 意图分流  │ │ 提示词组装 │ │ 大脑适配器│ │ 节律调度  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────────────────────────────┐        │
│  │   TTS    │ │           STATE.DB                │        │
│  │ 声音管线  │ │  messages, plays, plan, prefs     │        │
│  └──────────┘ └──────────────────────────────────┘        │
├──────────────────────────────────────────────────────────────┤
│                   第一层 · 外部上下文                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  USER    │ │  BRAIN   │ │  MUSIC   │ │  VOICE   │      │
│  │ 品味语料  │ │ Claude   │ │ Netease  │ │  I/O     │      │
│  │ taste.md │ │ Code     │ │ Cloud    │ │ Fish     │      │
│  │ routines │ │ 子进程    │ │ Music    │ │ Feishu   │      │
│  │ playlists│ │          │ │ API      │ │ Weather  │      │
│  │ mood     │ │          │ │          │ │ UPnP     │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└──────────────────────────────────────────────────────────────┘
```

---

## 第一层：外部上下文

### USER/ — 用户品味语料
让 Claudio 真正属于你的那几个文件：
- `user/taste.md` — 音乐口味偏好
- `user/routines.md` — 日常作息节奏
- `user/playlists.json` — 歌单配置
- `user/mood-rules.md` — 情绪-音乐映射规则

### BRAIN — Claude Code
核心处理单元，通过子进程调用：
- 使用 Max 订阅，无需 API key
- 命令示例：`claude -p --output json`
- 解析 Claude 返回的结构化输出

### MUSIC — NeteaseCloudMusicApi
音乐服务接口，提供：
- `search` — 歌曲检索
- `song_url` — 直链获取
- `lyric` — 歌词查询
- `recommend` — 推荐

### VOICE · I/O
语音输入输出及相关服务：
- **Fish Audio** — TTS 语音合成 (`fish tts`)
- **Feishu** — 飞书消息集成 (`lark`)
- **Weather** — 天气服务 (`weather`)
- **UPnP** — 客厅功放控制 (`Main`)

---

## 第二层：本地大脑

### ROUTER.JS — 意图分流
```
简单指令 → 直连处理
音乐请求 → ncm (NeteaseCloudMusicApi)
自然语言 → claude (子进程调用)
```

### CONTEXT.JS — 提示词组装
按优先级组装 system prompt：
```
品味语料 + 常规规则 + 环境信息 + 历史记忆
```

### CLAUDE.JS — 大脑适配器
- Spawn 子进程调用 Claude
- 解析结构化输出：`{say, play[], reason, segue}`

### SCHEDULER.JS — 节律调度
- 07:00 — 今日规划
- 09:00 — 早间播报
- 每小时 — 情绪检查
- 日历 hook — 事件触发

### TTS.JS — 声音管线
```
Fish Audio API → cache/tts/*.mp3 → /tts/:id.mp3
```

### STATE.DB — 状态记忆
持久化数据（跨重启保留）：
- `messages` — 对话历史
- `plays` — 播放记录
- `plan` — 当日计划
- `prefs` — 用户偏好

---

## 第三层：运行时聚合

### CONTEXT WINDOW — 组装盒子
每次触发按以下 6 片粘成 prompt：

| # | 组件 | 来源 |
|---|------|------|
| 1 | 系统提示词 | `prompts/dj-persona.md` |
| 2 | 用户语料 | `user/*.md` |
| 3 | 环境注入 | weather, calendar, now |
| 4 | 已检索记忆 | state.db, plays |
| 5 | 用户输入 / 工具结果 | /api/chat, ncm search |
| 6 | 执行轨迹 | scheduler, webhook |

### MODEL · 前向过程
```
compute(fragments) → {say, play[], reason, segue}
  → ncm 解析 queue
  → tts 合成 say
  → WS 推 now-playing
```

---

## 第四层：交互表层

### PWA — localhost:8080
渐进式 Web 应用，三视图结构：
- **Player** — 播放主界面
- **Profile** — 个人配置
- **Settings** — 系统设置

技术实现：
- 单页应用 + WebSocket 流式聊天
- Service Worker 缓存壳层
- prefetch 10s 预加载

### HTTP CONTRACT
PWA ↔ Server 的 6 条 API 线：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 对话交互 |
| GET | `/api/now` | 当前播放 |
| GET | `/api/next` | 下一首 |
| GET | `/api/taste` | 口味偏好 |
| GET | `/api/plan/today` | 今日计划 |
| WebSocket | `/stream` | 实时推送 |

---

## 数据流全景

```
User Input / Scheduler Trigger
        │
        ▼
   ROUTER.JS ─── 意图分流
        │
        ▼
   CONTEXT.JS ─── 组装 6 片 prompt
        │
        ▼
   CLAUDE.JS ──── Spawn claude 子进程
        │
        ▼
   解析 {say, play[], reason, segue}
        │
   ┌────┴────┐
   ▼         ▼
 ncm       TTS.JS
 解析      合成语音
 queue
   │         │
   └────┬────┘
        ▼
   WS /stream → PWA
```
