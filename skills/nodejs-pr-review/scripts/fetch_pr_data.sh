#!/usr/bin/env bash
# 只读抓取 GitHub PR 数据用于审查报告。仅发 GET 请求，不会向 GitHub 写任何内容。
#
# 用法：
#   fetch_pr_data.sh [--repo nodejs/node] [--count 10] [--state open]
#                    [--out data] [--api BASE_URL]
#
# BASE_URL 示例：
#   https://api.github.com                                （公共 API，有限流）
#   https://api.sprites.dev/v1/gateway/github/<conn-id>   （Sprite API 网关）

set -euo pipefail

REPO="nodejs/node"
COUNT="10"
STATE="open"
OUT="data"
API="https://api.github.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    --state) STATE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --api) API="$2"; shift 2 ;;
    *) echo "未知选项：$1" >&2; exit 2 ;;
  esac
done

mkdir -p "$OUT"
LIST="$OUT/pr_list.json"

curl -fsSL --max-time 30 \
  "$API/repos/$REPO/pulls?state=$STATE&sort=created&direction=desc&per_page=$COUNT" \
  -o "$LIST"

if ! jq -e 'type == "array" and length > 0' "$LIST" >/dev/null; then
  echo "没有抓到 PR；请检查 --api/--repo 或 API 限流。" >&2
  jq '.' "$LIST" 2>/dev/null | head -20 >&2 || true
  exit 1
fi

mapfile -t NUMBERS < <(jq -r '.[].number' "$LIST")

for n in "${NUMBERS[@]}"; do
  curl -fsSL --max-time 30 "$API/repos/$REPO/pulls/$n" -o "$OUT/pr_$n.json"
  curl -fsSL --max-time 60 "$API/repos/$REPO/pulls/$n/files?per_page=100" -o "$OUT/pr_${n}_files.json"
  curl -fsSL --max-time 30 "$API/repos/$REPO/pulls/$n/reviews" -o "$OUT/pr_${n}_reviews.json"
  curl -fsSL --max-time 30 "$API/repos/$REPO/pulls/$n/comments" -o "$OUT/pr_${n}_comments.json"
  curl -fsSL --max-time 30 "$API/repos/$REPO/issues/$n/comments" -o "$OUT/pr_${n}_issue_comments.json"
  curl -fsSL --max-time 30 "$API/repos/$REPO/pulls/$n/commits?per_page=100" -o "$OUT/pr_${n}_commits.json"
  SHA=$(jq -r '.head.sha' "$OUT/pr_$n.json")
  curl -fsSL --max-time 30 "$API/repos/$REPO/commits/$SHA/check-runs?per_page=100" -o "$OUT/pr_${n}_checks.json"
  echo "已抓取 PR $n"
done

echo "完成：$OUT 中共 $(jq 'length' "$LIST") 个 PR"
