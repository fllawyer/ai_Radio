/**
 * SCHEDULER.JS — 节律调度
 * 07:00 规划 / 09:00 早间 / 每小时情绪检查 / 日历 hook
 */
import { askClaude } from './claude.js';
import { buildContext } from './context.js';
import { updateState } from './state.js';

let broadcast;

const SCHEDULES = [
  { time: [7, 0],  action: 'morning_plan',   desc: '今日规划' },
  { time: [9, 0],  action: 'morning_brief',   desc: '早间播报' },
];

export function startScheduler(fn) {
  broadcast = fn;
  console.log('[Scheduler] 启动节律调度...');

  checkEveryMinute();
  setInterval(checkEveryMinute, 60_000);
}

function checkEveryMinute() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  for (const sched of SCHEDULES) {
    if (sched.time[0] === h && sched.time[1] === m) {
      trigger(sched);
    }
  }

  // 每小时整点情绪检查 (排除已有任务的时间)
  if (m === 0 && !SCHEDULES.some(s => s.time[0] === h && s.time[1] === 0)) {
    trigger({ action: 'mood_check', desc: '情绪检查' });
  }
}

async function trigger(sched) {
  console.log(`[Scheduler] 触发: ${sched.desc} (${sched.action})`);
  const prompt = await buildContext(`[Scheduled] ${sched.action}`);
  try {
    broadcast?.({ type: 'thinking' });
    const result = await askClaude(prompt);
    updateState({ lastSchedule: { action: sched.action, time: Date.now(), result } });
    broadcast?.({ type: 'reply', ...result });
    console.log('[Scheduler] 完成:', result.say?.slice(0, 60));
  } catch (e) {
    console.error('[Scheduler] 失败:', e.message);
    broadcast?.({ type: 'error', message: e.message });
  }
}

export function handleWebhook(event) {
  console.log('[Webhook]', event);
}
