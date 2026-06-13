#!/usr/bin/env bash
# PostToolUse(Write|Edit) — 백그라운드 타입체크.
# async + asyncRewake로 설정 → 편집을 막지 않고, 타입 에러가 있을 때만(exit 2) 모델을 깨움.
# 스캐폴딩 전(tsc/tsconfig 없음)이면 조용히 통과.
set -uo pipefail

input="$(cat)"
fp="$(printf '%s' "$input" | jq -r '.tool_response.filePath // .tool_input.file_path // ""')"
case "$fp" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
tsc="$root/node_modules/.bin/tsc"
[ -x "$tsc" ] || exit 0
[ -f "$root/tsconfig.json" ] || exit 0

out="$("$tsc" --noEmit -p "$root/tsconfig.json" 2>&1)" && exit 0

# 타입 에러 → rewake (앞 50줄만)
printf 'TypeScript 타입 에러 (tsc --noEmit):\n%s\n' "$(printf '%s' "$out" | head -50)"
exit 2
