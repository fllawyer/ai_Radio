/**
 * SERVER.JS — Claudio 主入口
 * HTTP + SSE 服务，零外部依赖
 */
import { createServer } from 'node:http';
import { buildContext } from './src/context.js';
import { askClaude } from './src/claude.js';
import { startScheduler } from './src/scheduler.js';
import { loadState, getState, updateState, addMessage } from './src/state.js';
import { serveStatic } from './src/static.js';
import { synthesize, checkTts, isTtsReady } from './src/tts.js';
import { setApiKey, getApiKey } from './src/claude.js';

const PORT = process.env.PORT || 3000;

// SSE 广播通道
const sseClients = new Set();

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

// ---- HTTP ----
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE Stream
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // POST /api/chat
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    const body = await readBody(req);
    const { message } = JSON.parse(body);
    broadcast({ type: 'thinking' });

    try {
      const prompt = await buildContext(message);
      const result = await askClaude(prompt);
      addMessage({ role: 'user', content: message });
      addMessage({ role: 'assistant', content: result.say });

      // 立即广播文字回复
      broadcast({ type: 'reply', ...result });

      // 后台异步合成 TTS
      synthesize(result.say).then((audioUrl) => {
        if (audioUrl) {
          broadcast({ type: 'audio', url: audioUrl });
        }
      });
    } catch (e) {
      broadcast({ type: 'error', message: e.message });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  // GET /api/status / /healthz
  if (url.pathname === '/api/status' || url.pathname === '/healthz') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      ok: true,
      tts: isTtsReady(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || 'development',
    }));
  }

  // GET /api/now
  if (url.pathname === '/api/now') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(getState().plays.at(-1) || null));
  }

  // GET /api/next
  if (url.pathname === '/api/next') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ upcoming: [] }));
  }

  // GET /api/taste
  if (url.pathname === '/api/taste') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(getState().prefs));
  }

  // GET /api/plan/today
  if (url.pathname === '/api/plan/today') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(getState().plan || { plan: '暂无今日计划' }));
  }

  // GET /api/settings — 返回设置（key 脱敏）
  if (url.pathname === '/api/settings') {
    const key = getApiKey();
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      deepseekKey: key ? key.slice(0, 8) + '...' + key.slice(-4) : '',
      hasKey: !!key,
      ttsReady: isTtsReady(),
    }));
  }

  // POST /api/settings — 保存设置
  if (req.method === 'POST' && url.pathname === '/api/settings') {
    const body = await readBody(req);
    const data = JSON.parse(body);
    if (data.deepseekKey) {
      setApiKey(data.deepseekKey);
      updateState({ prefs: { ...getState().prefs, deepseekKey: data.deepseekKey } });
      console.log('[Settings] DeepSeek API Key 已更新');
    }
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  return serveStatic(req, res);
});

// ---- 启动 ----
await loadState();
// 从持久化状态恢复 API Key
if (getState().prefs?.deepseekKey) {
  setApiKey(getState().prefs.deepseekKey);
  console.log('[启动] 已恢复 DeepSeek API Key');
}
await checkTts();
startScheduler(broadcast);

server.listen(PORT, () => {
  console.log(` Claudio 已上线 → http://localhost:${PORT}`);
});
