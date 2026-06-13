-- Custom SQL migration file, put your code below! --

-- ============================================================================
-- RLS + Supabase Auth 연동 (커스텀 마이그레이션)
--   · profiles ↔ auth.users FK + 가입 시 자동 profile 생성 트리거
--   · 멤버십 기반 멀티테넌트 격리(org 스코프) = RLS 백스톱
--   · 역할(운영진/부원) 세부 가드는 앱 레이어가 담당 (매뉴얼 §4)
-- 주의: Drizzle 은 테이블 소유자(postgres)로 접속 → RLS 자동 우회.
--       이 정책은 Supabase anon/authenticated 클라이언트 경로를 보호한다.
-- ============================================================================

-- ── 1. profiles ↔ auth.users ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_auth_users_fk
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- 신규 가입 시 profiles 자동 생성 (카카오 메타데이터에서 이름 추출)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'nickname',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. 멤버십 헬퍼 (SECURITY DEFINER → 정책 내 memberships 재귀 RLS 회피) ───────
CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = p_org AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = p_org AND m.user_id = auth.uid() AND m.role = 'admin'
  );
$$;

-- ── 3. RLS 활성화 (전 테이블) ────────────────────────────────────────────────
ALTER TABLE public.orgs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performances            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_template   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exception  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_vote_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_vote_ballots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings                ENABLE ROW LEVEL SECURITY;

-- ── 4. 정책 ──────────────────────────────────────────────────────────────────
-- orgs: 멤버 읽기 / 인증유저 생성(부트스트랩) / 운영진 수정·삭제
CREATE POLICY orgs_select ON public.orgs FOR SELECT TO authenticated
  USING (public.is_org_member(id));
CREATE POLICY orgs_insert ON public.orgs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY orgs_update ON public.orgs FOR UPDATE TO authenticated
  USING (public.is_org_admin(id)) WITH CHECK (public.is_org_admin(id));
CREATE POLICY orgs_delete ON public.orgs FOR DELETE TO authenticated
  USING (public.is_org_admin(id));

-- profiles: 본인 + 같은 org 공유자 읽기 / 본인만 수정
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships me
      JOIN public.memberships other ON other.org_id = me.org_id
      WHERE me.user_id = auth.uid() AND other.user_id = public.profiles.id
    )
  );
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- memberships: 멤버 읽기 / 운영진 관리
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY memberships_admin ON public.memberships FOR ALL TO authenticated
  USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

-- org_id 직접 보유 테이블: 멤버 전체 접근 (역할 가드는 앱 레이어)
CREATE POLICY semesters_member ON public.semesters FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY performances_member ON public.performances FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY teams_member ON public.teams FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY songs_member ON public.songs FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY rehearsals_member ON public.rehearsals FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY meetings_member ON public.meetings FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- 가용성: 본인 데이터만 (같은 org 한정)
CREATE POLICY availability_template_own ON public.availability_template FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY availability_exception_own ON public.availability_exception FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

-- 조인 테이블: org_id 를 상위 테이블에서 해석
CREATE POLICY team_members_member ON public.team_members FOR ALL TO authenticated
  USING (public.is_org_member(
    (SELECT t.org_id FROM public.teams t WHERE t.id = team_members.team_id)))
  WITH CHECK (public.is_org_member(
    (SELECT t.org_id FROM public.teams t WHERE t.id = team_members.team_id)));

CREATE POLICY song_members_member ON public.song_members FOR ALL TO authenticated
  USING (public.is_org_member(
    (SELECT s.org_id FROM public.songs s WHERE s.id = song_members.song_id)))
  WITH CHECK (public.is_org_member(
    (SELECT s.org_id FROM public.songs s WHERE s.id = song_members.song_id)));

CREATE POLICY rehearsal_votes_member ON public.rehearsal_votes FOR ALL TO authenticated
  USING (public.is_org_member(
    (SELECT r.org_id FROM public.rehearsals r WHERE r.id = rehearsal_votes.rehearsal_id)))
  WITH CHECK (public.is_org_member(
    (SELECT r.org_id FROM public.rehearsals r WHERE r.id = rehearsal_votes.rehearsal_id)));

CREATE POLICY rehearsal_vote_options_member ON public.rehearsal_vote_options FOR ALL TO authenticated
  USING (public.is_org_member((
    SELECT r.org_id FROM public.rehearsals r
    JOIN public.rehearsal_votes v ON v.rehearsal_id = r.id
    WHERE v.id = rehearsal_vote_options.vote_id)))
  WITH CHECK (public.is_org_member((
    SELECT r.org_id FROM public.rehearsals r
    JOIN public.rehearsal_votes v ON v.rehearsal_id = r.id
    WHERE v.id = rehearsal_vote_options.vote_id)));

-- 투표용지: org 멤버는 읽기 / 본인 표만 작성
CREATE POLICY ballots_select ON public.rehearsal_vote_ballots FOR SELECT TO authenticated
  USING (public.is_org_member((
    SELECT r.org_id FROM public.rehearsals r
    JOIN public.rehearsal_votes v ON v.rehearsal_id = r.id
    JOIN public.rehearsal_vote_options o ON o.vote_id = v.id
    WHERE o.id = rehearsal_vote_ballots.option_id)));
CREATE POLICY ballots_write_own ON public.rehearsal_vote_ballots FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_org_member((
    SELECT r.org_id FROM public.rehearsals r
    JOIN public.rehearsal_votes v ON v.rehearsal_id = r.id
    JOIN public.rehearsal_vote_options o ON o.vote_id = v.id
    WHERE o.id = rehearsal_vote_ballots.option_id)));