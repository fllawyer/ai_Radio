/**
 * ROUTER.JS — 意图分流
 * 简单指令直连 / 音乐走 ncm / 自然语言走 claude
 */
import { searchNcm } from './ncm.js';
import { askClaude } from './claude.js';

const SIMPLE_COMMANDS = ['下一首', '暂停', '继续', '音量', '今天天气'];

export async function route(input) {
  // 简单指令直连
  if (SIMPLE_COMMANDS.some(cmd => input.includes(cmd))) {
    return handleSimple(input);
  }
  // 音乐相关走 ncm
  if (isMusicRequest(input)) {
    return searchNcm(input);
  }
  // 其余自然语言走 Claude
  return askClaude(input);
}

function isMusicRequest(input) {
  const keywords = ['播放', '来一首', '放首', '换歌', '搜歌', '推荐歌'];
  return keywords.some(k => input.includes(k));
}

function handleSimple(input) {
  // TODO: 直连处理逻辑
  return { say: `收到：${input}`, action: 'simple' };
}
