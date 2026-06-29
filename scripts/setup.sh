#!/bin/bash
# Claudio TTS 环境初始化 (macOS)
# 在项目根目录运行: bash scripts/setup.sh

set -e

echo "=== Claudio TTS 安装脚本 ==="

# 找 Python 3.10+（brew 安装的 python@3.12 路径）
PYTHON=""
for candidate in /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 /usr/local/bin/python3.13 /usr/local/bin/python3.12 python3; do
  if command -v "$candidate" &>/dev/null; then
    VER=$("$candidate" --version 2>&1 | awk '{print $2}')
    MAJOR=$(echo "$VER" | cut -d. -f1)
    MINOR=$(echo "$VER" | cut -d. -f2)
    if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 10 ]; then
      PYTHON="$candidate"
      echo "找到: $candidate ($VER)"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "错误: 需要 Python 3.10+"
  echo "安装: brew install python@3.12"
  exit 1
fi

# 在项目目录创建虚拟环境
VENV_DIR=".venv"
echo ""
echo "创建虚拟环境: $VENV_DIR"
"$PYTHON" -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# 安装依赖
echo ""
echo "安装 mlx-speech 和 soundfile..."
pip install mlx-speech soundfile

# 验证
echo ""
echo "验证..."
python -c "import mlx_speech; print('  mlx-speech OK')"
python -c "import soundfile;  print('  soundfile  OK')"

echo ""
echo "=== 完成！==="
echo ""
echo "每次启动服务器前激活虚拟环境:"
echo "  source .venv/bin/activate"
echo "  node server.js"
echo ""
echo "首次合成语音时会自动下载模型 (~4-5GB)，之后复用缓存。"
echo ""
