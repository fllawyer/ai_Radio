/**
 * CONTEXT.JS — 提示词组装
 * 品味 + 常规 + 环境 + 历史 → system prompt
 */
import { readFile } from 'node:fs/promises';
import { getState } from './state.js';
import { getWeather } from './weather.js';

export async function buildContext(userInput) {
  const [persona, taste, routines, moodRules] = await Promise.all([
    readFile('prompts/dj-persona.md', 'utf-8'),
    readFile('user/taste.md', 'utf-8'),
    readFile('user/routines.md', 'utf-8'),
    readFile('user/mood-rules.md', 'utf-8'),
  ]);

  const state = getState();
  const env = await getEnvContext();

  // 6 片粘成 prompt
  return [
    `## 系统身份\n${persona}`,
    `## 用户品味\n${taste}\n\n### 情绪规则\n${moodRules}`,
    `## 环境信息\n${env}`,
    `## 历史记忆\n最近播放: ${state.plays.slice(-5).join(', ')}\n最近对话: ${state.messages.slice(-3).join('\n')}`,
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
