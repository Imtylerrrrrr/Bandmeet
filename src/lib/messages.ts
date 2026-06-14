// 알림/소집 메시지 텍스트 빌더 (KST 시간 표기). 단톡·인앱 공용.

import {
  durationToHours,
  instantToSlot,
  kstDateStr,
  kstWeekday,
} from '@/lib/matching/slots';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/** 확정 합주 시각을 'M/D(요일) HH:00–HH:00' 로. */
export function fmtWhen(startAt: Date, durationMin: number): string {
  const slot = instantToSlot(startAt);
  const date = kstDateStr(startAt);
  const [, m, d] = date.split('-').map(Number);
  const sh = ((slot % 24) + 24) % 24;
  const eh = sh + durationToHours(durationMin);
  return `${m}/${d}(${WD[kstWeekday(date)]}) ${sh}:00–${eh}:00`;
}

/** 단톡 게시용 — 합주 확정. */
export function outboxConfirmed(songTitle: string, startAt: Date, durationMin: number): string {
  return `🎸 [합주 확정] ${songTitle}\n${fmtWhen(startAt, durationMin)} · 합주실`;
}

/** 단톡 게시용 — 투표 마감했으나 빈 슬롯 없음(재투표 필요). */
export function outboxConflict(songTitle: string): string {
  return `⚠️ [재투표 필요] ${songTitle}\n투표가 마감됐지만 빈 시간이 없어요. 다시 정해야 해요.`;
}

/** 단톡 게시용 — 소집(운영진이 보냄). link 는 절대 URL 권장. */
export function outboxSummon(songTitle: string, startAt: Date, durationMin: number, link: string): string {
  return `📣 [소집] ${songTitle} 합주\n${fmtWhen(startAt, durationMin)} · 합주실\n${link}`;
}

/** 인앱 알림 — 합주 확정. */
export function notifyConfirmed(songTitle: string, startAt: Date, durationMin: number): string {
  return `'${songTitle}' 합주가 ${fmtWhen(startAt, durationMin)} 로 확정됐어요.`;
}

/** 인앱 알림 — 재투표 필요. */
export function notifyConflict(songTitle: string): string {
  return `'${songTitle}' 합주 투표가 마감됐지만 빈 시간이 없어요. 재투표가 필요해요.`;
}
