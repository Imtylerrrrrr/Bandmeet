---
name: Bandmeet
description: 밴드 동아리 합주·회의 일정 자동 매칭
colors:
  canvas: "#fafafa"
  surface: "#ffffff"
  line: "#ebebeb"
  line-strong: "#e0e0e0"
  hover: "#f4f4f5"
  ink: "#171717"
  mut: "#5f5f5f"
  faint: "#707070"
  primary: "#5b4be6"
  primary-soft: "#eeedfe"
  primary-ink: "#3c3489"
  ok-paint: "#86efac"
  ok-bg: "#dcfce7"
  ok-text: "#15803d"
  warn-paint: "#fcd34d"
  warn-bg: "#fef3c7"
  warn-text: "#b45309"
  danger-bg: "#fee2e2"
  danger-text: "#b91c1c"
  meeting-bg: "#f4f4f5"
  meeting-text: "#52525b"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-ink}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mut}"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 14px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  badge:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.mut}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  nav-link-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
---

# Design System: Bandmeet

## 1. Overview

**Creative North Star: "조용한 합주실 화이트보드"**

Bandmeet은 단톡 재투표 지옥을 없애는 도구다. 그래서 화면은 **조용하다.** Geist/Vercel 결의 미니멀리즘 위에, 거의 흰색에 가까운 캔버스(#fafafa)와 종이 같은 카드(#ffffff)를 하이라이트(hairline) 테두리(#ebebeb)로만 나눈다. 주인공은 언제나 일정·시간·이름이지 UI 크롬이 아니다. 인디고(#5b4be6) 하나가 행동·활성·"오늘"을 표시하고, 나머지는 중립 회색 램프가 받친다.

밀도는 **앱 UI의 밀도**다. 표·격자·폼이 빽빽이 들어가도 되지만, 딱딱하지 않게 — 검정 테두리 대신 hairline, 굵은 그림자 대신 평면+테두리. 색은 의미일 때만 등장한다: 가능(초록)·되면(노랑)·방 중복(빨강)·회의(중립). 캘린더가 한눈에 "되는 것/안 되는 것/겹치는 것"을 말해야 한다.

이 시스템이 거부하는 것(PRODUCT.md 안티레퍼런스): **카톡식 산만함**(정리 안 된 대화·무한 재투표), **시끄러운 SaaS 마케팅**(그라데이션·히어로 메트릭·과장 모션), **무거운 엔터프라이즈**(빽빽한 검정 그리드·회색 블록). 이건 캠페인이 아니라 도구다.

**Key Characteristics:**
- 거의 흰 2층 중립(캔버스/서피스) + hairline 테두리로만 분리
- 단일 인디고 액센트 = 행동·활성·오늘 (장식 아님)
- 의미색 4종(가능/되면/방중복/회의)은 캘린더·상태에만
- 평면 기본, 그림자는 오버레이(모달·드로어)에만
- Geist 한 가족, 굵기·크기로만 위계
- WCAG AA 가독성(옅은 회색 본문 금지)

## 2. Colors

거의 무채색 2층 중립 위에 인디고 단일 액센트, 그리고 의미를 가진 상태색만 절제해서 쓴다.

### Primary
- **인디고 (Indigo, #5b4be6):** 주요 버튼(솔리드), 활성 메뉴 알약, "오늘", 링크, 포커스 링. 화면당 작은 면적만 차지한다 — 흔하면 의미를 잃는다.
- **인디고 연배경 (Indigo Soft, #eeedfe):** 활성 네비 알약 배경, 확정 합주 블록, 강조 칩의 바탕.
- **인디고 잉크 (Indigo Ink, #3c3489):** 인디고 연배경 위 텍스트, primary 버튼 hover 배경.

### Neutral
- **캔버스 (Canvas, #fafafa):** 페이지 배경. 거의 흰색.
- **서피스 (Surface, #ffffff):** 카드·입력·헤더·모달의 바탕.
- **잉크 (Ink, #171717):** 본문·제목 텍스트.
- **보조 (Muted, #5f5f5f):** 부제목·설명·메타데이터·캘린더 시간 라벨. **AA 통과를 위해 어둡게 조정됨**(틴트 배경 위에서도 ≥4.5:1).
- **힌트 (Faint, #707070):** 가장 약한 텍스트(구분선 라벨·보조 힌트). mut보다 밝되 의미 텍스트도 읽히는 선(≥4.5:1)을 지킨다.
- **라인 (Line, #ebebeb):** 모든 테두리·격자선의 기본. 검정 테두리는 전역 베이스 레이어에서 이 hairline으로 덮는다.
- **강조 라인 (Line Strong, #e0e0e0):** hover 시 테두리·가용성 격자 빈 칸.
- **hover (#f4f4f5):** hover 배경, 역할 배지 바탕, 회의 블록.

### Tertiary (의미색 / 상태)
- **가능 (Green, paint #86efac / bg #dcfce7 / text #15803d):** 가용성 '가능', 긍정 상태.
- **되면 (Amber, paint #fcd34d / bg #fef3c7 / text #b45309):** 가용성 '되면 가능', 시간 겹침 경고.
- **위험 (Red, bg #fee2e2 / text #b91c1c):** 방 중복(더블부킹) 경고, 삭제/파괴 동작.
- **회의 (Slate, bg #f4f4f5 / text #52525b):** 회의 일정 블록(합주와 구분, 방 점유 없음).

### Named Rules
**The One-Indigo Rule.** 인디고는 한 가지 일만 한다: 행동·활성·오늘. 장식·배경·"브랜드 느낌"으로 인디고를 뿌리지 않는다. 화면에서 인디고가 차지하는 면적이 작을수록 그 신호가 강하다.

**The Meaning-Only Color Rule.** 초록·노랑·빨강은 오직 상태(가능/되면/충돌)일 때만. 예쁘라고 쓰는 색은 없다.

## 3. Typography

**Body / Display Font:** Geist (fallback: `ui-sans-serif, system-ui, -apple-system, sans-serif`)
**Mono Font:** Geist Mono (초대코드·숫자 정렬 등 한정)

**Character:** 한 가족(Geist)으로 끝낸다. 중립적이고 또렷한 기하학적 산세리프 — 도구가 일에 숨는다는 원칙에 맞다. 위계는 두 번째 폰트가 아니라 크기·굵기·색으로만 만든다. 본문은 `line-height: 1.6`, `text-rendering: optimizeLegibility`, `font-kerning: normal`.

### Hierarchy
- **Display** (600, 1.875rem/text-3xl, lh 1.2, tracking -0.025em): 데모·랜딩 히어로 헤드라인. 앱 내부엔 거의 없음.
- **Headline** (600, 1.1875rem/text-[19px], lh 1.3, tracking -0.02em): 페이지 제목("락커빌리", "합주실 캘린더").
- **Title** (600, 0.9375rem/text-[15px], lh 1.4): 카드·섹션 제목.
- **Body** (400, 0.875rem/text-sm, lh 1.6): 본문·설명. 산문은 컨테이너 max-width로 65–75ch 안에 둔다.
- **Label** (500, 0.8125rem/text-[13px], lh 1.4): 버튼·네비·폼 라벨. 행동을 말한다("표대로 확정").
- **Caption** (400, 0.75rem/text-xs): 메타·범례·힌트(색은 mut/faint).

### Named Rules
**The One-Family Rule.** 폰트는 Geist 하나. 위계는 굵기(400/500/600)와 크기·색으로 만든다. 두 번째 서체를 더하지 않는다.

**The No-Faint-Body Rule.** 의미 있는 텍스트에 옅은 회색(구 #a3a3a3)을 쓰지 않는다. 모든 본문·라벨·시간 숫자는 ≥4.5:1. "우아한 연회색"은 가독성 저하의 1순위 원인이다.

**The Tabular Time Rule.** 시간·날짜·득표 수 등 정렬돼야 하는 숫자는 `tabular-nums`.

## 4. Elevation

**평면 기본(Flat-by-default).** 깊이는 그림자가 아니라 **hairline 테두리(#ebebeb)와 2층 중립(캔버스/서피스)**으로 만든다. 카드도 쉴 때는 평평하다. 그림자는 상태나 오버레이일 때만 등장한다.

### Shadow Vocabulary
- **카드 hover** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)` / Tailwind `shadow-sm`): 클릭 가능한 카드가 hover 시 살짝 떠오름(+ `-translate-y-px`).
- **오버레이** (`shadow-xl`): 모달(ConfirmButton)·모바일 드로어 패널처럼 페이지 위에 뜨는 표면에만.

### Named Rules
**The Flat-At-Rest Rule.** 표면은 쉴 때 평평하다. 그림자는 상태(hover)나 레이어(모달·드로어)에 대한 반응으로만 나타난다. 장식 그림자 금지.

**The Hairline Rule.** Tailwind 기본 테두리색(currentColor=검정)은 전역 base에서 #ebebeb로 덮는다. 검정 1px 테두리는 이 디자인에 존재하지 않는다.

## 5. Components

### Buttons
- **Shape:** 둥근 모서리(8px, `rounded-lg`). 높이 sm 32px(`h-8`)·md 36px(`h-9`), 가로 패딩 px-2.5/px-3.5. `inline-flex` 중앙정렬 + 아이콘 gap 6px. 전환은 `transition-colors 150ms`.
- **Primary:** 솔리드 인디고(`bg-primary` #5b4be6) + 흰 텍스트. hover → `bg-primary-ink`(#3c3489). 화면당 주요 액션 1개 원칙.
- **Secondary:** 테두리 + 서피스(`border bg-surface text-ink`), hover `bg-hover` + `border-line-strong`. 기본값.
- **Ghost:** 텍스트만(`text-mut`), hover `bg-hover text-ink`. 보조·취소.
- **Danger:** 빨강 테두리+서피스(`border-danger-bg text-danger-text`), hover `bg-danger-bg`. 삭제/제거.
- **Disabled:** `opacity-50 cursor-not-allowed`.

### Cards / Containers
- **Corner:** 12px(`rounded-xl`).
- **Background:** 서피스(#ffffff) on 캔버스(#fafafa).
- **Border:** hairline(#ebebeb) 1px. (그림자 아님 — Elevation 참조.)
- **Padding:** 16–20px(`p-4`/`p-5`).
- **Hover(클릭 가능 시):** `-translate-y-px` + `bg-hover` + `shadow-sm`.

### Inputs / Fields
- **Style:** 테두리 + 서피스, 8px(`rounded-lg`), `px-3 py-2.5 text-sm`.
- **Hover:** `border-line-strong`.
- **Focus:** 전역 포커스 링 — `box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--color-primary)`(흰 갭 + 인디고 링).
- **Placeholder:** 본문과 같은 대비(연회색 placeholder 금지).

### Badges / Chips
- **Style:** 6px(`rounded-md`), `px-1.5 py-0.5 text-[11px] font-medium`.
- **역할 배지:** `bg-hover text-mut`(운영진/부원). **의미 배지:** 의미색 bg/text(진행중=ok, 충돌=danger 등).

### Navigation
- **AppHeader:** sticky top-0, `bg-surface/85 backdrop-blur`, hairline 하단 테두리. 로고 + 동아리명 + 역할 배지.
- **데스크탑(lg+):** 인라인 NavLinks — 활성 항목은 인디고 알약(`bg-primary-soft text-primary-ink`), 비활성 `text-mut`.
- **lg 미만:** 햄버거 → 좌측 슬라이드 드로어(`MobileNav`, `createPortal`로 body에 렌더해 backdrop-filter 컨테이닝 블록 탈출). 오버레이 `bg-ink/40`, 패널 `shadow-xl`.

### Signature — 시간 격자(TimeGrid / WeekGrid / MonthGrid)
읽기 전용 캘린더 격자. band 시간 [10,24), 모든 셀을 명시 grid 좌표로 배치해 예약 블록이 배경 위에 깔끔히 겹친다. 블록 색이 곧 의미: 합주=`primary-soft`, 회의=`meeting-bg`, 방 중복=`danger-bg`, 시간 겹침=`warn-bg`. 모바일에선 격자가 콘텐츠보다 넓으면 `min-w-0 overflow-x-auto` 박스 안에서 가로 스크롤(페이지 레이아웃을 깨지 않는다).

## 6. Do's and Don'ts

### Do:
- **Do** 분리는 hairline 테두리(#ebebeb)와 2층 중립(canvas/surface)으로. 그림자는 hover·오버레이에만.
- **Do** 인디고(#5b4be6)는 행동·활성·오늘에만. 화면당 작은 면적.
- **Do** 본문·라벨·시간 숫자 모두 ≥4.5:1(AA). 시간/득표 숫자는 `tabular-nums`.
- **Do** 색은 의미일 때만(가능/되면/방중복/회의). 캘린더가 상태를 색으로 말하게.
- **Do** 파괴적 동작엔 확인 모달(`ConfirmButton`), 권한 밖 동작은 숨김. 버튼 라벨은 동사+대상("표대로 확정").
- **Do** 폰트는 Geist 한 가족, 위계는 크기·굵기·색으로.

### Don't:
- **Don't** 의미 텍스트에 옅은 회색(#a3a3a3급) 사용 — "우아한 연회색"은 가독성 1순위 적.
- **Don't** 검정 1px 테두리·빽빽한 회색 그리드(= 무거운 엔터프라이즈 안티레퍼런스).
- **Don't** 그라데이션 텍스트·히어로 메트릭 템플릿·버즈워드·과장 모션(= 시끄러운 SaaS 마케팅 안티레퍼런스).
- **Don't** 카톡식 산만함 — 무한 스레드·재투표 루프·정리 안 된 화면. 알림·소집은 명확한 한 줄.
- **Don't** 인디고를 배경·장식으로 남발. 흔해지면 신호가 죽는다.
- **Don't** 두 번째 서체를 더하거나, em dash(—를 구분자로) 남용.
- **Don't** 장식용 그림자(`shadow-lg`를 카드 기본값으로) 사용.
