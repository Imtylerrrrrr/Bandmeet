import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
import { getActiveOrg } from '@/lib/org';

export default async function Home() {
  const ctx = await getActiveOrg();
  if (!ctx) redirect('/onboarding');
  const { active, all } = ctx;

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <section>
          <h1 className="text-lg font-bold">{active.orgName}</h1>
          <p className="text-sm text-gray-500">
            합주·회의 일정을 관리하세요.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Card href="/perf" title="공연" desc="공연·팀·곡·곡 배치" />
          <Card href="/members" title="멤버" desc="부원·초대코드·역할" />
          <Card href="/availability" title="가용성" desc="가능 시간 드래그 입력" />
          <Card href="/calendar" title="캘린더" desc="합주실 일정 (준비 중)" disabled />
        </section>
      </main>
    </>
  );
}

function Card({
  href,
  title,
  desc,
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-lg border p-4 ${
        disabled ? 'opacity-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-500">{desc}</div>
    </div>
  );
  return disabled ? inner : <Link href={href}>{inner}</Link>;
}
