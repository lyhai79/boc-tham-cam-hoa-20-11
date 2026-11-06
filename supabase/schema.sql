-- Supabase SQL Editor: chay toan bo tep nay mot lan.
create extension if not exists pgcrypto;

create table if not exists public.classes (
  class_name text primary key,
  grade integer not null,
  access_code_hash text not null
);

create table if not exists public.draws (
  id bigint generated always as identity primary key,
  class_name text not null unique references public.classes(class_name),
  draw_number integer not null unique check (draw_number between 1 and 28),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key check (id = 1),
  is_locked boolean not null default false
);
insert into public.app_settings(id, is_locked) values (1, false)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','viewer'))
);

alter table public.classes enable row level security;
alter table public.draws enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;

-- Cong khai chi doc ket qua; khong cho phep client tu y them/sua/xoa.
create policy "Public can read draws" on public.draws for select to anon, authenticated using (true);
create policy "Public can read settings" on public.app_settings for select to anon, authenticated using (true);
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

-- Seed 28 lop. MA_LOP_* la ma tam: quan tri vien phai thay bang ma rieng truoc khi phat cho GVCN.
insert into public.classes(class_name, grade, access_code_hash) values
('6A',6,encode(digest('THAY_MA_RIENG_6A', 'sha256'),'hex')),
('6B',6,encode(digest('THAY_MA_RIENG_6B', 'sha256'),'hex')),
('6C',6,encode(digest('THAY_MA_RIENG_6C', 'sha256'),'hex')),
('6D',6,encode(digest('THAY_MA_RIENG_6D', 'sha256'),'hex')),
('6E',6,encode(digest('THAY_MA_RIENG_6E', 'sha256'),'hex')),
('6G',6,encode(digest('THAY_MA_RIENG_6G', 'sha256'),'hex')),
('6H',6,encode(digest('THAY_MA_RIENG_6H', 'sha256'),'hex')),
('6I',6,encode(digest('THAY_MA_RIENG_6I', 'sha256'),'hex')),
('6K',6,encode(digest('THAY_MA_RIENG_6K', 'sha256'),'hex')),
('7A',7,encode(digest('THAY_MA_RIENG_7A', 'sha256'),'hex')),
('7B',7,encode(digest('THAY_MA_RIENG_7B', 'sha256'),'hex')),
('7C',7,encode(digest('THAY_MA_RIENG_7C', 'sha256'),'hex')),
('7D',7,encode(digest('THAY_MA_RIENG_7D', 'sha256'),'hex')),
('7E',7,encode(digest('THAY_MA_RIENG_7E', 'sha256'),'hex')),
('7G',7,encode(digest('THAY_MA_RIENG_7G', 'sha256'),'hex')),
('7H',7,encode(digest('THAY_MA_RIENG_7H', 'sha256'),'hex')),
('8A',8,encode(digest('THAY_MA_RIENG_8A', 'sha256'),'hex')),
('8B',8,encode(digest('THAY_MA_RIENG_8B', 'sha256'),'hex')),
('8C',8,encode(digest('THAY_MA_RIENG_8C', 'sha256'),'hex')),
('8D',8,encode(digest('THAY_MA_RIENG_8D', 'sha256'),'hex')),
('8E',8,encode(digest('THAY_MA_RIENG_8E', 'sha256'),'hex')),
('8G',8,encode(digest('THAY_MA_RIENG_8G', 'sha256'),'hex')),
('9A',9,encode(digest('THAY_MA_RIENG_9A', 'sha256'),'hex')),
('9B',9,encode(digest('THAY_MA_RIENG_9B', 'sha256'),'hex')),
('9C',9,encode(digest('THAY_MA_RIENG_9C', 'sha256'),'hex')),
('9D',9,encode(digest('THAY_MA_RIENG_9D', 'sha256'),'hex')),
('9E',9,encode(digest('THAY_MA_RIENG_9E', 'sha256'),'hex')),
('9G',9,encode(digest('THAY_MA_RIENG_9G', 'sha256'),'hex'))
on conflict (class_name) do nothing;

-- RPC nay chay trong mot transaction; khoa dong settings giup tranh hai lop lay cung so.
create or replace function public.draw_once(p_class_name text, p_access_code text)
returns table(class_name text, draw_number integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_locked boolean;
  v_number integer;
begin
  select is_locked into v_locked from public.app_settings where id = 1 for update;
  if coalesce(v_locked, true) then raise exception 'Hệ thống đang khóa hoặc chưa được cấu hình.'; end if;

  select access_code_hash into v_hash from public.classes where classes.class_name = p_class_name;
  if v_hash is null then raise exception 'Tên lớp không hợp lệ.'; end if;
  if v_hash <> encode(digest(coalesce(p_access_code,''), 'sha256'),'hex') then
    raise exception 'Mã bốc thăm không chính xác.';
  end if;
  if exists(select 1 from public.draws where draws.class_name = p_class_name) then
    raise exception 'Lớp này đã bốc thăm và không được bốc thăm lại.';
  end if;

  select nums.n into v_number
  from generate_series(1,28) as nums(n)
  where not exists(select 1 from public.draws d where d.draw_number = nums.n)
  order by random()
  limit 1;

  if v_number is null then raise exception 'Đã hoàn thành đủ 28 lượt bốc thăm.'; end if;

  return query
  insert into public.draws(class_name, draw_number)
  values (p_class_name, v_number)
  returning draws.class_name, draws.draw_number, draws.created_at;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.admin_set_lock(p_locked boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Bạn không có quyền quản trị.'; end if;
  update public.app_settings set is_locked = p_locked where id = 1;
end;
$$;

create or replace function public.admin_reset_draws()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Bạn không có quyền quản trị.'; end if;
  delete from public.draws;
  update public.app_settings set is_locked = false where id = 1;
end;
$$;

revoke all on function public.draw_once(text,text) from public;
grant execute on function public.draw_once(text,text) to anon, authenticated;
revoke all on function public.admin_set_lock(boolean) from public;
grant execute on function public.admin_set_lock(boolean) to authenticated;
revoke all on function public.admin_reset_draws() from public;
grant execute on function public.admin_reset_draws() to authenticated;

grant select on public.draws, public.app_settings to anon, authenticated;
grant select on public.profiles to authenticated;

-- Bat realtime cho bang ket qua va trang thai.
alter publication supabase_realtime add table public.draws;
alter publication supabase_realtime add table public.app_settings;
