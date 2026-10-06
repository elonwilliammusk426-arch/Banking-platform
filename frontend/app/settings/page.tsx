'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Bell, ChevronRight, CreditCard, Laptop,
  LoaderCircle, Save, ShieldCheck, Smartphone, Trash2, UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Preference = { language: string; timezone: string; dateFormat: string; theme: string; emailNotifications: boolean; pushNotifications: boolean; smsNotifications: boolean; marketingMessages: boolean };
type Security = { loginAlerts: boolean; transactionAlerts: boolean; trustedDeviceAlerts: boolean; sessionTimeoutMinutes: number };
type Device = { id: string; displayName: string; platform: string | null; browser: string | null; lastIpAddress: string | null; lastSeenAt: string; trustedAt: string | null; current: boolean; activeSessions: number };
type Account = { id: string; name: string; accountNumberLast4: string; currency: string; setting: { nickname: string | null; paperlessStatements: boolean; transactionAlerts: boolean; lowBalanceAlert: boolean; lowBalanceThreshold: string | null } | null };
type SettingsData = {
  profile: { id: string; email: string; phone: string | null; firstName: string; lastName: string; mfaEnabled: boolean };
  preference: Preference;
  security: Security;
  accounts: Account[];
  devices: Device[];
};

type Tab = 'Profile' | 'Preferences' | 'Security' | 'Accounts';
const tabs: Array<[Tab, typeof UserRound]> = [['Profile', UserRound], ['Preferences', Bell], ['Security', ShieldCheck], ['Accounts', CreditCard]];

function Brand() {
  return <Link href="/" className="flex items-center gap-2.5"><span className="flex size-8 -rotate-2 items-center justify-center gap-0.5 rounded-[10px] bg-cobalt"><i className="mt-1 h-2.5 w-1 -skew-x-12 rounded bg-white"/><i className="h-[18px] w-1 -skew-x-12 rounded bg-white"/></span><strong className="font-display text-2xl tracking-tight">haven</strong></Link>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-cobalt' : 'bg-slate-200'}`}><span className={`block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}/></button>;
}

function SettingRow({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-4 border-t border-slate-100 py-4 first:border-0"><div className="flex-1"><strong className="block text-xs">{title}</strong><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div><Toggle label={title} checked={checked} onChange={onChange}/></div>;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [tab, setTab] = useState<Tab>('Profile');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState('');

  async function load() {
    try { setData(await api<SettingsData>('/settings')); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load settings'); }
  }
  useEffect(() => { void load(); }, []);

  async function save<T>(key: string, path: string, body: unknown, apply?: (result: T) => void) {
    setSaving(key); setError(''); setNotice('');
    try { const result = await api<T>(path, { method: 'PATCH', body: JSON.stringify(body) }); apply?.(result); setNotice('Changes saved'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save changes'); }
    finally { setSaving(''); }
  }

  if (!data) return <main className="grid min-h-screen place-items-center bg-slate-50"><div className="text-center">{error ? <><p className="text-sm font-semibold text-red-600">{error}</p><Button className="mt-4" onClick={() => void load()}>Try again</Button></> : <><LoaderCircle className="mx-auto animate-spin text-cobalt"/><p className="mt-3 text-xs text-slate-400">Loading your settings…</p></>}</div></main>;

  const setPreference = (patch: Partial<Preference>) => setData({ ...data, preference: { ...data.preference, ...patch } });
  const setSecurity = (patch: Partial<Security>) => setData({ ...data, security: { ...data.security, ...patch } });

  return <div className="min-h-screen bg-[#f7f8fb]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center px-5"><Brand/><Link href="/" className="ml-auto flex items-center gap-2 text-[10px] font-semibold text-slate-500 hover:text-ink"><ArrowLeft size={15}/> Back to dashboard</Link></div></header>
    <main className="mx-auto max-w-6xl px-5 py-8 lg:py-12">
      <div className="mb-7"><span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">Personal controls</span><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Settings & security</h1><p className="mt-1 text-xs text-slate-400">Manage your profile, preferences, account alerts, and trusted devices.</p></div>
      {(error || notice) && <div role="status" className={`mb-4 rounded-xl border px-4 py-3 text-[11px] font-medium ${error ? 'border-red-100 bg-red-50 text-red-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <Card className="h-fit p-2">{tabs.map(([label, Icon]) => <button key={label} onClick={() => { setTab(label); setNotice(''); }} className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[11px] font-semibold ${tab === label ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}><Icon size={18}/>{label}<ChevronRight size={14} className="ml-auto"/></button>)}</Card>
        <section>
          {tab === 'Profile' && <Card className="p-6"><h2 className="font-display text-xl font-bold">Personal information</h2><p className="mt-1 text-[10px] text-slate-400">The details associated with your Haven profile.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-bold text-slate-600">First name<input className="field mt-2" value={data.profile.firstName} onChange={(e) => setData({ ...data, profile: { ...data.profile, firstName: e.target.value } })}/></label><label className="text-[10px] font-bold text-slate-600">Last name<input className="field mt-2" value={data.profile.lastName} onChange={(e) => setData({ ...data, profile: { ...data.profile, lastName: e.target.value } })}/></label><label className="text-[10px] font-bold text-slate-600">Email<input className="field mt-2 bg-slate-50" value={data.profile.email} disabled/></label><label className="text-[10px] font-bold text-slate-600">Phone<input className="field mt-2" value={data.profile.phone ?? ''} onChange={(e) => setData({ ...data, profile: { ...data.profile, phone: e.target.value || null } })}/></label></div><div className="mt-6 flex justify-end"><Button disabled={saving === 'profile'} onClick={() => void save('profile', '/customer/profile', { firstName: data.profile.firstName, lastName: data.profile.lastName, ...(data.profile.phone ? { phone: data.profile.phone } : {}) })}><Save size={15}/>{saving === 'profile' ? 'Saving…' : 'Save profile'}</Button></div></Card>}

          {tab === 'Preferences' && <div className="space-y-4"><Card className="p-6"><h2 className="font-display text-xl font-bold">Display & region</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-bold text-slate-600">Language<select className="field mt-2" value={data.preference.language} onChange={(e) => setPreference({ language: e.target.value })}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label><label className="text-[10px] font-bold text-slate-600">Timezone<input className="field mt-2" value={data.preference.timezone} onChange={(e) => setPreference({ timezone: e.target.value })}/></label><label className="text-[10px] font-bold text-slate-600">Date format<select className="field mt-2" value={data.preference.dateFormat} onChange={(e) => setPreference({ dateFormat: e.target.value })}><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></label><label className="text-[10px] font-bold text-slate-600">Theme<select className="field mt-2" value={data.preference.theme} onChange={(e) => setPreference({ theme: e.target.value })}><option value="SYSTEM">Use system setting</option><option value="LIGHT">Light</option><option value="DARK">Dark</option></select></label></div></Card><Card className="p-6"><h2 className="font-display text-lg font-bold">Notifications</h2><div className="mt-3"><SettingRow title="Email notifications" detail="Important account and product updates" checked={data.preference.emailNotifications} onChange={(value) => setPreference({ emailNotifications: value })}/><SettingRow title="Push notifications" detail="Real-time activity on signed-in devices" checked={data.preference.pushNotifications} onChange={(value) => setPreference({ pushNotifications: value })}/><SettingRow title="SMS notifications" detail="Time-sensitive alerts sent by text" checked={data.preference.smsNotifications} onChange={(value) => setPreference({ smsNotifications: value })}/><SettingRow title="Product news" detail="Occasional news and helpful money tips" checked={data.preference.marketingMessages} onChange={(value) => setPreference({ marketingMessages: value })}/></div><div className="mt-4 flex justify-end"><Button disabled={saving === 'preferences'} onClick={() => void save('preferences', '/settings/preferences', data.preference)}><Save size={15}/>{saving === 'preferences' ? 'Saving…' : 'Save preferences'}</Button></div></Card></div>}

          {tab === 'Security' && <div className="space-y-4"><Card className="p-6"><div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-xl ${data.profile.mfaEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}><BadgeCheck size={21}/></span><div><strong className="block text-xs">Two-factor authentication</strong><p className="mt-1 text-[9px] text-slate-400">{data.profile.mfaEnabled ? 'Authenticator protection is enabled' : 'Add an authenticator for stronger protection'}</p></div><span className={`ml-auto rounded-md px-2 py-1 text-[8px] font-bold ${data.profile.mfaEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{data.profile.mfaEnabled ? 'ON' : 'OFF'}</span></div></Card><Card className="p-6"><h2 className="font-display text-lg font-bold">Security alerts</h2><div className="mt-3"><SettingRow title="Login alerts" detail="Notify me when a new sign-in is detected" checked={data.security.loginAlerts} onChange={(value) => setSecurity({ loginAlerts: value })}/><SettingRow title="Transaction alerts" detail="Notify me about money movement" checked={data.security.transactionAlerts} onChange={(value) => setSecurity({ transactionAlerts: value })}/><SettingRow title="Trusted-device changes" detail="Notify me when trust is granted or removed" checked={data.security.trustedDeviceAlerts} onChange={(value) => setSecurity({ trustedDeviceAlerts: value })}/></div><label className="mt-3 block text-[10px] font-bold text-slate-600">Automatic timeout<select className="field mt-2 max-w-xs" value={data.security.sessionTimeoutMinutes} onChange={(e) => setSecurity({ sessionTimeoutMinutes: Number(e.target.value) })}>{[15,30,60,120].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</select></label><div className="mt-5 flex justify-end"><Button disabled={saving === 'security'} onClick={() => void save('security', '/settings/security', data.security)}><Save size={15}/>{saving === 'security' ? 'Saving…' : 'Save security settings'}</Button></div></Card><Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold">Trusted devices</h2><p className="mt-1 text-[10px] text-slate-400">Review devices that have accessed your account.</p></div><button className="text-[9px] font-semibold text-red-500" onClick={async () => { setSaving('sessions'); await api('/settings/sessions/revoke-others', { method: 'POST' }); await load(); setSaving(''); setNotice('Other sessions signed out'); }}>Sign out other sessions</button></div><div className="mt-4">{data.devices.map((device) => <div className="flex items-center gap-3 border-t border-slate-100 py-4 first:border-0" key={device.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">{/iphone|android/i.test(`${device.displayName} ${device.platform}`) ? <Smartphone size={18}/> : <Laptop size={18}/>}</span><div className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{device.displayName} {device.current && <span className="ml-1 text-[8px] text-emerald-600">CURRENT</span>}</strong><p className="mt-1 truncate text-[8px] text-slate-400">{device.lastIpAddress ?? 'IP unavailable'} · Seen {new Date(device.lastSeenAt).toLocaleString()}</p></div><button onClick={() => void save('device', `/settings/devices/${device.id}/trust`, { trusted: !device.trustedAt }, () => void load())} className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-bold ${device.trustedAt ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500'}`}>{device.trustedAt ? 'TRUSTED' : 'TRUST'}</button><button aria-label={`Remove ${device.displayName}`} onClick={async () => { if (!confirm(`Remove ${device.displayName} and sign out its sessions?`)) return; await api(`/settings/devices/${device.id}`, { method: 'DELETE' }); if (device.current) location.href = '/login'; else await load(); }} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15}/></button></div>)}</div></Card></div>}

          {tab === 'Accounts' && <div className="space-y-4">{data.accounts.map((account) => { const setting = account.setting ?? { nickname: null, paperlessStatements: true, transactionAlerts: true, lowBalanceAlert: false, lowBalanceThreshold: null }; const update = (patch: Partial<typeof setting>) => setData({ ...data, accounts: data.accounts.map((item) => item.id === account.id ? { ...item, setting: { ...setting, ...patch } } : item) }); return <Card className="p-6" key={account.id}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><CreditCard size={19}/></span><div><strong className="block text-xs">{setting.nickname || account.name}</strong><p className="mt-1 text-[9px] text-slate-400">{account.currency} · •••• {account.accountNumberLast4}</p></div></div><label className="mt-5 block text-[10px] font-bold text-slate-600">Account nickname<input className="field mt-2" value={setting.nickname ?? ''} onChange={(e) => update({ nickname: e.target.value || null })}/></label><div className="mt-4"><SettingRow title="Paperless statements" detail="Receive statements digitally" checked={setting.paperlessStatements} onChange={(value) => update({ paperlessStatements: value })}/><SettingRow title="Transaction alerts" detail="Alert me about activity on this account" checked={setting.transactionAlerts} onChange={(value) => update({ transactionAlerts: value })}/><SettingRow title="Low-balance alert" detail="Notify me when the balance falls below my threshold" checked={setting.lowBalanceAlert} onChange={(value) => update({ lowBalanceAlert: value })}/></div>{setting.lowBalanceAlert && <label className="block text-[10px] font-bold text-slate-600">Alert threshold<input className="field mt-2 max-w-xs" type="number" min="0" step="0.01" value={setting.lowBalanceThreshold ?? ''} onChange={(e) => update({ lowBalanceThreshold: e.target.value || null })}/></label>}<div className="mt-5 flex justify-end"><Button disabled={saving === account.id} onClick={() => void save(account.id, `/settings/accounts/${account.id}`, setting, () => void load())}><Save size={15}/>{saving === account.id ? 'Saving…' : 'Save account settings'}</Button></div></Card>; })}</div>}
        </section>
      </div>
    </main>
  </div>;
}
