'use client';

import { useState } from 'react';
import { Check, ChevronDown, Send, ShieldCheck, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from './ui/button';

const people = [
  { name: 'Maya Kim', initials: 'MK', account: '•• 4021', color: '#e9c9af' },
  { name: 'Liam Wong', initials: 'LW', account: '•• 6184', color: '#bdddd3' },
  { name: 'Sofia Reyes', initials: 'SR', account: '•• 9037', color: '#cbd2f2' },
  { name: 'Noah Brooks', initials: 'NB', account: '•• 2215', color: '#efd5a6' },
];

interface Props {
  open: boolean;
  accountId: string;
  available: number;
  initialPerson?: string;
  onClose: () => void;
  onComplete: (amount: number, recipient: string) => void;
}

export function SendMoneyDialog({ open, accountId, available, initialPerson, onClose, onComplete }: Props) {
  const [personIndex, setPersonIndex] = useState(() => Math.max(0, people.findIndex((person) => person.name.startsWith(initialPerson ?? ''))));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  const person = people[personIndex] ?? people[0]!;
  const value = Number(amount);

  function close() { setStep('form'); setAmount(''); setNote(''); setError(''); onClose(); }
  function review() {
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than $0.');
    if (value > available) return setError('This amount is higher than your available balance.');
    setError(''); setStep('review');
  }
  async function send() {
    setLoading(true);
    try {
      if (!accountId.startsWith('demo-')) {
        await api('/banking/transfers', {
          method: 'POST',
          headers: { 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ fromAccountId: accountId, externalRecipientName: person.name, amount: value, note: note || undefined }),
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
      setStep('success');
      setTimeout(() => { onComplete(value, person.name); close(); }, 900);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Transfer failed'); setStep('form'); }
    finally { setLoading(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b1321]/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && close()}>
    <div role="dialog" aria-modal="true" aria-label="Send money" className="modal-in relative w-full max-w-[430px] rounded-[20px] bg-white p-7 shadow-2xl">
      <button aria-label="Close" onClick={close} className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18}/></button>
      {step === 'form' && <>
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-indigo-50 text-cobalt"><Send size={21}/></div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Send money</h2>
        <p className="mt-1 text-[11px] text-slate-400">Fast, secure, and fee-free.</p>
        <label className="mb-2 mt-6 block text-[10px] font-bold text-slate-600">Send to</label>
        <div className="relative flex h-14 items-center gap-3 rounded-xl border border-slate-200 px-3">
          <span className="grid size-9 place-items-center rounded-full text-[10px] font-bold" style={{ background: person.color }}>{person.initials}</span>
          <div className="flex flex-col"><strong className="text-[11px]">{person.name}</strong><span className="text-[9px] text-slate-400">Haven account {person.account}</span></div>
          <select className="absolute inset-0 cursor-pointer opacity-0" value={personIndex} onChange={(event) => setPersonIndex(Number(event.target.value))} aria-label="Recipient">
            {people.map((item, index) => <option value={index} key={item.name}>{item.name}</option>)}
          </select>
          <ChevronDown size={17} className="ml-auto text-slate-400"/>
        </div>
        <label className="mb-2 mt-5 block text-[10px] font-bold text-slate-600">Amount</label>
        <div className={`flex h-16 items-center rounded-xl border px-4 focus-within:ring-4 ${error ? 'border-red-300 focus-within:ring-red-50' : 'border-slate-200 focus-within:border-cobalt focus-within:ring-indigo-50'}`}>
          <span className="font-display text-2xl font-semibold text-slate-400">$</span>
          <input autoFocus value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" inputMode="decimal" className="min-w-0 flex-1 border-0 bg-transparent px-2 font-display text-2xl font-bold outline-none placeholder:text-slate-300"/>
          <span className="text-[10px] font-semibold text-slate-400">USD</span>
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>Available to send</span><strong className="text-slate-600">{formatMoney(available)}</strong></div>
        {error && <p role="alert" className="mt-2 text-[10px] font-medium text-red-600">{error}</p>}
        <label className="mb-2 mt-5 block text-[10px] font-bold text-slate-600">Note <span className="font-normal text-slate-400">optional</span></label>
        <input className="field" maxLength={140} placeholder="What’s this for?" value={note} onChange={(event) => setNote(event.target.value)}/>
        <Button className="mt-5 w-full" onClick={review}>Review transfer <Send size={16}/></Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-slate-400"><ShieldCheck size={14}/> Protected by Haven Secure</p>
      </>}
      {step === 'review' && <div className="text-center">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-indigo-50 text-cobalt"><ShieldCheck size={21}/></div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Review transfer</h2><p className="mt-1 text-[11px] text-slate-400">Make sure everything looks right.</p>
        <span className="mx-auto mt-6 grid size-16 place-items-center rounded-full text-sm font-bold" style={{ background: person.color }}>{person.initials}</span>
        <strong className="mt-2 block text-sm">{person.name}</strong><span className="text-[9px] text-slate-400">Haven account {person.account}</span>
        <div className="my-5 font-display text-3xl font-bold tracking-tight">{formatMoney(value)}</div>
        <div className="rounded-xl bg-slate-50 px-4 py-2 text-[10px]">
          <div className="flex justify-between border-b border-slate-200 py-2.5"><span className="text-slate-400">Transfer fee</span><strong>$0.00</strong></div>
          <div className="flex justify-between border-b border-slate-200 py-2.5"><span className="text-slate-400">Arrives</span><strong>In seconds</strong></div>
          {note && <div className="flex justify-between py-2.5"><span className="text-slate-400">Note</span><strong>{note}</strong></div>}
        </div>
        {error && <p className="mt-3 text-[10px] text-red-600">{error}</p>}
        <Button className="mt-5 w-full" disabled={loading} onClick={send}>{loading ? 'Sending…' : 'Confirm & send'} <Send size={16}/></Button>
        <Button variant="ghost" className="mt-1 w-full" onClick={() => setStep('form')}>Back</Button>
      </div>}
      {step === 'success' && <div className="py-12 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={31}/></div>
        <h2 className="font-display text-2xl font-bold">Money sent</h2><p className="mt-2 text-xs text-slate-400">{formatMoney(value)} is on its way to {person.name}.</p>
      </div>}
    </div>
  </div>;
}
