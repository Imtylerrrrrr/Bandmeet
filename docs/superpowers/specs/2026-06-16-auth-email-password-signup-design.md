# 이메일·아이디·비밀번호 회원가입 / 자체 로그인 설계

- 날짜: 2026-06-16
- 상태: 설계 승인 대기(사용자 검토 게이트)
- 레포: Bandmeet

## 1. 배경 / 문제

현재 인증은 **카카오 OAuth + 익명 게스트(`signInAnonymously`)** 두 가지다.
게스트는 로그인할 때마다 **새 익명 `user_id`** 가 생겨 다시 들어올 수 없다.
이 때문에 한 사용자가 게스트로 들어와 자기 동아리를 못 찾고 **같은 이름의 빈 동아리를 새로 만들어**
"데이터가 사라진 것처럼" 보이는 사고가 발생했다(2026-06-16). 실제 데이터 손실은 아니었다.

근본 해결: **다시 로그인 가능한 정식 계정**(이메일·아이디·비밀번호)을 도입한다.

## 2. 목표 / 비목표

**목표**
- 로그인 화면의 게스트 입장을 **회원가입(이메일·아이디·비밀번호)** 으로 교체.
- **아이디 또는 이메일** 중 무엇으로든 + 비밀번호로 로그인.
- **비밀번호 찾기**(이메일 재설정) 제공.
- 카카오 로그인 유지.
- 기존 `orgs`·`profiles`·`memberships`·카카오 계정 **전부 무변경**(데이터 보존).

**비목표(이번 범위 밖)**
- 현재 실사용 게스트가 없으므로 **익명 계정 일괄 마이그레이션 도구**는 만들지 않는다.
- 이메일 확인(verification)은 **지금은 비활성**(테스트 단계). 보안용으로 추후 콘솔에서 켠다.
- 소셜 로그인 추가(구글 등), 아이디 변경 UI, 카카오 유저에게 아이디 부여 — 추후.

## 3. 확정된 결정

| # | 결정 | 값 |
|---|---|---|
| 1 | 정식 계정 식별자 | **이메일 + 아이디 + 비밀번호** |
| 2 | 로그인 입력 | **아이디 또는 이메일** 둘 다 허용 |
| 3 | 이메일 확인(confirmation) | **지금 비활성**(가입 즉시 로그인), 추후 활성 |
| 4 | 비밀번호 찾기 | **이번에 포함**(이메일 재설정) |
| 5 | 게스트(익명) 입장 | **제거**, 회원가입으로 대체 |

## 4. 접근법 (채택 = 1안)

- **1안(채택)** — Supabase 기본 email/password + `profiles.username` 유니크 컬럼.
  로그인은 아이디/이메일 모두 허용(아이디면 서버에서 이메일로 해석 후 인증).
  기존 RLS·`auth.uid()`·카카오 구조를 그대로 재사용 → 추가 코드 최소·견고.
- 2안 — 아이디만(가짜 이메일 합성): 사용자가 이메일을 원해 기각.
- 3안 — 자체 인증 테이블 + 비번 해싱: Supabase Auth/RLS 재발명, 보안 위험·코드량 과다로 기각.

## 5. 아키텍처 / 데이터 흐름

### 5.1 회원가입
1. `/signup` 폼: 이메일·아이디·비밀번호 입력.
2. 서버 액션 `signUpWithPassword`:
   - 아이디 형식 검증(`^[a-z0-9_]{3,20}$`) + **중복 사전 체크**(`profiles.username`).
   - `supabase.auth.signUp({ email, password, options: { data: { name: username } } })`
     - 이메일 확인 비활성이므로 즉시 세션 발급.
     - 가입 트리거 `handle_new_user` 가 `profiles(id, name=아이디)` 생성(기존 동작).
   - `db.update(profiles).set({ username }).where(eq(profiles.id, user.id))` 로 아이디 저장.
   - `redirect('/')` → 소속 org 없으면 온보딩으로(기존 흐름).
   - 표시 이름(`profiles.name`)은 가입 시 **아이디와 동일**하게 시작.

### 5.2 로그인 (아이디 또는 이메일)
서버 액션 `signInWithPassword`:
```
id = form.identifier.trim()
pw = form.password
email = id.includes('@') ? id : await resolveEmailByUsername(id)
if (!email) throw '로그인 정보가 올바르지 않습니다'   // 제네릭(열거 방지)
const { error } = supabase.auth.signInWithPassword({ email, password: pw })
if (error) throw '로그인 정보가 올바르지 않습니다'      // 제네릭
redirect('/')
```

### 5.3 아이디 → 이메일 해석 (`resolveEmailByUsername`)
- 이메일은 `auth.users` 에만 있고 **`profiles` 에 저장하지 않는다**(RLS로 새지 않게).
- Drizzle `db`(postgres 권한 → RLS 우회, 서버 전용)로 원시 SQL:
  ```sql
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = $1
  limit 1
  ```
- 서버 액션에서만 호출(클라이언트 노출 없음).

### 5.4 카카오
- 기존 `signInWithKakao` 무변경. 카카오 유저는 `username = null`(아이디 로그인 불가, 카카오로만).

### 5.5 비밀번호 찾기
- `/forgot-password`: 이메일 입력 → `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/auth/reset\` })`.
- `/auth/reset`: 메일 링크로 진입(복구 세션) → 새 비밀번호 입력 → `supabase.auth.updateUser({ password })` → `/login`.
- 이메일 발송은 Supabase 기본 메일(레이트 제한)로 시작, 운영 시 SMTP 연결(추후).

## 6. 스키마 변경 (마이그레이션 0006)

`src/lib/db/schema.ts` `profiles` 에 컬럼 추가:
```ts
username: text('username').unique(),   // nullable. 카카오 유저는 null.
```
- `drizzle-kit generate` → `drizzle/0006_*.sql`(컬럼 + unique 인덱스). **nullable 이라 라이브 데이터 무영향.**
- 적용은 기존 관행대로 사용자가 `drizzle-kit migrate` 로 직접.
- 대소문자 충돌 방지를 위해 **아이디는 소문자로 정규화**하여 저장(검증 단계에서 `toLowerCase()`).

## 7. UI / 파일 변경

**신규**
- `src/app/signup/page.tsx` — 회원가입 폼(이메일·아이디·비밀번호) + 로그인 링크.
- `src/app/forgot-password/page.tsx` — 이메일 입력 폼.
- `src/app/auth/reset/page.tsx` — 새 비밀번호 입력(복구 세션 처리).
- `src/lib/auth/credentials.ts` — **순수 함수**: `isEmail(s)`, `normalizeUsername(s)`, `validateUsername(s)`(형식 규칙·에러 메시지).
- `src/lib/auth/credentials.test.mjs` — 순수 함수 단위 테스트.

**수정**
- `src/app/auth/actions.ts` — `signUpWithPassword`·`signInWithPassword`·`requestPasswordReset`·`updatePassword`·`resolveEmailByUsername` 추가. **`signInAsGuest` 제거.**
- `src/app/login/page.tsx` — 게스트 폼 제거 → **로그인 폼**(아이디/이메일 + 비번) + "회원가입"·"비밀번호 찾기" 링크. 카카오 버튼·둘러보기 링크 유지.

## 8. 보안 고려사항
- 로그인 실패 메시지는 **제네릭**(아이디/이메일 존재 여부 비노출). 단, 회원가입 시 아이디 중복은 알려줌(일반적 username 시스템 관행).
- 이메일은 `profiles` 에 저장하지 않아 org 동료에게 RLS로 새지 않음.
- 이메일 확인 비활성 = 테스트 단계 한정. **추후 콘솔에서 켜면** 가짜 이메일 가입 차단(결정 #3).
- `resolveEmailByUsername` 은 서버 전용(Drizzle postgres 권한). 입력은 `validateUsername` 통과분만.
- 신규 가입 개방 = 누구나 가입 가능(제품 의도). 남용 시 추후 이메일 확인/레이트리밋.

## 9. 데이터 보존
- 기존 데이터 무변경. `profiles.username`(nullable) 컬럼만 추가.
- 별도 게스트 마이그레이션 없음(실사용 게스트 0).
- 운영 메모: 현 익명 세션(심주영, 락커빌리 admin 멤버십 보유)은 만료 전까지만 유효하고 재로그인 불가.
  필요 시 정식 가입 후 그 계정을 원본 org에 추가(이전과 동일 방식). org 데이터 자체는 무관하게 보존됨.

## 10. 전제 조건 (사용자 콘솔 작업)
- Supabase Authentication → **Email provider 활성화**, **"Confirm email" 비활성**(결정 #3, 가입 즉시 로그인).
- (선택) 익명 로그인 비활성화.
- Auth → URL Configuration 의 Redirect URLs 에 `/auth/reset` 경로 포함 확인(이미 `/**` 등록되어 있으면 무관).

## 11. 테스트 전략
- **단위(순수)**: `credentials.test.mjs` — `isEmail` 판별, `normalizeUsername`(소문자화), `validateUsername`(길이 3~20·허용문자 `[a-z0-9_]`) 경계값. 기존 `node --test` 러너.
- **라이브 스모크(수동/스크립트)**: 가입 → 로그아웃 → **아이디로 재로그인** → **이메일로 재로그인** → 데이터 유지 확인 → 비밀번호 찾기 메일 → 재설정 → 새 비번 로그인.
- `tsc` 0 · `eslint` 0 · `next build` 통과 · 기존 테스트 회귀 0.

## 12. 범위 밖 / 후속
- 카카오 유저에게 아이디 부여, 아이디/표시이름 변경 UI.
- 이메일 확인 활성화(추후) + SMTP 연결.
- 소셜 로그인 추가, 가입 레이트리밋/캡차.
