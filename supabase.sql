-- Supabase SQL Editor에서 실행하세요.
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

create index if not exists scores_rank_idx on public.scores (difficulty, score desc);
create index if not exists reviews_created_idx on public.reviews (created_at desc);

alter table public.scores enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "scores read" on public.scores;
create policy "scores read"   on public.scores  for select using (true);
drop policy if exists "scores insert" on public.scores;
create policy "scores insert" on public.scores  for insert with check (true);
drop policy if exists "reviews read" on public.reviews;
create policy "reviews read"   on public.reviews for select using (true);
-- 리뷰는 같은 닉네임으로 저장된 점수(=게임 클리어 기록)가 있어야 작성 가능
drop policy if exists "reviews insert" on public.reviews;
create policy "reviews insert" on public.reviews for insert
  with check (exists (select 1 from public.scores s where s.nickname = reviews.nickname));
