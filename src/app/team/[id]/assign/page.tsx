import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq, inArray } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { db } from '@/lib/db';
import {
  memberships,
  profiles,
  songMembers,
  songs,
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { isTeamArchived } from '@/lib/archive';
import { toggleSongMember } from './actions';

export default async function AssignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const [team] = await db.select().from(teams).where(eq(teams.id, id));
  if (!team || team.orgId !== active.orgId) notFound();
  const archived = await isTeamArchived(id);
  const canEdit = isAdmin && !archived;

  // 팀원(이름) = org 멤버 ∩ 팀원.
  const orgMembers = await db
    .select({ userId: memberships.userId, name: profiles.name })
    .from(memberships)
    .innerJoin(profiles, eq(memberships.userId, profiles.id))
    .where(eq(memberships.orgId, active.orgId))
    .orderBy(asc(profiles.name));
  const teamMemberIds = new Set(
    (
      await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, id))
    ).map((r) => r.userId),
  );
  const members = orgMembers.filter((m) => teamMemberIds.has(m.userId));

  const songRows = await db
    .select({ id: songs.id, title: songs.title })
    .from(songs)
    .where(eq(songs.teamId, id))
    .orderBy(asc(songs.title));

  // 곡-사람 배치 집합.
  const songIds = songRows.map((s) => s.id);
  const assignedRows = songIds.length
    ? await db
        .select({ songId: songMembers.songId, userId: songMembers.userId })
        .from(songMembers)
        .where(inArray(songMembers.songId, songIds))
    : [];
  const assignedSet = new Set(assignedRows.map((r) => `${r.songId}:${r.userId}`));
  const countFor = (songId: string) =>
    assignedRows.filter((r) => r.songId === songId).length;

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div>
          <Link href={`/team/${team.id}`} className="text-xs text-gray-500 hover:underline">
            ← {team.name}
          </Link>
          <h1 className="mt-1 text-lg font-bold">곡-사람 배치</h1>
          <p className="text-xs text-gray-500">
            누가 어떤 곡을 맡는지 표시합니다. 이 배치가 합주 매칭의 &ldquo;사람 충돌&rdquo; 계산에 쓰입니다.
          </p>
        </div>

        {members.length === 0 || songRows.length === 0 ? (
          <p className="text-sm text-gray-500">
            {members.length === 0
              ? '먼저 팀원을 추가하세요.'
              : '먼저 곡을 추가하세요.'}{' '}
            <Link href={`/team/${team.id}`} className="text-blue-600 hover:underline">
              팀 페이지로
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left">곡 \ 사람</th>
                  {members.map((m) => (
                    <th key={m.userId} className="min-w-16 p-2 text-center font-medium">
                      {m.name}
                    </th>
                  ))}
                  <th className="p-2 text-center text-gray-400">인원</th>
                </tr>
              </thead>
              <tbody>
                {songRows.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 font-medium">
                      {s.title}
                    </td>
                    {members.map((m) => {
                      const on = assignedSet.has(`${s.id}:${m.userId}`);
                      return (
                        <td key={m.userId} className="p-1 text-center">
                          {canEdit ? (
                            <form action={toggleSongMember}>
                              <input type="hidden" name="songId" value={s.id} />
                              <input type="hidden" name="userId" value={m.userId} />
                              <input type="hidden" name="assigned" value={on ? '1' : '0'} />
                              <button
                                className={`h-7 w-7 rounded-full text-sm ${
                                  on
                                    ? 'bg-black text-white'
                                    : 'border text-gray-300 hover:bg-gray-100'
                                }`}
                                title={on ? '배정됨 (클릭=해제)' : '미배정 (클릭=배정)'}
                              >
                                {on ? '●' : '○'}
                              </button>
                            </form>
                          ) : (
                            <span className={on ? 'text-black' : 'text-gray-300'}>
                              {on ? '●' : '○'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-center text-gray-500">{countFor(s.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
