'use client';

import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button';

type Props = ComponentProps<typeof Button> & { message?: string };

/**
 * 제출 버튼 + 확인 모달. 누르면 앱 디자인 모달이 뜨고, '취소'면 아무 일도 안 일어나며
 * 확인하면 부모 폼(서버 액션)을 제출한다. 파괴적 동작(삭제/제거/탈퇴)용.
 * 모달 확인 버튼 라벨 = 트리거와 동일(children).
 */
export function ConfirmButton({
  message = '정말 삭제하시겠습니까?',
  children,
  variant,
  size,
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const confirm = () => {
    const form = formRef.current;
    setOpen(false);
    // 서버 액션이 리다이렉트하면 effect cleanup이 못 돌 수 있어 직접 복원(스크롤락 누수 방지).
    document.body.style.overflow = '';
    form?.requestSubmit();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        {...rest}
        type="button"
        onClick={(e) => {
          formRef.current = e.currentTarget.form;
          setOpen(true);
        }}
      >
        {children}
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-ink/40"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full max-w-sm rounded-xl border bg-surface p-5 shadow-xl">
              <p className="text-sm leading-relaxed text-ink">{message}</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  취소
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={confirm}>
                  {children}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
