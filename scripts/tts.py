#!/usr/bin/env python3
"""
TTS 合成脚本 — mlx-speech (Apple Silicon 原生)
用法: echo "要合成的话" | python3 tts.py --output /path/to/output.wav

首次运行会自动下载模型 (~6.7GB)，后续复用缓存。
"""
import argparse
import sys
import os

def main():
    parser = argparse.ArgumentParser(description="Fish Speech TTS via mlx-speech")
    parser.add_argument("--output", required=True, help="输出 WAV 文件路径")
    parser.add_argument("--model", default="fish-s2-pro",
                        help="mlx-speech 模型别名")
    args = parser.parse_args()

    text = sys.stdin.read().strip()
    if not text:
        print("[TTS] 错误: 未收到文本", file=sys.stderr)
        sys.exit(1)

    print(f"[TTS] 合成中... ({len(text)} 字)", file=sys.stderr)

    try:
        import mlx_speech
        import mlx.core as mx
        import numpy as np
        import soundfile as sf
    except ImportError as e:
        print(f"[TTS] 缺少依赖: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        print(f"[TTS] 加载模型: {args.model} ...", file=sys.stderr)
        model = mlx_speech.tts.load(args.model)
        print(f"[TTS] 模型加载完成", file=sys.stderr)

        result = model.generate(text)

        # 从 TTSOutput 中提取音频数据
        audio = result.waveform
        sample_rate = result.sample_rate

        # mlx array → numpy
        if hasattr(audio, '__array__'):
            audio = np.array(audio)

        # 立体声 → 单声道
        if audio.ndim == 2:
            audio = np.mean(audio, axis=0)

        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        sf.write(args.output, audio, sample_rate)
        print(f"[TTS] 已保存: {args.output} ({len(audio)/sample_rate:.1f}s)", file=sys.stderr)
        print(args.output)

    except Exception as e:
        print(f"[TTS] 合成失败: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
