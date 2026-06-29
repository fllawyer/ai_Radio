/**
 * TTS.JS — 声音管线
 * mlx-speech (Apple Silicon 原生) → cache/tts/*.wav → /tts/:id.wav
 */
import { writeFile, readFile, mkdir, stat, accessSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CACHE_DIR = join(PROJECT_ROOT, 'cache', 'tts');
const TTS_SCRIPT = join(PROJECT_ROOT, 'scripts', 'tts.py');

// 优先使用项目 venv 的 Python，找不到再用系统 Python
function getPythonBin() {
  const venvPython = join(PROJECT_ROOT, '.venv', 'bin', 'python3');
  try { accessSync(venvPython, constants.F_OK); return venvPython; } catch {}
  return 'python3';
}

// TTS 是否可用（初始检测）
let ttsAvailable = null;

/**
 * 检查 TTS 环境是否就绪
 */
export function isTtsReady() {
  return ttsAvailable === true;
}

export async function checkTts() {
  if (ttsAvailable !== null) return ttsAvailable;
  try {
    const pythonBin = getPythonBin();
    const proc = spawn(pythonBin, ['-c', 'import mlx_speech; print("ok")'], {
      timeout: 5_000,
    });
    await new Promise((resolve, reject) => {
      proc.on('close', (code) => code === 0 ? resolve() : reject());
      proc.on('error', reject);
    });
    ttsAvailable = true;
    console.log('[TTS] mlx-speech 就绪');
  } catch {
    ttsAvailable = false;
    console.log('[TTS] mlx-speech 未安装，TTS 降级为文本模式');
  }
  return ttsAvailable;
}

/**
 * 将文本合成为语音，优先命中缓存
 * @param {string} text - 待合成的文本
 * @returns {Promise<string|null>} 可访问的音频 URL 路径，失败返回 null
 */
export async function synthesize(text) {
  if (!(await checkTts())) return null;

  const hash = createHash('md5').update(text).digest('hex').slice(0, 12);
  const filename = `${hash}.wav`;
  const filepath = join(CACHE_DIR, filename);

  // 检查缓存
  try {
    await stat(filepath);
    console.log(`[TTS] 缓存命中: ${filename}`);
    return `/tts/${filename}`;
  } catch {
    // 缓存未命中，调用 mlx-speech
  }

  return new Promise((resolve) => {
    console.log(`[TTS] 合成: "${text.slice(0, 40)}..."`);

    const pythonBin = getPythonBin();
    const proc = spawn(pythonBin, [TTS_SCRIPT, '--output', filepath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
    });

    let stderr = '';

    proc.stdout.on('data', () => {
      // script 会在 stdout 输出文件路径
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('[TTS]', data.toString().trim());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(`/tts/${filename}`);
      } else {
        console.error(`[TTS] 失败 (exit ${code}):`, stderr.slice(-200));
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      console.error('[TTS] 进程错误:', err.message);
      resolve(null);
    });

    // 文本通过 stdin 传入
    proc.stdin.write(text);
    proc.stdin.end();
  });
}
