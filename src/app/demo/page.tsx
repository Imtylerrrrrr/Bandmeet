import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import {
  IconMicrophone2,
  IconCalendarMonth,
  IconClock,
  IconChecks,
} from '@tabler/icons-react';

import { Logo } from '@/components/Logo';
import { Button, ButtonLink } from '@/components/Button';
import { WeekGrid } from '@/components/WeekGrid';
import { perfDateLabel } from '@/lib/perf';
import { detectConflicts, type Booking } from '@/lib/calendar/conflicts';
import {
  addDays,
  dateHourToSlot,
  kstDateStr,
  kstWeekday,
} from '@/lib/matching/slots';

export const metadata = {
  title: 'Bandmeet 미리보기 — 데모',
  description:
    '밴드 동아리 합주·회의 일정 자동 매칭. 로그인 없이 둘러보는 예시 화면입니다.',
};

// 항상 '현재 주'를 보여주도록 매 요청 렌더(빌드 시점 날짜 고정 방지).
export const dynamic = 'force-dynamic';

// 공개 데모(로그인 불필요). 실제 컴포넌트 + 예시 데이터로 화면을 보여준다.
export default function DemoPage() {
  const today = kstDateStr(new Date());
  const weekStart = addDays(today, -kstWeekday(today)); // 이번 주 일요일
  const day = (i: number) => addDays(weekStart, i);
  const at = (i: number, h: number) => dateHourToSlot(day(i), h);

  // 예시 합주실 일정(이번 주). 금요일 같은 시간 두 합주 → 방 중복(빨강) 시연.
  const bookings: Booking[] = [
    { id: 'r1', type: 'rehearsal', start: at(2, 14), end: at(2, 16), title: '날개밴드 · 밤편지', members: [] },
    { id: 'r2', type: 'rehearsal', start: at(3, 19), end: at(3, 21), title: '소울메이트 · Through the Night', members: [] },
    { id: 'm1', type: 'meeting', start: at(4, 18), end: at(4, 19), title: '운영 회의', members: [] },
    { id: 'r3', type: 'rehearsal', start: at(5, 15), end: at(5, 17), title: '재즈콤보 · Autumn Leaves', members: [] },
    { id: 'r4', type: 'rehearsal', start: at(5, 16), end: at(5, 18), title: '어쿠스틱 · 너의 의미', members: [] },
  ];
  const report = detectConflicts(bookings);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="text-[15px] font-semibold tracking-tight">Bandmeet</span>
            <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary-ink">
              데모
            </span>
          </Link>
          <ButtonLink href="/login" variant="primary" size="sm">
            시작하기
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-10 px-4 py-10 sm:px-6">
        {/* 히어로 */}
        <section className="flex flex-col items-start gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              카톡 재투표 지옥 없이,<br />합주 일정이 자동으로 잡혀요
            </h1>
            <p className="max-w-xl text-mut">
              되는 시간을 칠해두면 담당자 전원이 가능한 시간을 추천하고, 랭크 투표 →
              마감 자동확정 → 합주실 캘린더까지. 아래는 <b className="font-medium text-ink">예시
              데이터로 보여주는 실제 화면</b>이에요 (로그인 없이 미리보기).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/login" variant="primary">
              카카오로 시작하기
            </ButtonLink>
            <span className="text-xs text-faint">
              운영진 가입 → 부원 초대코드 배포 → 끝
            </span>
          </div>
        </section>

        {/* 공연(날짜 범위) */}
        <Section
          icon={<IconMicrophone2 size={18} stroke={1.5} />}
          title="공연"
          desc="공연마다 팀·곡을 묶어 관리해요. 날짜는 하루도, 며칠 범위도 됩니다."
        >
          <ul className="flex flex-col gap-2">
            {[
              { name: '2026 봄 정기공연', start: '2026-05-23', end: null },
              { name: '신입생 환영 버스킹', start: '2026-04-04', end: '2026-04-05' },
              { name: '여름 워크숍 합주회', start: '2026-07-18', end: '2026-07-20' },
            ].map((p) => (
              <li
                key={p.name}
                className="flex items-center justify-between gap-3 rounded-xl border bg-surface p-4"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-mut">
                    {perfDateLabel(p.start, p.end)}
                  </div>
                </div>
                <span className="rounded-md bg-ok-bg px-1.5 py-0.5 text-xs font-medium text-ok-text">
                  진행중
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 합주실 캘린더(주간) */}
        <Section
          icon={<IconCalendarMonth size={18} stroke={1.5} />}
          title="합주실 캘린더"
          desc="확정된 합주·회의가 한 칸에 모여요. 같은 시간에 두 합주가 잡히면 빨갛게 경고합니다."
        >
          <div className="rounded-xl border bg-surface p-3">
            <WeekGrid weekStart={weekStart} bookings={bookings} report={report} todayStr={today} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-mut">
              <Legend className="bg-primary-soft">확정 합주</Legend>
              <Legend className="bg-meeting-bg">회의</Legend>
              <Legend className="bg-danger-bg">방 중복(경고)</Legend>
            </div>
          </div>
        </Section>

        {/* 매칭 · 투표/확정 */}
        <Section
          icon={<IconChecks size={18} stroke={1.5} />}
          title="합주 매칭 · 투표"
          desc="추천 시간으로 랭크 투표를 열고, 마감되면 자동 확정돼요. 운영진은 마감 전이라도 원하는 시간으로 바로 확정할 수 있습니다."
        >
          <div className="flex flex-col gap-3 rounded-xl border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">밤편지 — 투표 중</span>
              <Button variant="primary" size="sm" disabled title="데모: 비활성">
                표대로 확정
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                { label: '화 14:00–16:00', t: '1순위 4 · 2순위 1 · 3순위 0' },
                { label: '목 19:00–21:00', t: '1순위 2 · 2순위 3 · 3순위 1' },
                { label: '토 15:00–17:00', t: '1순위 1 · 2순위 2 · 3순위 3' },
              ].map((o) => (
                <li
                  key={o.label}
                  className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
                >
                  <span className="font-medium tabular-nums">{o.label}</span>
                  <span className="text-xs text-faint">{o.t}</span>
                  <div className="ml-auto">
                    <Button variant="secondary" size="sm" disabled title="데모: 비활성">
                      이 시간으로 확정
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-faint">
              데모라 버튼은 비활성이에요. 실제로는 운영진이 한 번에 확정합니다.
            </p>
          </div>
        </Section>

        {/* 되는 시간(가용성) */}
        <Section
          icon={<IconClock size={18} stroke={1.5} />}
          title="되는 시간"
          desc="부원은 되는 시간을 칠하기만 하면 끝. 🟢 가능 · 🟡 되면 가능 — 이걸로 합주가 자동 매칭돼요."
        >
          <div className="rounded-xl border bg-surface p-4">
            <DemoAvailability />
          </div>
        </Section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-3 rounded-2xl border bg-surface px-6 py-10 text-center">
          <Logo size={40} />
          <h2 className="text-xl font-semibold tracking-tight">우리 동아리도 시작하기</h2>
          <p className="max-w-md text-sm text-mut">
            운영진이 카카오로 가입하고 동아리를 만들면, 부원은 초대코드로 들어와 되는 시간만
            칠하면 됩니다.
          </p>
          <ButtonLink href="/login" variant="primary">
            카카오로 시작하기
          </ButtonLink>
        </section>

        <p className="pb-6 text-center text-xs text-faint">
          예시 데이터로 보여주는 미리보기입니다. 실제 데이터는 동아리별로 따로 안전하게
          관리돼요.
        </p>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        <p className="text-sm text-mut">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function Legend({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${className}`} />
      {children}
    </span>
  );
}

// 정적 가용성 격자(데모용, 저장 없음). 🟢 가능 · 🟡 되면 · 회색 = 빈 칸.
function DemoAvailability() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const hours = [13, 14, 15, 16, 17, 18, 19];
  const green = new Set(['1-18', '1-19', '2-14', '2-15', '2-16', '6-13', '6-14']);
  const yellow = new Set(['4-17', '4-18', '5-16']);

  return (
    <div className="min-w-0 overflow-x-auto">
      <div
        className="inline-grid gap-[3px]"
        style={{ gridTemplateColumns: '2rem repeat(7, minmax(2rem, 1fr))' }}
      >
        <div />
        {days.map((d, i) => (
          <div
            key={d}
            className={`pb-1 text-center text-xs font-medium ${
              i === 0 ? 'text-danger-text/70' : i === 6 ? 'text-primary' : 'text-mut'
            }`}
          >
            {d}
          </div>
        ))}
        {hours.map((h) => (
          <Fragment key={h}>
            <div className="flex h-7 items-center justify-end pr-1.5 text-[10px] tabular-nums text-faint">
              {h}
            </div>
            {days.map((_, w) => {
              const k = `${w}-${h}`;
              const cls = green.has(k)
                ? 'bg-ok-paint'
                : yellow.has(k)
                  ? 'bg-warn-paint'
                  : 'bg-line-strong';
              return <div key={w} className={`h-7 rounded-md ${cls}`} />;
            })}
          </Fragment>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap gap-3 text-xs text-mut">
        <Legend className="bg-ok-paint">가능</Legend>
        <Legend className="bg-warn-paint">되면 가능</Legend>
        <Legend className="bg-line-strong">빈 칸</Legend>
      </p>
    </div>
  );
}
