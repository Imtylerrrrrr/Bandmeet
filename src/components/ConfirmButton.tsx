'use client';

import type { ComponentProps } from 'react';

import { Button } from './Button';

type Props = ComponentProps<typeof Button> & { message?: string };

/**
 * 제출 버튼 + 확인창. 누르면 confirm(message)을 띄우고,
 * 사용자가 취소하면 폼 제출(서버 액션)을 막는다. 파괴적 동작(삭제/제거/탈퇴)용.
 */
export function ConfirmButton({
  message = '정말 삭제하시겠습니까?',
  children,
  ...rest
}: Props) {
  return (
    <Button
      type="submit"
      {...rest}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
