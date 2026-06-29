/**
 * CLAUDE.JS — 大脑适配器
 * 支持三种模式: Mock(默认) | DeepSeek API | Claude CLI
 *
 * 配置优先级: Settings 页面填入 > DEEPSEEK_API_KEY 环境变量 > Mock
 */
import { spawn } from 'node:child_process';

// 运行时 API Key（由 server.js 设置，来自 Settings 页面或环境变量）
let deepseekKey = process.env.DEEPSEEK_API_KEY || '';

export function setApiKey(key) {
  deepseekKey = key;
}

export function getApiKey() {
  return deepseekKey;
}

function mockReply(prompt) {
  const hour = new Date().getHours();
  const vibe = hour < 10 ? '清晨' : hour < 14 ? '上午' : hour < 18 ? '下午' : '晚上';
  return {
    say: `${vibe}好！根据你的品味，我推荐来一首轻松的音乐。`,
    play: [{ id: '1', title: '晴天', artist: '周杰伦' }],
    reason: `现在是${vibe}时段，适合舒缓放松的曲风`,
    segue: '接下来让我们一起听这首歌',
  };
}

/**
 * 调用 DeepSeek API 生成 DJ 回复
 */
async function askDeepSeek(prompt) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deepseekKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是 Claudio，一个懂音乐的个人 AI DJ。你的风格温暖、有见解，像朋友聊天。

## 核心规则
1. 每次回复必须有新内容，不要重复之前说过的句式
2. \`say\` 用自然的中文 DJ 口吻，长度 20-80 字
3. \`reason\` 写出具体的选曲理由（为什么这首适合现在的氛围/时间/用户心情）
4. \`play\` 从用户品味中选最合适的歌
5. \`segue\` 自然过渡到下一话题

## 输出格式（JSON，不要 markdown）
{"say":"串词", "play":[{"title":"歌名","artist":"歌手"}], "reason":"选曲理由", "segue":"过渡语"}

## 注意
- 如果用户只是闲聊，say 里正常回应即可
- 不要每次都推荐"晴天-周杰伦"，根据上下文变化选曲
- 不要使用固定的句式模板`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  console.log('[DeepSeek] 返回:', content.slice(0, 200));

  try {
    const result = JSON.parse(content);
    return {
      say: result.say || '',
      play: result.play || [],
      reason: result.reason || '',
      segue: result.segue || '',
    };
  } catch {
    return { say: content.trim(), play: [], reason: '', segue: '' };
  }
}

/**
 * 外部入口
 * @param {string} prompt - 组装好的完整 prompt
 * @returns {Promise<{say: string, play: object[], reason: string, segue: string}>}
 */
export async function askClaude(prompt) {
  // 调试：确认当前 Key 状态
  const hasKey = !!deepseekKey;
  console.log(`[Brain] 模式: ${hasKey ? 'DeepSeek' : 'Mock'}, Key: ${deepseekKey ? deepseekKey.slice(0,8)+'...' : '无'}`);

  // 有 DeepSeek Key → 走 DeepSeek API
  if (deepseekKey) {
    return askDeepSeek(prompt);
  }

  // 设置 CLAUDE=1 且本地安装 claude → 走 Claude CLI
  if (process.env.CLAUDE === '1') {
    const CLAUDE_BIN = '/Users/lifang/.local/bin/claude';
    return new Promise((resolve, reject) => {
      const child = spawn(CLAUDE_BIN, ['-p', '--output-format', 'json'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60_000,
      });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => stdout += d);
      child.stderr.on('data', d => stderr += d);
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error(`claude exited ${code}`));
        try {
          const r = JSON.parse(stdout);
          resolve({ say: r.say || '', play: r.play || [], reason: r.reason || '', segue: r.segue || '' });
        } catch {
          resolve({ say: stdout.trim(), play: [], reason: '', segue: '' });
        }
      });
      child.on('error', reject);
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  // 默认 → Mock
  return mockReply(prompt);
}
