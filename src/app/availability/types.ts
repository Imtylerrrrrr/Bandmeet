export type Tier = 'green' | 'yellow';

/** 주간 템플릿 한 칸. weekday 0=일~6=토, hour 0~23. */
export interface Cell {
  weekday: number;
  hour: number;
  tier: Tier;
}
