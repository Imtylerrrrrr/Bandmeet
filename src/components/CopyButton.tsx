'use client';

import { useState } from 'react';
import { IconCopy, IconCheck } from '@tabler/icons-react';

/** 텍스트를 클립보드에 복사하는 작은 버튼(소집 메시지·초대코드 복붙용). */
export function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
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
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors duration-150 ${
        done
          ? 'border-transparent bg-ok-bg text-ok-text'
          : 'text-mut hover:bg-hover hover:text-ink'
      }`}
    >
      {done ? <IconCheck size={14} stroke={2} /> : <IconCopy size={14} stroke={1.5} />}
      {done ? '복사됨' : label}
    </button>
  );
}
