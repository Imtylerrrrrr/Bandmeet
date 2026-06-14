'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { IconCheck } from '@tabler/icons-react';

import { saveException } from './actions';
import type { Cell, ExcTier, ExceptionCell } from './types';

const START_HOUR = 10;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Brush = 'green' | 'yellow' | 'block' | 'clear';

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}

function weekdayOf(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function ExceptionEditor({
  orgId,
  template,
  initial,
}: {
  orgId: string;
  template: Cell[];
  initial: ExceptionCell[];
}) {
  // 템플릿 baseline 조회용: weekday -> hour -> tier
  const tmpl = useMemo(() => {
    const o: Record<number, Record<number, 'green' | 'yellow'>> = {};
    for (const c of template) (o[c.weekday] ??= {})[c.hour] = c.tier;
    return o;
  }, [template]);

  // 날짜별 예외: date -> hour -> ExcTier. 키가 있으면 예외 존재(null=불가).
  const [excByDate, setExcByDate] = useState<Record<string, Record<number, ExcTier>>>(
    () => {
      const o: Record<string, Record<number, ExcTier>> = {};
      for (const e of initial) (o[e.date] ??= {})[e.hour] = e.tier;
      return o;
    },
  );
  const [date, setDate] = useState(todayStr());
  const [brush, setBrush] = useState<Brush>('block');
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const painting = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  const paint = (hour: number) => {
    setExcByDate((prev) => {
      const day = { ...(prev[date] ?? {}) };
      if (brush === 'clear') delete day[hour];
      else if (brush === 'block') day[hour] = null;
      else day[hour] = brush;
      return { ...prev, [date]: day };
    });
    setDirty((prev) => new Set(prev).add(date));
    setSavedMsg(null);
  };

  const save = () => {
    const day = excByDate[date] ?? {};
    const cells = Object.entries(day).map(([h, tier]) => ({
      hour: Number(h),
      tier,
    }));
    startTransition(async () => {
      const res = await saveException(orgId, date, cells);
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(date);
        return next;
      });
      setSavedMsg(`${date} 저장됨 (예외 ${res.saved}칸)`);
    });
  };

  const day = excByDate[date] ?? {};
  const wd = weekdayOf(date);
  const isDirty = dirty.has(date);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value || todayStr());
            setSavedMsg(null);
          }}
          className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular-nums transition-colors duration-150 hover:border-line-strong sm:w-auto"
        />
        <span className="text-sm text-mut">{WEEKDAYS[wd]}요일</span>
        <div className="ml-auto flex items-center gap-3">
          {savedMsg && (
            <span className="flex items-center gap-1 text-xs font-medium text-ok-text">
              <IconCheck size={14} stroke={2} /> {savedMsg}
            </span>
          )}
          {isDirty && !savedMsg && <span className="text-xs text-faint">저장 안 됨</span>}
          <button
            onClick={save}
            disabled={!isDirty || pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '이 날짜 저장'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <BrushBtn label="🟢 가능" active={brush === 'green'} onClick={() => setBrush('green')} />
        <BrushBtn label="🟡 되면" active={brush === 'yellow'} onClick={() => setBrush('yellow')} />
        <BrushBtn label="🚫 불가" active={brush === 'block'} onClick={() => setBrush('block')} />
        <BrushBtn label="↩️ 템플릿" active={brush === 'clear'} onClick={() => setBrush('clear')} />
      </div>

      <div className="max-w-sm select-none" style={{ touchAction: 'none' }}>
        {HOURS.map((h) => {
          const has = h in day;
          const exc = day[h];
          const base = tmpl[wd]?.[h];
          return (
            <div
              key={h}
              onPointerDown={(e) => {
                e.preventDefault();
                painting.current = true;
                paint(h);
              }}
              onPointerEnter={() => {
                if (painting.current) paint(h);
              }}
              className="flex cursor-pointer items-center gap-2 border-b"
            >
              <span className="w-10 py-1.5 text-right text-xs tabular-nums text-faint">
                {String(h).padStart(2, '0')}
              </span>
              <CellBody has={has} exc={exc} base={base} />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-mut">
        그 날짜만 템플릿을 덮어씁니다. 🚫불가 = 그 시간 불가로 고정, ↩️템플릿 = 예외 지우고
        주간 반복값 따름.
      </p>
    </div>
  );
}

function CellBody({
  has,
  exc,
  base,
}: {
  has: boolean;
  exc: ExcTier | undefined;
  base: 'green' | 'yellow' | undefined;
}) {
  if (has) {
    if (exc === 'green') return <Bar className="bg-ok-paint text-ok-text">가능</Bar>;
    if (exc === 'yellow') return <Bar className="bg-warn-paint text-warn-text">되면</Bar>;
    return <Bar className="bg-danger-bg text-danger-text">불가 ✕</Bar>; // exc === null
  }
  // 예외 없음 → 템플릿 baseline (흐리게)
  if (base === 'green') return <Bar className="bg-ok-bg text-ok-text">가능 · 템플릿</Bar>;
  if (base === 'yellow') return <Bar className="bg-warn-bg text-warn-text">되면 · 템플릿</Bar>;
  return <Bar className="bg-hover text-faint">— · 템플릿</Bar>;
}

function Bar({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`my-0.5 flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function BrushBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
        active ? 'border-ink bg-ink text-white' : 'text-mut hover:bg-hover hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}
