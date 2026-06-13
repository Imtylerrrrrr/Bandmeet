export type Tier = 'green' | 'yellow';

/** 주간 템플릿 한 칸. weekday 0=일~6=토, hour 0~23. */
export interface Cell {
  weekday: number;
  hour: number;
  tier: Tier;
}

/** 예외 tier. null = 그날 그 시간 '불가'(템플릿 덮어쓰기). */
export type ExcTier = Tier | null;

/** 날짜별 예외 한 칸. date = 'YYYY-MM-DD'. */
export interface ExceptionCell {
  date: string;
  hour: number;
  tier: ExcTier;
}
