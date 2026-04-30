create table if not exists public.codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null
);

alter table public.encounters
  add column if not exists diagnosis_code_id uuid references public.codes(id),
  add column if not exists notes text,
  add column if not exists showed_up boolean default false;

create index if not exists encounters_diagnosis_code_id_idx on public.encounters(diagnosis_code_id);
