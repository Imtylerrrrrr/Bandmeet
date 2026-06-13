# Bandmeet — 밴드 합주·회의 일정 자동 매칭 웹앱

> 카톡 재투표 지옥 없이, 밴드 동아리의 합주·회의 일정을 자동으로 매칭하는 모바일 우선 웹앱.

일반적인 "노는 날 맞추기" 앱과 다른 핵심 난제: **한 사람이 여러 곡을 맡고 + 합주실은 1개 + 합주를 이어서(무틈) 패킹**해야 한다는 점. 이 세 제약이 동시에 걸리는 일정 매칭을 다룬다.

## 핵심 개념

- **가용성 한 번 칠하기** — 사람별 전역 가용성 1개(주간 반복 템플릿 + 날짜별 예외, 🟢가능 / 🟡되면가능). 한 번 칠하면 모든 팀·곡·회의 매칭에 공유된다.
- **충돌 2축** — 방 충돌(같은 시간 두 합주) + 사람 충돌(한 명이 든 두 곡이 같은 시간). 마스터 캘린더와 곡 담당자 명단이 각각 잡는다.
- **랭크 투표** — 추천 슬롯에 1·2·3순위 투표 → 마감 시 최다 → 최상위 빈 슬롯 자동 부킹. 1순위가 먹혀도 2순위로 미끄러져 재투표 cascade를 차단한다.
- **핵심 루프** — 모으기(가용성 칠하기) → 정하기(투표·확정) → 띄우기(캘린더·점유 차감) → 알림 → 변경 감지 시 재진입. 공연 주까지 매주 반복.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트 + API | Next.js (App Router, TS) on Vercel |
| 스타일 | Tailwind CSS |
| DB + 인증 | Supabase (Postgres + Auth + RLS), 카카오 OAuth |
| ORM | Drizzle |
| 단건 매칭 (MVP) | TypeScript (interval-intersection sweep, Vercel Route Handler) |
| 묶음 매칭 (v2) | Python FastAPI + OR-Tools CP-SAT |
| 스케줄러 | Vercel Cron (투표 마감 자동 확정) |
| 데이터 페칭 / 검증 | TanStack Query + Server Components / Zod |
| 카톡 연동 | v1 사설 봇(메신저봇R, 조회·알림 전용) |

멀티테넌트 SaaS 지향 — 모든 테이블에 `org_id` + 멤버십 조인, RLS로 org 스코프. MVP는 단일 동아리.

## MVP 범위

카카오 로그인 + org/멤버십 → 공연·팀·곡(투표)·곡-사람 배치 → 가용성 입력 → **단건 자동추천·랭크투표·마감 자동확정** → 합주실 마스터 캘린더(방·사람 충돌 경고) → 개인 통합 주간 뷰 → 소집 알림(복붙/딥링크 + 사설 봇) → 학기 종료 아카이브.

**v2:** CP-SAT 묶음 매칭(이어서 하기), 회의 일정, 알림톡 전환, 충돌 자동 재계산 정교화.

## 문서

- [`밴드합주일정앱_기획정리_v1.md`](./밴드합주일정앱_기획정리_v1.md) — 제품 기획 전문 (데이터 모델, 매칭 엔진, 화면)
- [`밴드합주일정앱_스택_빌드매뉴얼_v1.md`](./밴드합주일정앱_스택_빌드매뉴얼_v1.md) — 스택 결정 + 검증 + 빌드 순서

## 상태

🚧 빌드 진행 중 — **1~3단계 코드 완료**(Scaffold · 스키마+RLS · 인증). DB 연결·마이그레이션 적용 전.

- ✅ **Scaffold** — Next 16(App Router/TS) + Tailwind v4 + Drizzle + Supabase SSR 클라이언트 + env 템플릿
- ✅ **스키마 + RLS** — 16개 테이블 Drizzle 스키마, 마이그레이션 SQL(`drizzle/0000`), 멀티테넌트 RLS 정책 + 카카오 가입 트리거(`drizzle/0001`)
- ✅ **인증** — Supabase 미들웨어 세션 + 카카오 OAuth 라우트 + 역할 가드(`requireRole`)
- ⏳ **다음(차단됨):** Supabase 프로젝트 생성 + `.env.local` 작성 + `drizzle-kit migrate` + 카카오 OAuth 키 등록 → 이후 4단계(구조 CRUD)부터 재개

빌드 순서(전체): Scaffold → 스키마+RLS → 인증 → 구조 CRUD → 가용성 입력 → 단건 매칭 엔진 → 투표 마감 Cron → 룸 캘린더+개인 뷰 → 소집/outbox → 사설 봇 → 아카이브.

### 로컬 실행 (DB 연결 후)

```bash
npm install
cp .env.example .env.local      # 값 채우기
npx drizzle-kit migrate          # 스키마 + RLS 적용
npm run dev
```
