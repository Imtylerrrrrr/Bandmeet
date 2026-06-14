// Bandmeet 로고 — public/logo.png (인디고 타일 + 블록 + 앰버 음표). size 로 한 변(px) 지정.

import Image from 'next/image';

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Bandmeet"
      width={size}
      height={size}
      className={className}
    />
  );
}
