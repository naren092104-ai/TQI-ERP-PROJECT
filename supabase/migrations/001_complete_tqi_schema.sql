-- Complete TQI ERP tables for Supabase PostgreSQL
-- Additive migration: existing rows and tables are preserved.

create table if not exists public.academic_setup (
  academic_year_id text not null references public.academic_years(id) on delete cascade,
  day_number integer not null,
  academic_year text not null,
  session_name text,
  session_date date,
  updated_at timestamptz not null default now(),
  primary key (academic_year_id, day_number)
);

create table if not exists public.module_resources (
  id text primary key,
  module_id text not null references public.modules(id) on delete cascade,
  original_filename text not null,
  file_path text not null,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.schools (
  id text primary key,
  name text not null,
  academic_year_id text references public.academic_years(id) on delete restrict,
  cluster_id text references public.clusters(id) on delete restrict,
  panchayat_id text references public.panchayats(id) on delete restrict,
  village_id text references public.villages(id) on delete restrict,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_plans (
  id text primary key,
  session_id text references public.sessions(id) on delete set null,
  module_id text references public.modules(id) on delete set null,
  cluster_id text not null references public.clusters(id) on delete restrict,
  panchayat_id text references public.panchayats(id) on delete set null,
  village_id text references public.villages(id) on delete set null,
  volunteer_id text references public.volunteers(id) on delete set null,
  title text not null,
  topic text,
  objective text,
  activities text,
  materials text,
  duration text,
  remarks text,
  teaching_method text,
  assessment_task text,
  target_standard text,
  learning_outcomes text,
  day_number integer,
  academic_year_id text references public.academic_years(id) on delete restrict,
  status text not null default 'Draft',
  created_by text references public.users(id) on delete set null,
  submitted_by text references public.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by text references public.users(id) on delete set null,
  approved_at timestamptz,
  correction_reason text,
  edit_request_reason text,
  delete_request_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_photos (
  id text primary key,
  cluster_id text not null references public.clusters(id) on delete restrict,
  session_id text references public.sessions(id) on delete set null,
  academic_year_id text references public.academic_years(id) on delete restrict,
  day_number integer not null,
  file_path text not null,
  file_url text,
  original_filename text not null,
  mime_type text,
  file_size bigint not null default 0,
  uploaded_by text references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.session_reports (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  cluster_id text not null references public.clusters(id) on delete restrict,
  academic_year_id text references public.academic_years(id) on delete restrict,
  day_number integer,
  village_ids text,
  summit_number text,
  grade text,
  session_summary text,
  student_count integer default 0,
  attendance_summary text,
  activities text,
  outcome text,
  volunteer_names text,
  issues text,
  observations text,
  remarks text,
  status text not null default 'Draft',
  created_by text references public.users(id) on delete set null,
  submitted_by text references public.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by text references public.users(id) on delete set null,
  approved_at timestamptz,
  correction_reason text,
  edit_request_reason text,
  delete_request_reason text,
  workflow_previous_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_report_photos (
  id text primary key,
  session_report_id text not null references public.session_reports(id) on delete cascade,
  academic_year_id text not null references public.academic_years(id) on delete cascade,
  cluster_id text not null references public.clusters(id) on delete restrict,
  file_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  uploaded_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id text primary key,
  module text not null,
  status text not null default 'Pending',
  requested_by text references public.users(id) on delete set null,
  session_id text references public.sessions(id) on delete cascade,
  academic_year_id text references public.academic_years(id) on delete restrict,
  remarks text,
  date date,
  cluster_id text references public.clusters(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.date_change_requests (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  cluster_id text not null references public.clusters(id) on delete restrict,
  academic_year_id text references public.academic_years(id) on delete restrict,
  original_date date not null,
  requested_date date not null,
  reason text not null,
  status text not null default 'Pending',
  reviewed_by text references public.users(id) on delete set null,
  review_remarks text,
  reviewed_at timestamptz,
  requested_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_submissions (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  cluster_id text not null references public.clusters(id) on delete restrict,
  academic_year_id text references public.academic_years(id) on delete restrict,
  day_number integer not null,
  attendance_complete boolean not null default false,
  lesson_plan_complete boolean not null default false,
  photos_complete boolean not null default false,
  report_complete boolean not null default false,
  finance_complete boolean not null default false,
  status text not null default 'Draft',
  submitted_at timestamptz,
  submitted_by text references public.users(id) on delete set null,
  reviewed_by text references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_remarks text,
  resubmission_reason text,
  resubmitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, day_number)
);

create table if not exists public.finance_reports (
  id text not null,
  cluster_id text not null references public.clusters(id) on delete restrict,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  session_id text references public.sessions(id) on delete set null,
  report_status text not null default 'DRAFT',
  report_data jsonb not null default '{}'::jsonb,
  edit_request_status text not null default 'NONE',
  edit_request_reason text,
  edit_requested_by text references public.users(id) on delete set null,
  edit_requested_at timestamptz,
  edit_approved_by text references public.users(id) on delete set null,
  edit_approved_at timestamptz,
  edit_rejected_by text references public.users(id) on delete set null,
  edit_rejected_at timestamptz,
  edit_rejection_reason text,
  edit_permission boolean not null default false,
  last_submitted_at timestamptz,
  last_submitted_by text references public.users(id) on delete set null,
  created_by text references public.users(id) on delete set null,
  updated_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(id, academic_year_id)
);

create table if not exists public.finance_report_history (
  id text primary key,
  report_id text not null,
  academic_year_id text not null,
  event text not null,
  details text,
  user_id text references public.users(id) on delete set null,
  user_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_otps (
  id bigint generated always as identity primary key,
  email text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.password_reset_tokens (
  token_hash text primary key,
  user_id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_password_history (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  action text not null,
  changed_by text references public.users(id) on delete set null,
  changed_by_name text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_settings (
  id text primary key,
  enabled boolean not null default false,
  title text,
  message text,
  expected_completion timestamptz,
  show_countdown boolean not null default false,
  auto_disable boolean not null default false,
  enabled_at timestamptz,
  enabled_by text,
  disabled_at timestamptz,
  disabled_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tqi_settings (
  setting_key text primary key,
  setting_value text,
  setting_type text,
  description text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.session_photo_submissions (
  id text primary key,
  cluster_id text not null references public.clusters(id) on delete restrict,
  academic_year_id text references public.academic_years(id) on delete restrict,
  session_id text references public.sessions(id) on delete cascade,
  day_number integer not null,
  status text not null default 'DRAFT',
  submitted_by text references public.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by text references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_photo_delete_requests (
  id text primary key,
  photo_id text not null references public.session_photos(id) on delete cascade,
  cluster_id text not null references public.clusters(id) on delete restrict,
  academic_year_id text references public.academic_years(id) on delete restrict,
  requested_by text references public.users(id) on delete set null,
  reason text,
  status text not null default 'PENDING',
  reviewed_by text references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_remarks text,
  created_at timestamptz not null default now()
);

alter table public.academic_setup enable row level security;
alter table public.module_resources enable row level security;
alter table public.schools enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.session_photos enable row level security;
alter table public.session_reports enable row level security;
alter table public.session_report_photos enable row level security;
alter table public.approvals enable row level security;
alter table public.date_change_requests enable row level security;
alter table public.session_submissions enable row level security;
alter table public.finance_reports enable row level security;
alter table public.finance_report_history enable row level security;
alter table public.auth_otps enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.user_password_history enable row level security;
alter table public.maintenance_settings enable row level security;
alter table public.tqi_settings enable row level security;
alter table public.session_photo_submissions enable row level security;
alter table public.session_photo_delete_requests enable row level security;

create index if not exists idx_session_photos_cluster_year on public.session_photos(cluster_id, academic_year_id);
create index if not exists idx_lesson_plans_cluster_year on public.lesson_plans(cluster_id, academic_year_id);
create index if not exists idx_sessions_cluster_year on public.sessions(cluster_id, academic_year_id);
create index if not exists idx_students_cluster_year on public.students(cluster_id, academic_year_id);
create index if not exists idx_volunteers_cluster_year on public.volunteers(cluster_id, academic_year_id);
create index if not exists idx_finance_entries_cluster_year on public.finance_entries(cluster_id, academic_year_id);
