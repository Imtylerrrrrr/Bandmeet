#!/usr/bin/env bash
# PreToolUse(Write|Edit) — 시크릿 가드.
#   1) 실제 .env 파일 편집/생성 차단 ('.example' 템플릿만 허용)
#   2) 실제 키 값(시크릿) 하드코딩만 차단 — 변수명·역할명 언급은 허용
# 빌드매뉴얼 4장: "서비스 키는 서버 전용, 클라이언트 노출 금지" 반영.
set -euo pipefail

input="$(cat)"
fp="$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')"
content="$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""')"
base="$(basename "$fp")"

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# 가드 스크립트 자신은 검사 제외 (탐지 패턴 문자열을 담고 있어 자기참조 오탐 방지)
case "$fp" in
  */.claude/hooks/*) exit 0 ;;
esac

# 1) .env 파일 보호 — '.example' 접미사 템플릿만 허용
case "$base" in
  *.example) ;;
  .env|.env.*)
    deny ".env 파일은 시크릿을 담습니다. 직접 편집/생성하지 마세요. 템플릿은 '.env.example'로 만드세요. (빌드매뉴얼 4장 보안규칙)"
    ;;
esac

# 2) 실제 키 값만 차단: 비공개 키 접두사 / JWT 토큰 리터럴 (역할명·변수명 언급은 통과)
sk="sb_""secret_"
jwt='eyJ[A-Za-z0-9_=-]{18,}\.[A-Za-z0-9_=-]{18,}\.[A-Za-z0-9_=-]'
if printf '%s' "$content" | grep -Eq "${sk}[A-Za-z0-9]{8,}|${jwt}"; then
  deny "시크릿 키(JWT 또는 비공개 토큰)로 보이는 값이 하드코딩되려 합니다. process.env로 분리하고 서버 전용 경로에서만 쓰세요."
fi
exit 0
