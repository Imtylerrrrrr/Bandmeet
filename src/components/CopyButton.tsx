'use client';

import { useState } from 'react';

/** 텍스트를 클립보드에 복사하는 작은 버튼(소집 메시지 복붙용). */
export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* 클립보드 접근 불가 시 무시(수동 선택 복사) */
        }
      }}
      className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
    >
      {done ? '복사됨 ✓' : '복사'}
    </button>
  );
}
