import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';

const PORT = Number(process.env.SMOKE_PORT || 3130);
const stateFile = `.tmp/smoke-state-${Date.now()}.json`;
const baseUrl = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    STATE_FILE: stateFile,
    DEEPSEEK_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

function stop() {
  if (!child.killed) child.kill('SIGTERM');
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return await res.json();
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`服务未能在 15 秒内启动: ${lastError?.message || 'unknown'}\n${logs}`);
}

try {
  const health = await waitForServer();
  if (!health.ok) throw new Error('/healthz 返回异常');

  const home = await fetch(baseUrl);
  const html = await home.text();
  if (!home.ok || !html.includes('Claudio')) {
    throw new Error('首页不可访问或内容异常');
  }

  const chat = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '测试一下能不能运行' }),
  });
  const chatJson = await chat.json();
  if (!chat.ok || !chatJson.ok) {
    throw new Error(`/api/chat 异常: ${JSON.stringify(chatJson)}`);
  }

  console.log('Smoke test passed:', {
    health,
    home: home.status,
    chat: chat.status,
  });
} finally {
  stop();
  await rm('.tmp', { recursive: true, force: true }).catch(() => {});
}
