/**
 * STATE.DB — 状态记忆
 * 内存存储 + 持久化到 state.json，跨重启保留
 */
import { readFile, writeFile } from 'node:fs/promises';

const STATE_FILE = process.env.STATE_FILE || 'state.json';

const state = {
  messages: [],
  plays: [],
  plan: null,
  prefs: {},
  lastSchedule: null,
};

export function getState() {
  return { ...state };
}

export function updateState(patch) {
  Object.assign(state, patch);
  persist();
}

export function addMessage(msg) {
  state.messages.push({ ...msg, time: Date.now() });
  // 只保留最近 200 条
  if (state.messages.length > 200) {
    state.messages = state.messages.slice(-200);
  }
  persist();
}

export function addPlay(song) {
  state.plays.push({ ...song, playedAt: Date.now() });
  if (state.plays.length > 500) {
    state.plays = state.plays.slice(-500);
  }
  persist();
}

async function persist() {
  try {
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[State] 持久化失败:', e.message);
  }
}

export async function loadState() {
  try {
    const data = await readFile(STATE_FILE, 'utf-8');
    const loaded = JSON.parse(data);
    Object.assign(state, loaded);
    console.log('[State] 已恢复记忆:', state.plays.length, '首播放记录');
  } catch {
    console.log('[State] 初始状态，暂无历史记忆');
  }
}
