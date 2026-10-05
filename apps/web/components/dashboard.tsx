'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined,
  ChevronDown, ChevronRight, CircleDollarSign, CreditCard, Download, Eye, EyeOff,
  HelpCircle, Landmark, LayoutDashboard, LockKeyhole, Menu, MoreHorizontal, PiggyBank,
  Plus, Search, Send, Settings, ShieldCheck, ShoppingBag, Snowflake, Sparkles,
  TrendingUp, WalletCards, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { SendMoneyDialog } from './send-money-dialog';
import { WorkspacePage } from './workspace-pages';

type Summary = {
  totalBalance: string;
  availableBalance: string;
  currency: string;
  totalsByCurrency: Record<string, { ledgerBalance: string; availableBalance: string }>;
  accounts: Array<{ id: string; name: string; type: string; status: string; last4: string; ledgerBalance: string; availableBalance: string; currency: string }>;
};
type Transaction = { id: string; name: string; detail: string; amount: number; currency: string; icon: typeof ShoppingBag; tone: string };

const nav = [
  ['Overview', LayoutDashboard], ['Accounts', Landmark], ['Cards', WalletCards],
  ['Payments', ArrowLeftRight], ['Analytics', ChartNoAxesCombined],
] as const;
const contacts = [
  ['Maya', 'MK', '#e8c6aa'], ['Liam', 'LW', '#b9d8cf'], ['Sofia', 'SR', '#c8cff0'], ['Noah', 'NB', '#efd4a5'],
] as const;

function Brand({ dark = true }: { dark?: boolean }) {
  return <div className="flex items-center gap-2.5"><div className="flex size-7 -rotate-2 items-center justify-center gap-0.5 rounded-[9px] bg-cobalt"><i className="mt-1 h-2.5 w-1 -skew-x-12 rounded bg-white"/><i className="h-[17px] w-1 -skew-x-12 rounded bg-white"/></div><strong className={`font-display text-[21px] tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>haven</strong></div>;
}

function Avatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <span className={`grid place-items-center rounded-full bg-[#d5e5df] font-bold text-slate-700 ${size === 'sm' ? 'size-8 text-[9px]' : 'size-9 text-[10px]'}`}>AM</span>;
}

function Sidebar({ open, active, setActive, close }: { open: boolean; active: string; setActive: (value: string) => void; close: () => void }) {
  return <>
    {open && <button aria-label="Close menu" onClick={close} className="fixed inset-0 z-30 bg-navy/60 backdrop-blur-sm lg:hidden"/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col bg-navy px-[17px] pb-[18px] pt-6 text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-9 flex items-center justify-between px-2"><Brand/><button className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 lg:hidden" onClick={close}><X size={19}/></button></div>
      <span className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">Workspace</span>
      <nav className="space-y-1">{nav.map(([label, Icon]) => <button key={label} onClick={() => { setActive(label); close(); }} className={`nav-item ${active === label ? 'nav-item-active' : ''}`}><Icon size={19} strokeWidth={active === label ? 2.3 : 1.8}/>{label}{label === 'Payments' && <em className="ml-auto grid size-5 place-items-center rounded-md bg-cobalt text-[9px] not-italic text-white">2</em>}</button>)}</nav>
      <div className="mt-auto">
        <div className="relative mb-3 overflow-hidden rounded-2xl border border-slate-700 bg-[#18253b] p-4">
          <div className="mb-3 grid size-8 place-items-center rounded-lg bg-[#2c3a59] text-indigo-300"><HelpCircle size={19}/></div><strong className="text-xs">Need a hand?</strong><p className="my-1 text-[10px] text-slate-500">Our team is here 24/7.</p><button className="text-[10px] font-semibold text-indigo-300">Chat with us ↗</button>
        </div>
        <button className="nav-item" onClick={() => setActive('Settings')}><Settings size={18}/>Settings</button>
        <div className="mt-3 flex items-center gap-2.5 border-t border-slate-800 px-2 pt-4"><Avatar/><div className="min-w-0 flex-1"><strong className="block truncate text-[11px]">Alex Morgan</strong><span className="block truncate text-[9px] text-slate-500">alex@haven.co</span></div><MoreHorizontal size={17} className="text-slate-500"/></div>
      </div>
    </aside>
  </>;
}

function Header({ active, menu }: { active: string; menu: () => void }) {
  const [search, setSearch] = useState(false);
  return <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-slate-200 bg-white px-5 lg:px-8">
    <button className="mr-2 grid size-9 place-items-center rounded-lg hover:bg-slate-100 lg:hidden" onClick={menu}><Menu size={21}/></button><div className="lg:hidden"><Brand dark={false}/></div>
    <div className="hidden items-center gap-2 text-[11px] lg:flex"><span className="text-slate-400">Personal</span><ChevronRight size={14} className="text-slate-300"/><strong>{active}</strong></div>
    <div className="ml-auto flex items-center gap-2">
      <button onClick={() => setSearch(true)} className="flex size-9 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-400 md:w-56 md:justify-start md:gap-2 md:px-3"><Search size={17}/><span className="hidden flex-1 text-left text-[11px] md:block">Search anything</span><kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[8px] md:block">⌘ K</kbd></button>
      <button className="relative grid size-9 place-items-center rounded-[10px] border border-slate-200"><Bell size={18}/><i className="absolute right-2 top-1.5 size-1.5 rounded-full border border-white bg-red-500"/></button>
      <button className="ml-1 flex items-center gap-1 border-l border-slate-200 pl-3"><Avatar size="sm"/><ChevronDown size={14} className="text-slate-400"/></button>
    </div>
    {search && <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && setSearch(false)}><div className="modal-in w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex h-16 items-center gap-3 border-b px-5"><Search size={20} className="text-slate-400"/><input autoFocus className="flex-1 border-0 text-sm outline-none" placeholder="Search transactions, settings, help…"/><button onClick={() => setSearch(false)} className="rounded border bg-slate-50 px-2 py-1 text-[8px] text-slate-400">ESC</button></div><div className="p-3"><span className="px-2 text-[8px] font-bold tracking-widest text-slate-400">QUICK LINKS</span>{([['Send money',Send],['Manage cards',CreditCard],['Download statement',Download]] as const).map(([label, Icon]) => <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[11px] font-semibold hover:bg-slate-50" key={label as string}><Icon size={17} className="text-slate-500"/>{label as string}</button>)}</div></div></div>}
  </header>;
}

function Balance({ summary, hidden, setHidden, send }: { summary: Summary; hidden: boolean; setHidden: () => void; send: () => void }) {
  return <Card className="p-5">
    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">Total {summary.currency} balance<button onClick={setHidden} className="rounded p-1 hover:bg-slate-100">{hidden ? <Eye size={18}/> : <EyeOff size={18}/>}</button></div>
    <div className="my-2 flex items-start justify-between gap-3 sm:items-center"><div><h2 className="font-display text-[28px] font-bold tracking-[-.05em] sm:text-[32px]">{hidden ? '••••••' : formatMoney(summary.totalBalance,summary.currency)}</h2><p className="mt-1 text-[10px] text-slate-400"><span className="font-bold text-emerald-600">+2.8%</span> from last month</p></div><Button onClick={send} className="size-10 px-0 sm:w-auto sm:px-4"><Send size={16}/><span className="hidden sm:inline">Send money</span></Button></div>
    <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">{summary.accounts.slice(0,2).map((account, index) => <div className="grid grid-cols-[8px_1fr_auto] items-center gap-x-2" key={account.id}><i className={`row-span-2 size-2 rounded-full ${index ? 'bg-emerald-400' : 'bg-cobalt'}`}/><span className="text-[9px] text-slate-400">{account.name}</span><strong className="text-[11px]">{hidden ? '••••••' : formatMoney(account.ledgerBalance,account.currency)}</strong></div>)}</div>
  </Card>;
}

function Stats({ hidden }: { hidden: boolean }) {
  const stats = [
    { title: 'Income', value: '$7,850.00', meta: '+8.2%', icon: ArrowDownLeft, iconClass: 'bg-emerald-50 text-emerald-600' },
    { title: 'Spent this month', value: '$3,019.40', meta: '-4.6%', icon: ArrowUpRight, iconClass: 'bg-orange-50 text-orange-600' },
    { title: 'Savings goal', value: '$12,400.00', meta: '68%', icon: PiggyBank, iconClass: 'bg-indigo-50 text-indigo-600' },
  ];
  return <div className="grid gap-3 sm:grid-cols-3">{stats.map(({ title, value, meta, icon: Icon, iconClass }) => <Card key={title} className="grid grid-cols-[36px_1fr] gap-x-2.5 p-3.5"><span className={`row-span-3 grid size-9 place-items-center rounded-[10px] ${iconClass}`}><Icon size={18}/></span><span className="text-[9px] text-slate-400">{title}</span><strong className="font-display text-[15px]">{hidden ? '$ •••••' : value}</strong><span className={`text-[9px] font-bold ${title === 'Spent this month' ? 'text-orange-500' : 'text-emerald-600'}`}>{meta} <small className="font-normal text-slate-400">vs last month</small></span></Card>)}</div>;
}

const chartValues = { '7D': [44,48,45,55,51,62,66], '1M': [34,37,41,38,45,43,49,54,52,60,58,65], '3M': [38,34,40,43,39,47,45,53,48,57,62,59], '1Y': [28,34,31,38,44,41,48,46,55,58,63,68] };
function CashFlow() {
  const [range, setRange] = useState<keyof typeof chartValues>('1M'); const values = chartValues[range];
  const points = values.map((value,index) => `${index/(values.length-1)*100},${80-value}`).join(' ');
  const area = `M0,${80-values[0]!} ${values.map((value,index)=>`L${index/(values.length-1)*100},${80-value}`).join(' ')} L100,80 L0,80 Z`;
  return <Card className="min-h-[286px] p-5"><div className="flex justify-between"><div><span className="eyebrow">Cash flow</span><div className="mt-2 flex items-center gap-2"><h3 className="font-display text-xl font-bold">+$4,831</h3><span className="rounded-md bg-emerald-50 px-1.5 py-1 text-[8px] font-bold text-emerald-600">+12.4%</span></div></div><div className="flex h-fit rounded-lg bg-slate-100 p-0.5">{Object.keys(chartValues).map((item)=><button key={item} onClick={()=>setRange(item as keyof typeof chartValues)} className={`rounded-md px-2 py-1.5 text-[9px] font-semibold ${range===item?'bg-white text-slate-700 shadow-sm':'text-slate-400'}`}>{item}</button>)}</div></div>
    <div className="mt-5 flex h-[165px]"><div className="flex w-8 flex-col justify-between pb-5 text-[8px] text-slate-400"><span>$8k</span><span>$6k</span><span>$4k</span><span>$2k</span><span>$0</span></div><div className="chart-grid relative flex-1"><svg className="absolute inset-0 h-[calc(100%-20px)] w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 80"><defs><linearGradient id="flowArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#526bf0" stopOpacity=".22"/><stop offset="1" stopColor="#526bf0" stopOpacity="0"/></linearGradient></defs><path d={area} fill="url(#flowArea)"/><polyline points={points} fill="none" stroke="#4963e8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg><div className="absolute inset-x-0 bottom-0 flex justify-between text-[8px] text-slate-400"><span>Sep 1</span><span>Sep 8</span><span>Sep 15</span><span>Sep 22</span><span>Sep 30</span></div></div></div>
  </Card>;
}

function QuickSend({ onSelect }: { onSelect: (name?: string) => void }) {
  return <Card className="p-4"><div className="flex justify-between"><div><span className="eyebrow">Quick send</span><p className="muted mt-1">Your recent contacts</p></div><button className="text-[9px] font-semibold text-indigo-500">Manage ›</button></div><div className="mt-4 flex justify-between">{<button onClick={() => onSelect()} className="flex flex-col items-center gap-1.5"><span className="grid size-9 place-items-center rounded-full border border-dashed border-slate-300 text-slate-500"><Plus size={18}/></span><small className="text-[9px]">New</small></button>}{contacts.map(([name,initials,color])=><button onClick={()=>onSelect(name)} className="flex flex-col items-center gap-1.5" key={name}><span className="grid size-9 place-items-center rounded-full text-[10px] font-bold" style={{background:color}}>{initials}</span><small className="text-[9px]">{name}</small></button>)}</div></Card>;
}

function BankCard() {
  const [frozen,setFrozen]=useState(false);
  return <Card className="p-4"><div className="mb-4 flex justify-between"><div><span className="eyebrow">My card</span><p className="muted mt-1">Physical debit</p></div><MoreHorizontal size={19} className="text-slate-400"/></div><div className={`bank-card relative h-[170px] overflow-hidden rounded-2xl p-4 text-white shadow-xl transition ${frozen?'grayscale':''}`}><div className="flex justify-between"><Brand/><span className="text-[8px] uppercase tracking-[.15em] text-slate-300">debit</span></div><div className="card-chip mt-5 h-5 w-7 rounded-[5px]"/><div className="mt-3 font-display text-xs tracking-[.15em]">•••• &nbsp;•••• &nbsp;•••• &nbsp;1930</div><div className="absolute inset-x-4 bottom-3 z-10 flex items-end gap-7"><div><small className="block text-[5px] tracking-wider text-slate-400">CARD HOLDER</small><strong className="text-[7px] tracking-wider">ALEX MORGAN</strong></div><div><small className="block text-[5px] tracking-wider text-slate-400">EXPIRES</small><strong className="text-[7px]">08/29</strong></div><div className="ml-auto flex"><i className="size-5 rounded-full bg-red-500"/><i className="-ml-2 size-5 rounded-full bg-amber-400 opacity-90"/></div></div>{frozen&&<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm"><Snowflake size={25}/><strong className="mt-2 text-[10px]">Card frozen</strong></div>}</div><div className="mt-3 grid grid-cols-3">{([[Snowflake,frozen?'Unfreeze':'Freeze'],[LockKeyhole,'PIN'],[Settings,'Manage']] as const).map(([Icon,label],index)=><button key={label as string} onClick={()=>index===0&&setFrozen(value=>!value)} className="flex flex-col items-center gap-1.5 border-r border-slate-100 text-[9px] last:border-0"><span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon size={16}/></span>{label as string}</button>)}</div></Card>;
}

function Spending() { return <Card className="p-4"><div className="flex justify-between"><div><span className="eyebrow">Monthly spending</span><p className="muted mt-1">September</p></div><button className="text-[9px] font-semibold text-indigo-500">Details ›</button></div><div className="mt-4 flex items-baseline gap-1.5"><strong className="font-display text-lg">$3,019.40</strong><span className="text-[9px] text-slate-400">of $5,000</span></div><div className="my-2 h-1.5 overflow-hidden rounded bg-slate-100"><i className="block h-full w-[60%] rounded bg-cobalt"/></div><div className="flex justify-between text-[8px] text-slate-400"><span>60% used</span><strong className="font-medium text-slate-500">$1,980.60 left</strong></div><div className="mt-4 flex gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-2.5"><span className="grid size-7 flex-none place-items-center rounded-lg bg-indigo-100 text-indigo-600"><TrendingUp size={16}/></span><p className="text-[9px] leading-relaxed text-slate-500">You’re spending <strong className="text-slate-700">9% less</strong> than this time last month.</p></div></Card>; }

function Activity({ items }: { items: Transaction[] }) {
  const [filter,setFilter]=useState('All'); const shown=items.filter(item=>filter==='All'||(filter==='Money in'?item.amount>0:item.amount<0));
  return <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="eyebrow">Recent activity</span><p className="muted mt-1">Your latest account movements</p></div><div className="flex rounded-lg bg-slate-100 p-0.5">{['All','Money in','Money out'].map(item=><button key={item} onClick={()=>setFilter(item)} className={`rounded-md px-2.5 py-1.5 text-[9px] ${filter===item?'bg-white font-semibold shadow-sm':'text-slate-400'}`}>{item}</button>)}</div></div><div className="mt-3">{shown.length===0&&<p className="border-t border-slate-100 py-8 text-center text-[10px] text-slate-400">No posted transactions yet.</p>}{shown.map(item=>{const Icon=item.icon;return <button className="grid w-full grid-cols-[38px_1fr_auto_16px] items-center gap-3 border-t border-slate-100 py-2.5 text-left transition hover:bg-slate-50" key={item.id}><span className={`grid size-9 place-items-center rounded-[11px] ${item.tone}`}><Icon size={18}/></span><span className="flex min-w-0 flex-col"><strong className="truncate text-[11px]">{item.name}</strong><small className="truncate text-[9px] text-slate-400">{item.detail}</small></span><strong className={`text-[11px] ${item.amount>0?'text-emerald-600':''}`}>{item.amount>0?'+':''}{formatMoney(item.amount,item.currency)}</strong><ChevronRight size={16} className="text-slate-300"/></button>})}</div></Card>;
}

function Overview({ summary, onRefresh }: { summary: Summary; onRefresh: () => Promise<void> }) {
  const [hidden,setHidden]=useState(false); const [sendOpen,setSendOpen]=useState(false); const [selected,setSelected]=useState<string>(); const [transactions,setTransactions]=useState<Transaction[]>([]); const [toast,setToast]=useState('');
  const checking=summary.accounts[0];
  const loadTransactions=useCallback(async()=>{try{const result=await api<{items:Array<{id:string;type:string;amount:string;currency:string;description:string;merchantName:string|null;category:string|null;postedAt:string|null;createdAt:string}>}>('/banking/transactions',{retry:false});setTransactions(result.items.map(item=>{const amount=Number(item.amount);const date=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(item.postedAt??item.createdAt));return{id:item.id,name:item.merchantName??item.description,detail:`${item.category??item.type.replaceAll('_',' ')} · ${date}`,amount,currency:item.currency,icon:amount>=0?CircleDollarSign:ShoppingBag,tone:amount>=0?'bg-emerald-50 text-emerald-600':'bg-orange-50 text-orange-600'}}))}catch{/* Keep the last server response; never synthesize account activity. */}},[]);
  useEffect(()=>{void loadTransactions()},[loadTransactions]);
  function openSend(name?:string){setSelected(name);setSendOpen(true)}
  async function complete(amount:number,name:string){
    await Promise.all([onRefresh(),loadTransactions()]);
    setToast(`${formatMoney(amount,checking?.currency??summary.currency)} sent to ${name}`);
    setTimeout(()=>setToast(''),3500);
  }
  return <><div className="mb-6 flex items-end justify-between"><div><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><CalendarDays size={14}/>Monday, September 30</p><h1 className="mt-1 font-display text-[27px] font-bold tracking-tight">Good morning, Alex.</h1><p className="mt-1 text-xs text-slate-400">Here’s what’s happening with your money today.</p></div><Button variant="secondary" className="hidden sm:flex"><Download size={16}/>Download statement</Button></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><main className="flex min-w-0 flex-col gap-4"><Balance summary={summary} hidden={hidden} setHidden={()=>setHidden(value=>!value)} send={()=>openSend()}/><Stats hidden={hidden}/><CashFlow/></main><aside className="grid gap-4 md:grid-cols-2 xl:flex xl:flex-col"><QuickSend onSelect={openSend}/><BankCard/><div className="md:col-span-2 xl:col-span-1"><Spending/></div></aside><div className="xl:col-span-2"><Activity items={transactions}/></div></div>{checking&&<SendMoneyDialog open={sendOpen} accountId={checking.id} available={Number(checking.availableBalance)} initialPerson={selected} onClose={()=>setSendOpen(false)} onComplete={complete}/>}{toast&&<div className="toast-in fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-navy py-3 pl-3 pr-5 text-[11px] text-white shadow-2xl"><span className="grid size-6 place-items-center rounded-md bg-emerald-500"><ShieldCheck size={14}/></span>{toast}</div>}</>;
}

function PlaceholderPage({ active, summary }: { active: string; summary: Summary }) {
  const copy: Record<string,[string,string]>={Accounts:['Your accounts','All your balances, organized in one place.'],Cards:['Cards','Manage cards and spending controls.'],Payments:['Payments','Send, schedule, and track payments.'],Analytics:['Analytics','Understand your spending and make smarter decisions.'],Settings:['Settings','Manage profile, security, and preferences.']}; const [title,subtitle]=copy[active]??[active,''];
  return <div><div className="mb-6"><span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">Haven banking</span><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div>{active==='Accounts'?<div className="grid gap-4 md:grid-cols-2">{summary.accounts.map((account,index)=><Card className="p-5" key={account.id}><div className="flex items-center"><span className={`grid size-11 place-items-center rounded-xl ${index?'bg-emerald-50 text-emerald-600':'bg-indigo-50 text-indigo-600'}`}>{index?<PiggyBank size={21}/>:<Landmark size={21}/>}</span><div className="ml-3"><strong className="block text-xs">{account.name}</strong><span className="text-[9px] text-slate-400">Haven Bank ·•••• {account.last4}</span></div><ChevronRight className="ml-auto text-slate-300" size={18}/></div><strong className="mt-6 block font-display text-2xl">{formatMoney(account.availableBalance,account.currency)}</strong><span className="text-[9px] text-slate-400">Available balance</span></Card>)}</div>:<Card className="grid min-h-[420px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles size={24}/></span><h2 className="mt-4 font-display text-lg font-bold">{active} workspace</h2><p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-slate-400">The secure service layer and navigation are ready. Connect your live banking data to activate this workspace.</p></div></Card>}</div>;
}

export function Dashboard() {
  const [menuOpen,setMenuOpen]=useState(false); const [active,setActive]=useState('Overview'); const [summary,setSummary]=useState<Summary | null>(null); const [summaryError,setSummaryError]=useState(false);
  const refreshSummary=useCallback(async()=>{try{const next=await api<Summary>('/banking/summary',{retry:false});setSummary(next);setSummaryError(false)}catch{setSummaryError(true)}},[]);
  useEffect(()=>{void refreshSummary()},[refreshSummary]);
  const content=useMemo(()=>summary?(active==='Overview'?<Overview summary={summary} onRefresh={refreshSummary}/>:<WorkspacePage active={active} summary={summary}/>):<Card className="grid min-h-[420px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Landmark size={24}/></span><h2 className="mt-4 font-display text-lg font-bold">{summaryError?'Balances unavailable':'Loading balances'}</h2><p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-slate-400">{summaryError?'We could not securely retrieve your ledger balances. Try again.':'Calculating your balances from posted ledger entries.'}</p>{summaryError&&<Button className="mt-4" onClick={()=>void refreshSummary()}>Try again</Button>}</div></Card>,[active,refreshSummary,summary,summaryError]);
  return <div className="min-h-screen"><Sidebar open={menuOpen} active={active} setActive={setActive} close={()=>setMenuOpen(false)}/><div className="min-h-screen lg:ml-[244px]"><Header active={active} menu={()=>setMenuOpen(true)}/><main className="mx-auto max-w-[1450px] p-5 sm:p-7 lg:p-8">{content}</main></div></div>;
}
