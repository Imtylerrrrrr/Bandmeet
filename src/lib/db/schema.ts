import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  date,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';

// DB enum 식별자는 영문, UI 표시 라벨은 한국어로 매핑한다(기획서의 한글 값 = 표시용).
export const planEnum = pgEnum('plan', ['free', 'pro']);
export const roleEnum = pgEnum('role', ['admin', 'member']); // 운영진 / 부원
export const songStatusEnum = pgEnum('song_status', ['candidate', 'confirmed']); // 후보 / 확정
export const rehearsalStatusEnum = pgEnum('rehearsal_status', [
  'proposed', // 제안
  'voting', // 투표중
  'confirmed', // 확정 = 합주실 점유
  'conflict', // 충돌
]);
export const tierEnum = pgEnum('availability_tier', ['green', 'yellow']); // 가능 / 되면가능

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ── 테넌시 / 사용자 ──────────────────────────────────────────────
export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  plan: planEnum('plan').notNull().default('free'),
  // 부원이 가입할 때 입력하는 초대 코드(앱에서 생성, 동아리당 1개).
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: createdAt(),
});

// profiles.id = auth.users.id. auth.users 로의 FK 와 가입 트리거는 RLS 커스텀 마이그레이션에서.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

// ── 구조: 학기 → 공연 → 팀 → 곡 ──────────────────────────────────
export const semesters = pgTable('semesters', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const performances = pgTable('performances', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  semesterId: uuid('semester_id').references(() => semesters.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  performDate: date('perform_date'), // 공연 시작일(범위면 시작). 매칭 지평의 끝.
  performEndDate: date('perform_end_date'), // null = 하루 공연. 있으면 종료일(표시용).
  deadline: timestamp('deadline', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }), // null = 진행중
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  performanceId: uuid('performance_id')
    .notNull()
    .references(() => performances.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const songs = pgTable('songs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: songStatusEnum('status').notNull().default('candidate'),
});

// 곡-사람 다대다. 사람 충돌 계산의 핵심.
export const songMembers = pgTable(
  'song_members',
  {
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.songId, t.userId] })],
);

// ── 가용성 ───────────────────────────────────────────────────────
// 주간 반복 템플릿. weekday 0=일 ~ 6=토, hour 0~23.
export const availabilityTemplate = pgTable(
  'availability_template',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    hour: smallint('hour').notNull(),
    tier: tierEnum('tier').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId, t.weekday, t.hour] })],
);

// 날짜별 예외(덮어쓰기). tier = null 이면 그 시간 '불가'로 덮어씀.
export const availabilityException = pgTable(
  'availability_exception',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    hour: smallint('hour').notNull(),
    tier: tierEnum('tier'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId, t.date, t.hour] })],
);

// ── 합주 / 투표 / 회의 ───────────────────────────────────────────
// status='confirmed' = 합주실 점유. 한 org 내 confirmed 는 시간 겹치면 안 됨(방 1개).
export const rehearsals = pgTable('rehearsals', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  songId: uuid('song_id')
    .notNull()
    .references(() => songs.id, { onDelete: 'cascade' }),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').notNull(),
  status: rehearsalStatusEnum('status').notNull().default('proposed'),
  isExtra: boolean('is_extra').notNull().default(false), // 비정기(추가) 합주
});

export const rehearsalVotes = pgTable('rehearsal_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  rehearsalId: uuid('rehearsal_id')
    .notNull()
    .references(() => rehearsals.id, { onDelete: 'cascade' }),
  voteCloseAt: timestamp('vote_close_at', { withTimezone: true }).notNull(),
});

export const rehearsalVoteOptions = pgTable('rehearsal_vote_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  voteId: uuid('vote_id')
    .notNull()
    .references(() => rehearsalVotes.id, { onDelete: 'cascade' }),
  slotStart: timestamp('slot_start', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').notNull(),
});

// 랭크 투표(1·2·3순위). 한 사람이 한 옵션에 한 표.
export const rehearsalVoteBallots = pgTable(
  'rehearsal_vote_ballots',
  {
    optionId: uuid('option_id')
      .notNull()
      .references(() => rehearsalVoteOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rank: smallint('rank').notNull(),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.userId] })],
);

// 회의: 방 점유 없음(방 충돌 off), 사람 충돌만.
export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  title: text('title'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').notNull(),
});

// ── 알림 / 아웃박스 ──────────────────────────────────────────────
// 아웃바운드 알림 큐(멱등). 봇이 polling → 단톡 게시 후 ack → sent_at 표시(매뉴얼 §8-3).
export const outbox = pgTable('outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  // 같은 이벤트 중복 적재 방지(예: 'confirmed:<rehId>'). null 다수 허용(소집 등).
  dedupeKey: text('dedupe_key').unique(),
  sentAt: timestamp('sent_at', { withTimezone: true }), // null = 대기
  createdAt: createdAt(),
});

// 인앱 알림(수신자별).
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  link: text('link'), // 딥링크 (예: /match/<songId>)
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// 단톡방 ↔ org 바인딩 (사설 봇 멀티테넌트 라우팅). 운영진이 1회 설정(매뉴얼 §8-4).
// room_name = 봇이 보는 단톡방 이름. 전역 unique → 한 방은 한 org 에만.
export const chatBindings = pgTable('chat_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  roomName: text('room_name').notNull().unique(),
  createdAt: createdAt(),
});
