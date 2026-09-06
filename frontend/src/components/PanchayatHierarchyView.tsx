import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Search, Trash2 } from './ui/icons';
import { Cluster, Panchayat, Village } from '../types';
import Badge from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type PanchayatHierarchyRoute =
  | { level: 'clusters' }
  | { level: 'panchayats'; clusterId: string }
  | { level: 'villages'; clusterId: string; panchayatId: string };

interface Props {
  route: PanchayatHierarchyRoute;
  clusters: Cluster[];
  panchayats: Panchayat[];
  onNavigate: (route: PanchayatHierarchyRoute, replace?: boolean) => void;
  onAddPanchayat: (clusterId: string, name: string) => Promise<void>;
  onAddVillage: (panchayatId: string, name: string) => Promise<void>;
  onDeletePanchayat: (id: string) => Promise<void>;
  onDeleteVillage: (id: string) => Promise<void>;
}

const statusLabel = (status?: string) => status === 'ACTIVE' || status === 'On Track' ? 'Active' : status || 'Active';

export const PanchayatHierarchyView: React.FC<Props> = ({ route, clusters, panchayats, onNavigate, onAddPanchayat, onAddVillage, onDeletePanchayat, onDeleteVillage }) => {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const cluster = route.level === 'clusters' ? undefined : clusters.find((item) => item.id === route.clusterId);
  const panchayat = route.level === 'villages' ? panchayats.find((item) => item.id === route.panchayatId) : undefined;
  const clusterPanchayats = cluster ? panchayats.filter((item) => item.clusterId === cluster.id) : [];
  const villages = panchayat?.villages || [];

  const districts = useMemo(() => Array.from(new Set(clusters.map((item) => item.district).filter(Boolean))).sort(), [clusters]);
  const visibleClusters = clusters.filter((item) => (!search || `${item.name} ${item.collegeName || ''} ${item.district}`.toLowerCase().includes(search.toLowerCase())) && (district === 'all' || item.district === district));
  const visiblePanchayats = clusterPanchayats.filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()));
  const visibleVillages = villages.filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()));

  const submitAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (route.level === 'panchayats') await onAddPanchayat(route.clusterId, name.trim());
      if (route.level === 'villages') await onAddVillage(route.panchayatId, name.trim());
      setName('');
      setShowAdd(false);
    } finally { setSaving(false); }
  };

  const openAdd = () => { setName(''); setShowAdd(true); };
  const title = route.level === 'clusters' ? 'Panchayats & Villages' : route.level === 'panchayats' ? `${cluster?.name || 'Cluster'} — Panchayats & Villages` : panchayat?.name || 'Villages';

  return <div className="space-y-6">
    {route.level !== 'clusters' && <div className="flex items-center gap-2 text-xs text-muted-foreground"><button type="button" onClick={() => onNavigate(route.level === 'villages' ? { level: 'panchayats', clusterId: route.clusterId } : { level: 'clusters' })} className="inline-flex items-center gap-1 font-medium hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back to {route.level === 'villages' ? 'Panchayats' : 'Panchayats & Villages'}</button><span>›</span><span className="font-semibold text-foreground">{route.level === 'villages' ? `${cluster?.name || ''} › ${panchayat?.name || ''}` : cluster?.name}</span></div>}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{route.level === 'clusters' ? 'Manage panchayats and villages under each cluster.' : route.level === 'panchayats' ? `${cluster?.collegeName || ''} · ${cluster?.district || ''}, Tamil Nadu` : `Cluster: ${cluster?.name || ''} · ${cluster?.collegeName || ''} · ${cluster?.district || ''}`}</p></div>{route.level !== 'clusters' && <Button onClick={openAdd} className="gap-1.5"><Plus className="h-4 w-4" />Add {route.level === 'panchayats' ? 'Panchayat' : 'Village'}</Button>}</div>
    {route.level === 'clusters' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Metric label="Total Clusters" value={clusters.length} /><Metric label="Total Panchayats" value={clusters.reduce((sum, item) => sum + item.activePanchayats, 0)} /><Metric label="Total Villages" value={panchayats.reduce((sum, item) => sum + item.villagesCount, 0)} /><Metric label="Total Students" value={clusters.reduce((sum, item) => sum + item.totalStudents, 0)} /><Metric label="Total Volunteers" value={clusters.reduce((sum, item) => sum + item.totalVolunteers, 0)} /></div>}
    {route.level !== 'clusters' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Total Panchayats" value={clusterPanchayats.length} /><Metric label="Total Villages" value={clusterPanchayats.reduce((sum, item) => sum + item.villagesCount, 0)} /><Metric label="Total Students" value={clusterPanchayats.reduce((sum, item) => sum + item.activeStudents, 0)} /><Metric label="Total Volunteers" value={clusterPanchayats.reduce((sum, item) => sum + item.volunteersCount, 0)} /></div>}
    <div className="flex flex-col gap-2 sm:flex-row"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={route.level === 'clusters' ? 'Search clusters' : route.level === 'panchayats' ? 'Search panchayats' : 'Search villages'} className="pl-9" /></div>{route.level === 'clusters' && <select value={district} onChange={(event) => setDistrict(event.target.value)} className="rounded-md border border-border bg-background px-3 text-sm"><option value="all">All districts</option>{districts.map((item) => <option key={item} value={item}>{item}</option>)}</select>}</div>
    {route.level === 'clusters' && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{visibleClusters.map((item) => <article key={item.id} className="rounded-lg border border-border bg-card p-5 shadow-xs"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-foreground">{item.name}</h2><p className="mt-1 text-sm font-medium text-foreground">{item.collegeName || 'College not assigned'}</p><p className="text-xs text-muted-foreground">{item.district}, {item.state || 'Tamil Nadu'}</p></div><Badge variant="success">{statusLabel(item.adminStatus)}</Badge></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-muted-foreground">Panchayats</span><strong>{item.activePanchayats}</strong></div><div><span className="block text-xs text-muted-foreground">Villages</span><strong>{panchayats.filter((p) => p.clusterId === item.id).reduce((sum, p) => sum + p.villagesCount, 0)}</strong></div></div><Button variant="outline" className="mt-5 w-full gap-1" onClick={() => onNavigate({ level: 'panchayats', clusterId: item.id })}>View Panchayats & Villages <ArrowRight className="h-4 w-4" /></Button></article>)}</div>}
    {route.level === 'panchayats' && <DataTable headers={['S.No', 'Panchayat Name', 'Status', 'Villages', 'Students', 'Volunteers', 'Actions']} rows={visiblePanchayats.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className="font-semibold">{item.name}</td><td><Badge variant="success">{statusLabel(item.status)}</Badge></td><td>{item.villagesCount > 0 ? item.villagesCount : <span className="text-xs text-muted-foreground">No villages configured</span>}</td><td>{item.activeStudents}</td><td>{item.volunteersCount}</td><td className="text-right">{item.villagesCount > 0 && <Button variant="ghost" size="sm" onClick={() => onNavigate({ level: 'villages', clusterId: route.clusterId, panchayatId: item.id })}>View Villages</Button>}<Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDeletePanchayat(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)} />}
    {route.level === 'villages' && <DataTable headers={['S.No', 'Village Name', 'Status', 'Students', 'Volunteers', 'Actions']} rows={visibleVillages.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className="font-semibold">{item.name}</td><td><Badge variant="success">{statusLabel(item.status)}</Badge></td><td>{item.studentCount || 0}</td><td>{item.volunteerCount || 0}</td><td className="text-right"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDeleteVillage(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)} />}
    {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={submitAdd} className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-xl"><h2 className="text-lg font-bold">Add {route.level === 'panchayats' ? 'Panchayat' : 'Village'}</h2><label className="block text-sm font-medium">Name<Input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div></form></div>}
  </div>;
};

const Metric = ({ label, value }: { label: string; value: number }) => <div className="rounded-lg border border-border bg-card p-4 shadow-xs"><div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold text-foreground">{value}</div></div>;
const DataTable = ({ headers, rows }: { headers: string[]; rows: React.ReactNode[] }) => <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows}</tbody></table></div>;
