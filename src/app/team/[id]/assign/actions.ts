'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { songMembers, songs } from '@/lib/db/schema';
import { requireOrgAdmin } from '@/lib/org';
import { assertSongActive } from '@/lib/archive';

/** 곡-사람 배치 토글. assigned='1' 이면 해제, 아니면 배정. */
export async function toggleSongMember(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const assigned = String(formData.get('assigned') ?? '') === '1';

  const [s] = await db
    .select({ orgId: songs.orgId, teamId: songs.teamId })
    .from(songs)
    .where(eq(songs.id, songId));
  if (!s) throw new Error('곡을 찾을 수 없습니다.');
  await requireOrgAdmin(s.orgId);
  await assertSongActive(songId);

  if (assigned) {
    await db
      .delete(songMembers)
      .where(and(eq(songMembers.songId, songId), eq(songMembers.userId, userId)));
  } else {
    await db
      .insert(songMembers)
      .values({ songId, userId })
      .onConflictDoNothing();
  }
  revalidatePath(`/team/${s.teamId}/assign`);
}
