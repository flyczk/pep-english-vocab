#!/usr/bin/env bash
# 一键同步：git add → commit（时间戳）→ pull --rebase → push
# 用法：./sync.sh [可选的提交说明]
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "$(git status --porcelain)" ]]; then
  echo "没有改动，跳过同步。"
  exit 0
fi

git add -A

if [[ -n "${1:-}" ]]; then
  msg="$1 ($(date '+%Y-%m-%d %H:%M:%S'))"
else
  msg="sync: $(date '+%Y-%m-%d %H:%M:%S')"
fi
git commit -m "$msg"

branch="$(git branch --show-current)"
if git remote get-url origin >/dev/null 2>&1; then
  git pull --rebase origin "$branch"
  git push origin "$branch"
  echo "已同步到 origin/$branch：$msg"
else
  echo "已本地提交（无 origin 远端）：$msg"
fi
