'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { songMembers, songs, teamMembers, teams } from '@/lib/db/schema';
import { requireOrgAdmin } from '@/lib/org';
import { assertSongActive, assertTeamActive } from '@/lib/archive';

async function teamOrg(teamId: string) {
  const [t] = await db
    .select({ orgId: teams.orgId })
    .from(teams)
    .where(eq(teams.id, teamId));
  if (!t) throw new Error('팀을 찾을 수 없습니다.');
  return t.orgId;
}

async function songTeam(songId: string) {
  const [s] = await db
    .select({ orgId: songs.orgId, teamId: songs.teamId })
    .from(songs)
    .where(eq(songs.id, songId));
  if (!s) throw new Error('곡을 찾을 수 없습니다.');
  return s;
}

// ── 팀원 ──────────────────────────────────────────────
export async function addTeamMember(formData: FormData) {
  const teamId = String(formData.get('teamId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return;
  const orgId = await teamOrg(teamId);
  await requireOrgAdmin(orgId);
  await assertTeamActive(teamId);

  await db.insert(teamMembers).values({ teamId, userId }).onConflictDoNothing();
  revalidatePath(`/team/${teamId}`);
}

export async function removeTeamMember(formData: FormData) {
  const teamId = String(formData.get('teamId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const orgId = await teamOrg(teamId);
  await requireOrgAdmin(orgId);
  await assertTeamActive(teamId);

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  // 팀에서 빠지면 이 팀 곡들의 곡-사람 배치에서도 제거(고아 배치 방지).
  await db.delete(songMembers).where(
    and(
      eq(songMembers.userId, userId),
      inArray(
        songMembers.songId,
        db.select({ id: songs.id }).from(songs).where(eq(songs.teamId, teamId)),
      ),
    ),
  );
  revalidatePath(`/team/${teamId}`);
}

// ── 곡 ────────────────────────────────────────────────
export async function createSong(formData: FormData) {
  const teamId = String(formData.get('teamId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('곡 제목을 입력하세요.');
  const orgId = await teamOrg(teamId);
  await requireOrgAdmin(orgId);
  await assertTeamActive(teamId);

  await db.insert(songs).values({ orgId, teamId, title });
  revalidatePath(`/team/${teamId}`);
}

export async function setSongStatus(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (status !== 'candidate' && status !== 'confirmed') {
    throw new Error('잘못된 상태입니다.');
  }
  const s = await songTeam(songId);
  await requireOrgAdmin(s.orgId);
  await assertSongActive(songId);

  await db.update(songs).set({ status }).where(eq(songs.id, songId));
  revalidatePath(`/team/${s.teamId}`);
}

export async function deleteSong(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const s = await songTeam(songId);
  await requireOrgAdmin(s.orgId);
  await assertSongActive(songId);

  await db.delete(songs).where(eq(songs.id, songId));
  revalidatePath(`/team/${s.teamId}`);
}
