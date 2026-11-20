#!/usr/bin/env bash
# 一键同步：git add → commit（时间戳）→ pull --rebase origin → 推送所有远端
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
git commit -m "$msg" >/dev/null

branch="$(git branch --show-current)"

# 先与主远端对齐，避免多端推送时历史分叉
if git remote get-url origin >/dev/null 2>&1; then
  git pull --rebase --autostash origin "$branch" >/dev/null 2>&1 || {
    echo "pull --rebase 失败，请手动处理冲突后再同步。" >&2
    exit 1
  }
fi

remotes="$(git remote)"
if [[ -z "$remotes" ]]; then
  echo "已本地提交（未配置任何远端）：$msg"
  exit 0
fi

failed=()
for r in $remotes; do
  if git push "$r" "$branch" >/dev/null 2>&1; then
    echo "  ✓ $r"
  else
    echo "  ✗ $r 推送失败" >&2
    failed+=("$r")
  fi
done

if (( ${#failed[@]} > 0 )); then
  echo "以下远端未同步：${failed[*]}" >&2
  exit 1
fi

echo "已同步全部远端：$msg"
