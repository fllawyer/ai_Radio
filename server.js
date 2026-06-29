/**
 * SERVER.JS — Claudio 主入口
 * HTTP + SSE 服务，零外部依赖
 */
import { createServer } from 'node:http';
import { buildContext } from './src/context.js';
import { askClaude, setApiKey, getApiKey } from './src/claude.js';
import { startScheduler } from './src/scheduler.js';
import { loadState, getState, updateState, addMessage, addPlay } from './src/state.js';
import { serveStatic } from './src/static.js';
import { checkTts, isTtsReady } from './src/tts.js';

const PORT = Number(process.env.PORT || 3000);

// SSE 广播通道
const sseClients = new Set();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of [...sseClients]) {
    try {
      if (res.destroyed || res.writableEnded) {
        sseClients.delete(res);
        continue;
      }
      res.write(msg);
    } catch {
      sseClients.delete(res);
    }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('JSON 格式错误');
  }
}

function normalizeBrainResult(result) {
  return {
    say: String(result?.say || '我在。你可以直接告诉我想听什么，或者让我按现在的时间推荐一首。'),
    play: Array.isArray(result?.play) ? result.play : [],
    reason: String(result?.reason || ''),
    segue: String(result?.segue || ''),
  };
}

async function handleChat(req, res) {
  const data = await readJson(req);
  const message = String(data.message || '').trim();

  if (!message) {
    return sendJson(res, 400, { ok: false, error: 'message 不能为空' });
  }

  broadcast({ type: 'thinking' });

  try {
    const prompt = await buildContext(message);
    const result = normalizeBrainResult(await askClaude(prompt));

    addMessage({ role: 'user', content: message });
    addMessage({ role: 'assistant', content: result.say });
    for (const song of result.play) addPlay(song);

    broadcast({ type: 'reply', ...result });
    return sendJson(res, 200, { ok: true, result });
  } catch (e) {
    console.error('[Chat] 失败:', e);
    broadcast({ type: 'error', message: e.message });
    return sendJson(res, 500, { ok: false, error: e.message });
  }
}

async function handleSettings(req, res) {
  const data = await readJson(req);
  const key = String(data.deepseekKey || '').trim();

  if (!key) {
    return sendJson(res, 400, { ok: false, error: 'deepseekKey 不能为空' });
  }

  setApiKey(key);
  updateState({ prefs: { ...getState().prefs, deepseekKey: key } });
  console.log('[Settings] DeepSeek API Key 已更新');
  return sendJson(res, 200, { ok: true });
}

// ---- HTTP ----
const server = createServer(async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // SSE Stream
    if (url.pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // POST /api/chat
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      return handleChat(req, res);
    }

    // GET /api/status / /healthz
    if (url.pathname === '/api/status' || url.pathname === '/healthz') {
      return sendJson(res, 200, {
        ok: true,
        tts: isTtsReady(),
        brain: getApiKey() ? 'deepseek' : 'mock',
        uptime: process.uptime(),
        env: process.env.NODE_ENV || 'development',
      });
    }

    // GET /api/now
    if (url.pathname === '/api/now') {
      return sendJson(res, 200, getState().plays.at(-1) || null);
    }

    // GET /api/next
    if (url.pathname === '/api/next') {
      return sendJson(res, 200, { upcoming: [] });
    }

    // GET /api/taste
    if (url.pathname === '/api/taste') {
      return sendJson(res, 200, getState().prefs || {});
    }

    // GET /api/plan/today
    if (url.pathname === '/api/plan/today') {
      return sendJson(res, 200, getState().plan || { plan: '暂无今日计划' });
    }

    // GET /api/settings — 返回设置（key 脱敏）
    if (url.pathname === '/api/settings') {
      const key = getApiKey();
      return sendJson(res, 200, {
        deepseekKey: key ? key.slice(0, 8) + '...' + key.slice(-4) : '',
        hasKey: !!key,
        ttsReady: isTtsReady(),
      });
    }

    // POST /api/settings — 保存设置
    if (req.method === 'POST' && url.pathname === '/api/settings') {
      return handleSettings(req, res);
    }

    return serveStatic(req, res);
  } catch (e) {
    console.error('[HTTP] 未处理错误:', e);
    if (!res.headersSent) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
    res.end();
  }
});

// ---- 启动 ----
await loadState();

// 从环境变量或持久化状态恢复 API Key
if (process.env.DEEPSEEK_API_KEY) {
  setApiKey(process.env.DEEPSEEK_API_KEY);
  console.log('[启动] 已读取 DEEPSEEK_API_KEY');
} else if (getState().prefs?.deepseekKey) {
  setApiKey(getState().prefs.deepseekKey);
  console.log('[启动] 已恢复 DeepSeek API Key');
}

await checkTts();
startScheduler(broadcast);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Claudio 已上线 → http://localhost:${PORT}`);
});