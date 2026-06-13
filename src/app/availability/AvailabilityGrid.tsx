'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { saveTemplate } from './actions';
import type { Cell, Tier } from './types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const START_HOUR = 10;
const END_HOUR = 24; // 미포함 — 10:00~23:00 시작 슬롯
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

type Brush = Tier | 'erase';
const slotKey = (w: number, h: number) => `${w}-${h}`;

const TIER_BG: Record<Tier, string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-300',
};

export function AvailabilityGrid({
  orgId,
  initial,
}: {
  orgId: string;
  initial: Cell[];
}) {
  const [cells, setCells] = useState<Record<string, Tier>>(() => {
    const o: Record<string, Tier> = {};
    for (const c of initial) o[slotKey(c.weekday, c.hour)] = c.tier;
    return o;
  });
  const [brush, setBrush] = useState<Brush>('green');
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const painting = useRef(false);
  const [pending, startTransition] = useTransition();

  // 격자 밖에서 손/마우스를 떼도 칠하기 종료.
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

  const paint = (w: number, h: number) => {
    setCells((prev) => {
      const k = slotKey(w, h);
      const next = { ...prev };
      if (brush === 'erase') delete next[k];
      else next[k] = brush;
      return next;
    });
    setDirty(true);
    setSavedMsg(null);
  };

  const save = () => {
    const payload: Cell[] = Object.entries(cells).map(([k, tier]) => {
      const [w, h] = k.split('-').map(Number);
      return { weekday: w, hour: h, tier };
    });
    startTransition(async () => {
      const res = await saveTemplate(orgId, payload);
      setDirty(false);
      setSavedMsg(`저장됨 (${res.saved}칸)`);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 브러시 + 저장 */}
      <div className="flex flex-wrap items-center gap-2">
        <BrushButton label="🟢 가능" active={brush === 'green'} onClick={() => setBrush('green')} />
        <BrushButton label="🟡 되면" active={brush === 'yellow'} onClick={() => setBrush('yellow')} />
        <BrushButton label="⨯ 지우기" active={brush === 'erase'} onClick={() => setBrush('erase')} />
        <div className="ml-auto flex items-center gap-3">
          {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
          {dirty && !savedMsg && (
            <span className="text-xs text-gray-400">저장 안 됨</span>
          )}
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {/* 격자 */}
      <div className="overflow-x-auto">
        <div
          className="inline-grid select-none"
          style={{
            gridTemplateColumns: `3rem repeat(7, minmax(2.5rem, 1fr))`,
            touchAction: 'none',
          }}
        >
          {/* 헤더 */}
          <div />
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`pb-1 text-center text-xs font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              {d}
            </div>
          ))}

          {/* 시간 행 */}
          {HOURS.map((h) => (
            <FragmentRow key={h} hour={h}>
              {WEEKDAYS.map((_, w) => {
                const tier = cells[slotKey(w, h)];
                return (
                  <div
                    key={w}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      painting.current = true;
                      paint(w, h);
                    }}
                    onPointerEnter={() => {
                      if (painting.current) paint(w, h);
                    }}
                    className={`h-7 cursor-pointer border border-gray-100 ${
                      tier ? TIER_BG[tier] : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  />
                );
              })}
            </FragmentRow>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        칸을 드래그해 칠하세요. 매주 반복되는 기본 가용성입니다 (10:00–24:00).
      </p>
    </div>
  );
}

function FragmentRow({
  hour,
  children,
}: {
  hour: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex h-7 items-center justify-end pr-2 text-xs text-gray-400">
        {String(hour).padStart(2, '0')}
      </div>
      {children}
    </>
  );
}

function BrushButton({
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
      className={`rounded-full border px-3 py-1 text-sm ${
        active ? 'border-black bg-black text-white' : 'hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
