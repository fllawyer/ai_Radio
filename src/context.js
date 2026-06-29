/**
 * CONTEXT.JS — 提示词组装
 * 品味 + 常规 + 环境 + 历史 → system prompt
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getState } from './state.js';
import { getWeather } from './weather.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function fromRoot(path) {
  return join(PROJECT_ROOT, path);
}

async function safeRead(path, fallback = '') {
  const fullPath = fromRoot(path);
  try {
    return await readFile(fullPath, 'utf-8');
  } catch (e) {
    console.warn(`[Context] 读取 ${path} 失败，使用默认内容:`, e.message);
    return fallback;
  }
}

function formatRecentMessages(messages = []) {
  const recent = messages.slice(-6).map((m) => {
    const role = m.role === 'user' ? '用户' : 'Claudio';
    return `${role}: ${m.content || ''}`;
  }).filter(Boolean);
  return recent.length ? recent.join('\n') : '暂无';
}

function formatRecentPlays(plays = []) {
  const recent = plays.slice(-8).map((song) => {
    if (typeof song === 'string') return song;
    return [song.title, song.artist].filter(Boolean).join(' - ');
  }).filter(Boolean);
  return recent.length ? recent.join(', ') : '暂无';
}

export async function buildContext(userInput) {
  const [persona, taste, routines, moodRules] = await Promise.all([
    safeRead('prompts/dj-persona.md', '你是 Claudio，一个个人 AI 电台 DJ。'),
    safeRead('user/taste.md', '用户暂未配置音乐口味。'),
    safeRead('user/routines.md', '用户暂未配置作息。'),
    safeRead('user/mood-rules.md', '根据用户输入和当前时间选择合适音乐。'),
  ]);

  const state = getState();
  const env = await getEnvContext();

  return [
    `## 系统身份\n${persona}`,
    `## 用户品味\n${taste}\n\n### 情绪规则\n${moodRules}`,
    `## 环境信息\n${env}`,
    `## 历史记忆\n最近播放: ${formatRecentPlays(state.plays)}\n最近对话:\n${formatRecentMessages(state.messages)}`,
    `## 用户输入\n${userInput}`,
    `## 作息参考\n${routines}`,
  ].join('\n\n---\n\n');
}

async function getEnvContext() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.toLocaleDateString('zh-CN', { weekday: 'long' });
  const weather = await getWeather().catch(() => '未知');
  return `时间: ${day} ${hour}时\n天气: ${weather}`;
}
