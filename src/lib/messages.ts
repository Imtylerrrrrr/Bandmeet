// 알림/소집 메시지 텍스트 빌더 (KST 시간 표기). 단톡·인앱 공용.

import { durationToHours, fmtSlotRange, instantToSlot } from '@/lib/matching/slots';

/** 확정 합주 시각을 'M/D(요일) HH:00–HH:00' 로(공용 fmtSlotRange 위임). */
export function fmtWhen(startAt: Date, durationMin: number): string {
  return fmtSlotRange(instantToSlot(startAt), durationToHours(durationMin));
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
