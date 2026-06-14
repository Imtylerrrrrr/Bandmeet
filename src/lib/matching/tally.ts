// 투표 집계 + 빈 슬롯 선택 (순수, 의존성 없음).
//
// 마감된 랭크 투표를 집계해 옵션을 사전식 순위로 정렬하고,
// 그 순위대로 "방·사람 점유와 안 겹치는" 첫 옵션(= 최상위 빈 슬롯)을 고른다.
// "1순위(옵션) 먹혔으면 2순위로" (빌드매뉴얼 §6) = pickWinner 의 빈 슬롯 캐스케이드.
//
// 시간 모델은 엔진과 동일한 정수 hour-slot. window [s, s+L) half-open.

export interface TallyOption {
  id: string;
  start: number; // KST hour-slot
  duration: number; // 시간(durationToHours 로 올림된 점유 길이)
}

export interface TallyBallot {
  optionId: string;
  rank: number; // 1 | 2 | 3 (그 외는 무효표로 무시)
}

export interface TalliedOption extends TallyOption {
  score: number; // Borda 합계
  first: number; // 1순위 표 수
  second: number; // 2순위 표 수
  third: number; // 3순위 표 수
}

// 랭크 가중치: 1순위=3, 2순위=2, 3순위=1.
const RANK_WEIGHT: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

/**
 * 사전식 비교. 음수면 a 가 앞(우선).
 *  1. score 내림차순 (Borda 점수 높은 옵션 우선)
 *  2. first 내림차순 (동점이면 1순위 표 많은 쪽)
 *  3. start 오름차순 (이른 슬롯 우선)
 *  4. duration 내림차순 (긴 합주 우선)
 *  5. id 사전순 (완전 결정성)
 */
function compareTallied(a: TalliedOption, b: TalliedOption): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.first !== b.first) return b.first - a.first;
  if (a.start !== b.start) return a.start - b.start;
  if (a.duration !== b.duration) return b.duration - a.duration;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 랭크 투표 집계 → 사전식 정렬된 옵션 목록(최상위가 [0]).
 * 이 투표에 속하지 않는 optionId 의 표, rank 가 1·2·3 아닌 표는 무시한다.
 * 한 사람이 한 옵션에 한 표(스키마 PK)라 중복은 없지만, 중복이 와도 그대로 합산(방어).
 */
export function tallyVotes(
  options: TallyOption[],
  ballots: TallyBallot[],
): TalliedOption[] {
  const byId = new Map<string, TalliedOption>();
  for (const o of options) {
    byId.set(o.id, { ...o, score: 0, first: 0, second: 0, third: 0 });
  }
  for (const b of ballots) {
    const t = byId.get(b.optionId);
    if (!t) continue; // 이 투표의 옵션 아님
    const w = RANK_WEIGHT[b.rank];
    if (w === undefined) continue; // 1·2·3 외 무효표
    t.score += w;
    if (b.rank === 1) t.first++;
    else if (b.rank === 2) t.second++;
    else t.third++;
  }
  return [...byId.values()].sort(compareTallied);
}

export interface Interval {
  start: number;
  end: number;
}

/** [start, end) 가 occupied 구간 어느 것과도 안 겹치면 true. half-open 교차 판정. */
export function isFree(
  start: number,
  end: number,
  occupied: Interval[],
): boolean {
  for (const iv of occupied) {
    if (start < iv.end && iv.start < end) return false;
  }
  return true;
}

/**
 * 집계 상위부터 훑어 빈 슬롯(occupied 와 안 겹치는)인 첫 옵션을 반환.
 * 모든 옵션이 점유돼 있으면 null (→ 호출측에서 '충돌' 처리).
 */
export function pickWinner(
  tallied: TalliedOption[],
  occupied: Interval[],
): TalliedOption | null {
  for (const o of tallied) {
    if (isFree(o.start, o.start + o.duration, occupied)) return o;
  }
  return null;
}
