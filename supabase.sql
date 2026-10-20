-- Supabase SQL Editor에서 실행하세요. (여러 번 실행해도 안전)
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  time_seconds int not null check (time_seconds >= 0),
  mistakes int not null check (mistakes >= 0),
  hints int not null check (hints >= 0),
  score int not null check (score >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 1 and 300),
  created_at timestamptz not null default now()
);

-- 클리어 1회당 발급되는 일회용 토큰 (리뷰 작성 자격 증명)
alter table public.scores  add column if not exists play_token uuid;
alter table public.reviews add column if not exists play_token uuid;
create unique index if not exists scores_token_uq  on public.scores  (play_token) where play_token is not null;
create unique index if not exists reviews_token_uq on public.reviews (play_token) where play_token is not null;

create index if not exists scores_rank_idx on public.scores (difficulty, score desc);
create index if not exists reviews_created_idx on public.reviews (created_at desc);

alter table public.scores enable row level security;
alter table public.reviews enable row level security;

-- 토큰 컬럼은 누구도 읽을 수 없게 한다 (목록 조회 시 토큰 유출 방지)
revoke select on public.scores  from anon, authenticated;
revoke select on public.reviews from anon, authenticated;
grant select (id, nickname, difficulty, time_seconds, mistakes, hints, score, created_at) on public.scores  to anon, authenticated;
grant select (id, nickname, rating, comment, created_at) on public.reviews to anon, authenticated;

-- 토큰으로 클리어 기록 여부만 확인하는 함수
create or replace function public.has_played(t uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select t is not null and exists (select 1 from public.scores where play_token = t)
$$;
revoke all on function public.has_played(uuid) from public;
grant execute on function public.has_played(uuid) to anon, authenticated;

drop policy if exists "scores read"    on public.scores;
drop policy if exists "scores insert"  on public.scores;
drop policy if exists "reviews read"   on public.reviews;
drop policy if exists "reviews insert" on public.reviews;
create policy "scores read"    on public.scores  for select using (true);
create policy "scores insert"  on public.scores  for insert with check (play_token is not null);
create policy "reviews read"   on public.reviews for select using (true);
-- 게임을 클리어해 받은 토큰이 있어야만 리뷰 등록 가능 (토큰 1개당 리뷰 1개)
create policy "reviews insert" on public.reviews for insert with check (public.has_played(play_token));
