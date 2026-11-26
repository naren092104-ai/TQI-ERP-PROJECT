alter table public.clusters add column if not exists college_id text;
alter table public.clusters add column if not exists subdistrict text;
create index if not exists idx_clusters_college_id on public.clusters(college_id);
create index if not exists idx_clusters_subdistrict on public.clusters(subdistrict);
