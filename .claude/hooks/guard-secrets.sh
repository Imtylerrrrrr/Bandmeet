#!/usr/bin/env bash
# PreToolUse(Write|Edit) — 시크릿 가드.
# 1) 실제 .env 파일 편집 차단 (.env.example / *.example 템플릿은 허용)
# 2) 코드에 Supabase 서비스 롤 키 등 시크릿 하드코딩 차단
# 빌드매뉴얼 4장: "서비스 롤 키는 서버에서만, 클라이언트 노출 금지" 반영.
set -euo pipefail

input="$(cat)"
fp="$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')"
content="$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""')"
base="$(basename "$fp")"

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# 1) .env 파일 보호 — 예제 템플릿(.example 접미사)만 허용
case "$base" in
  *.example) ;; # 허용
  .env|.env.*)
    deny ".env 파일은 시크릿을 담습니다. 직접 편집/생성하지 마세요. 템플릿이 필요하면 '.env.example'을 만드세요. (빌드매뉴얼 4장 보안규칙)"
    ;;
esac

# 2) 코드에 시크릿 하드코딩 차단 (.example 제외)
if [ "${base##*.}" != "example" ]; then
  # Supabase 서비스 롤 / secret 키 패턴, 또는 명백한 키 할당
  if printf '%s' "$content" | grep -Eq 'service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=[[:space:]]*["'\''][^"'\'' ]'; then
    deny "서비스 롤 키/시크릿으로 보이는 값이 코드에 하드코딩되려 합니다. 환경변수(process.env.*)로 빼고 서버 전용 경로에서만 사용하세요."
  fi
fi

exit 0
