#!/usr/bin/env bash
# 将会话 JSONL 转为 Markdown（包装 jsonl-to-md.js）
# - 不传参：默认取当前 Cursor 工程目录 slug 对应 agent-transcripts 下最新的 .jsonl
# - 传参：显式传入 .jsonl 路径
#
# CURSOR_WORKSPACE：显式指定工作区路径（应与 Cursor 打开的文件夹一致），默认为当前 pwd
# EXPORT_SESSION_MD_OUT：指定 Markdown 输出目录（默认：<本脚本所在仓库>/session-exports）

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONV="${REPO_ROOT}/jsonl-to-md.js"
OUT_DEFAULT="${EXPORT_SESSION_MD_OUT:-${REPO_ROOT}/session-exports}"
WS="${CURSOR_WORKSPACE:-${PWD}}"
SLUG="${WS#/}"
SLUG="${SLUG//\//-}"
TRANSCRIPTS_DIR="${HOME}/.cursor/projects/${SLUG}/agent-transcripts"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat << EOF
用法:
  ./export-session-to-md.sh                       # 使用最新会话 JSONL
  ./export-session-to-md.sh <会话.jsonl>          # 指定文件
  ./export-session-to-md.sh <会话.jsonl> <输出目录>

环境变量 CURSOR_WORKSPACE：工作区根路径（应与 Cursor 打开的根目录一致），默认 pwd。
EXPORT_SESSION_MD_OUT：Markdown 输出目录，省略则写入本工具仓库下的 session-exports。
转录路径: ~/.cursor/projects/<slug>/agent-transcripts/
EOF
  exit 0
fi

INPUT_JSONL=""
OUTPUT_DIR="$OUT_DEFAULT"

if [[ $# -ge 1 && -f "${1}" ]]; then
  INPUT_JSONL="$(cd "$(dirname "${1}")" && pwd)/$(basename "${1}")"
  if [[ $# -ge 2 ]]; then
    OUTPUT_DIR="$(cd "${2}" && pwd)"
  fi
else
  mkdir -p "$OUT_DEFAULT"
  if [[ ! -d "$TRANSCRIPTS_DIR" ]]; then
    echo "未找到转录目录: ${TRANSCRIPTS_DIR}" >&2
    echo "请确认 Cursor 已打开的本机工作区路径，或运行: CURSOR_WORKSPACE=/path/to/repo $0" >&2
    exit 1
  fi

  newest=""
  max_mtime=0
  while IFS= read -r cand; do
    [[ -f "$cand" ]] || continue
    if stat --version >/dev/null 2>&1; then
      mt=$(stat -c %Y "$cand")
    else
      mt=$(stat -f %m "$cand")
    fi
    if [[ -z "${newest}" ]] || (( mt > max_mtime )); then
      max_mtime=$mt
      newest="$cand"
    fi
  done < <(find "${TRANSCRIPTS_DIR}" -name '*.jsonl' -type f -print)

  if [[ -z "${newest}" ]]; then
    echo "目录中无 .jsonl: ${TRANSCRIPTS_DIR}" >&2
    exit 1
  fi
  INPUT_JSONL="$newest"
  OUTPUT_DIR="$OUT_DEFAULT"
fi

mkdir -p "$OUTPUT_DIR"

if [[ ! -f "$CONV" ]]; then
  echo "未找到转换脚本: ${CONV}" >&2
  exit 1
fi

echo "输入: ${INPUT_JSONL}"
echo "输出目录: ${OUTPUT_DIR}"
exec node "${CONV}" "${INPUT_JSONL}" "${OUTPUT_DIR}"
