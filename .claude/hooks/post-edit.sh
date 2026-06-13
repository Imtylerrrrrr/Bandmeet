#!/usr/bin/env bash
# PostToolUse(Write|Edit) — 코드 품질 자동화. 모두 비차단(실패해도 작업 진행).
#   a) prettier 포맷 (설치돼 있을 때만)
#   b) Drizzle 스키마 변경 시 마이그레이션 리마인더
# 프로젝트가 아직 스캐폴딩 전이면 도구가 없으므로 조용히 no-op.
set -uo pipefail

input="$(cat)"
fp="$(printf '%s' "$input" | jq -r '.tool_response.filePath // .tool_input.file_path // ""')"
[ -z "$fp" ] && exit 0
[ -f "$fp" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
notes=""

# a) prettier 포맷 — 지원 확장자 + 로컬 prettier 존재 시에만
case "$fp" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.mdx)
    if [ -x "$root/node_modules/.bin/prettier" ]; then
      "$root/node_modules/.bin/prettier" --write --ignore-unknown "$fp" >/dev/null 2>&1 || true
    fi
    ;;
esac

# b) Drizzle 스키마 변경 리마인더
case "$fp" in
  *schema.ts|*/db/schema/*|*/drizzle/schema*|*/lib/db/schema*)
    notes="⚠ Drizzle 스키마가 변경되었습니다. 마이그레이션을 재생성하세요: \`npx drizzle-kit generate\` → 검토 후 \`npx drizzle-kit migrate\` (또는 \`push\`)."
    ;;
esac

if [ -n "$notes" ]; then
  jq -n --arg c "$notes" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
fi
exit 0
