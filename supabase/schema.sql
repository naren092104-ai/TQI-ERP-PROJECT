-- TQI ERP Supabase PostgreSQL baseline
-- This is an additive, non-destructive production schema. Review before applying.
-- Existing Supabase data must be backed up and compared before cutover.

create extension if not exists pgcrypto;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id text primary key,
  name text not null unique,
  start_date date,
  end_date date,
  is_active boolean not null default false,
  status text not null default 'DRAFT',
  archived_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_academic_years_active on public.academic_years(is_active);

create table if not exists public.clusters (
  id text primary key,
  name text not null,
  district text,
  college_district text,
  state text,
  code text,
  college_name text,
  college_id text,
  subdistrict text,
  spoc_name text,
  spoc_mobile text,
  admin_id text,
  academic_year_id text references public.academic_years(id) on delete restrict,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('Super Admin','Cluster Admin')),
  cluster_id text references public.clusters(id) on delete restrict,
  phone text,
  must_change_password boolean not null default false,
  password_changed_at timestamptz,
  password_reset_at timestamptz,
  password_reset_by text,
  password_created_at timestamptz,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clusters drop constraint if exists fk_clusters_admin;
alter table public.clusters add constraint fk_clusters_admin foreign key (admin_id) references public.users(id) on delete set null;
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_cluster on public.users(cluster_id);

create table if not exists public.panchayats (
  id text primary key, name text not null, cluster_id text not null references public.clusters(id) on delete restrict,
  status text not null default 'Active', academic_year_id text references public.academic_years(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.villages (
  id text primary key, name text not null, panchayat_id text not null references public.panchayats(id) on delete restrict,
  cluster_id text not null references public.clusters(id) on delete restrict, status text not null default 'Active',
  academic_year_id text references public.academic_years(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.students (
  id text primary key, code text, name text not null, gender text, dob date, standard text,
  cluster_id text not null references public.clusters(id) on delete restrict,
  panchayat_id text not null references public.panchayats(id) on delete restrict,
  village_id text not null references public.villages(id) on delete restrict,
  parent_name text, phone text, status text not null default 'Active', school_name text,
  academic_year_id text references public.academic_years(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.volunteers (
  id text primary key, name text not null, gender text, email text, phone text, college_name text,
  cluster_id text not null references public.clusters(id) on delete restrict,
  panchayat_id text references public.panchayats(id) on delete set null,
  village_id text references public.villages(id) on delete set null,
  department text, study_year text, stream text, passing_out_year smallint, role text,
  status text not null default 'Active',
  academic_year_id text references public.academic_years(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id text primary key, code text, name text not null, description text, academic_year text,
  day_number integer, is_active boolean not null default true,
  academic_year_id text references public.academic_years(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sessions (
  id text primary key, code text, name text, module_id text references public.modules(id) on delete restrict,
  cluster_id text references public.clusters(id) on delete restrict,
  panchayat_id text references public.panchayats(id) on delete restrict,
  village_id text references public.villages(id) on delete restrict,
  volunteer_id text references public.volunteers(id) on delete restrict,
  academic_year text, academic_year_id text references public.academic_years(id) on delete restrict,
  day_number integer, date date, time text,
  session_status text not null default 'Draft', target_locations_json jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id text primary key, session_id text not null references public.sessions(id) on delete cascade,
  cluster_id text not null references public.clusters(id) on delete restrict,
  panchayat_id text references public.panchayats(id) on delete set null,
  village_id text references public.villages(id) on delete set null,
  day_number integer not null, academic_year_id text references public.academic_years(id) on delete restrict,
  attendance_type text not null default 'students', status text not null default 'Draft',
  present_count integer not null default 0, total_count integer not null default 0,
  task_completed_count integer not null default 0, not_marked_count integer not null default 0,
  edit_reason text, edit_requested_by text, edit_requested_at timestamptz, reviewed_by text,
  reviewed_at timestamptz, review_remarks text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.student_attendance (
  id text primary key, attendance_session_id text not null references public.attendance_sessions(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade, present boolean, task_status text,
  created_at timestamptz not null default now()
);
create table if not exists public.volunteer_attendance (
  id text primary key, attendance_session_id text not null references public.attendance_sessions(id) on delete cascade,
  volunteer_id text not null references public.volunteers(id) on delete cascade, present boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id text primary key, cluster_id text not null references public.clusters(id) on delete restrict,
  session_id text references public.sessions(id) on delete set null,
  academic_year_id text references public.academic_years(id) on delete restrict,
  date date not null, description text not null, category text not null, amount numeric(12,2) not null,
  created_by text references public.users(id) on delete set null, status text not null default 'Draft',
  bill_reference text, bill_url text, count integer, count_amount text, remarks text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id text primary key, user_id text references public.users(id) on delete cascade,
  title text not null, message text not null, type text not null,
  is_read boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id text primary key, user_id text references public.users(id) on delete set null,
  user_name text, role text, cluster_id text references public.clusters(id) on delete set null,
  action text not null, module text, record_id text, details text,
  created_at timestamptz not null default now()
);

alter table public.clusters enable row level security;
alter table public.users enable row level security;
alter table public.panchayats enable row level security;
alter table public.villages enable row level security;
alter table public.students enable row level security;
alter table public.volunteers enable row level security;
alter table public.modules enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.student_attendance enable row level security;
alter table public.volunteer_attendance enable row level security;
alter table public.finance_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- RLS policy application is intentionally not using a fabricated auth role here.
-- Existing application JWT claims and Supabase Auth integration require a follow-up
-- migration defining public.jwt_role()/auth.uid()-compatible claims and policies.
