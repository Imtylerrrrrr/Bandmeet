// 인증 식별자(아이디·이메일) 순수 로직. DB·네트워크 의존 없음 → 단위 테스트 대상.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** 이메일 형식 여부(로그인 식별자 분기·가입 검증용). */
export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

/** 아이디 정규화: 앞뒤 공백 제거 + 소문자화(대소문자 충돌 방지). */
export function normalizeUsername(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * 정규화된 아이디 검증. 유효하면 null, 아니면 한국어 에러 메시지.
 * 규칙: 영소문자·숫자·밑줄(_) 3~20자.
 */
export function validateUsername(s: string): string | null {
  if (!USERNAME_RE.test(s)) {
    return '아이디는 영소문자·숫자·밑줄(_) 3~20자로 입력하세요.';
  }
  return null;
}
