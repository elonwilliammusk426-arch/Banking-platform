'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function MfaPage(){
  const router=useRouter();const [digits,setDigits]=useState(['','','','','','']);const [error,setError]=useState('');const [loading,setLoading]=useState(false);const refs=useRef<Array<HTMLInputElement|null>>([]);
  useEffect(()=>{if(!sessionStorage.getItem('haven_mfa_challenge'))router.replace('/login')},[router]);
  function update(index:number,value:string){const next=[...digits];next[index]=(value.match(/\d/g)??[]).at(-1)??'';setDigits(next);if(next[index]&&index<5)refs.current[index+1]?.focus()}
  function key(index:number,key:string){if(key==='Backspace'&&!digits[index]&&index>0)refs.current[index-1]?.focus()}
  async function submit(event:FormEvent){event.preventDefault();const code=digits.join('');if(code.length!==6)return setError('Enter the complete 6-digit code.');setLoading(true);setError('');try{await api('/auth/mfa/verify',{method:'POST',body:JSON.stringify({code,challengeToken:sessionStorage.getItem('haven_mfa_challenge')}),retry:false});sessionStorage.removeItem('haven_mfa_challenge');router.push('/')}catch(caught){setError(caught instanceof Error?caught.message:'Invalid authentication code')}finally{setLoading(false)}}
  return <main className="grid min-h-screen place-items-center bg-canvas p-5"><div className="w-full max-w-[430px] rounded-[22px] border border-slate-200 bg-white p-8 text-center shadow-soft sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-cobalt"><ShieldCheck size={27}/></span><h1 className="mt-5 font-display text-2xl font-bold tracking-tight">Verify it’s you</h1><p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed text-slate-400">Enter the six-digit code from your authenticator app to continue.</p><form onSubmit={submit}><div className="my-7 flex justify-center gap-2">{digits.map((digit,index)=><input key={index} ref={element=>{refs.current[index]=element}} value={digit} onChange={event=>update(index,event.target.value)} onKeyDown={event=>key(index,event.key)} inputMode="numeric" autoComplete={index===0?'one-time-code':'off'} aria-label={`Digit ${index+1}`} className="h-12 w-11 rounded-xl border border-slate-200 text-center font-display text-lg font-bold outline-none transition focus:border-cobalt focus:ring-4 focus:ring-indigo-50"/> )}</div>{error&&<p className="mb-4 text-[10px] font-medium text-red-600">{error}</p>}<Button className="w-full" disabled={loading}>{loading?'Verifying…':'Verify and continue'}</Button></form><button onClick={()=>router.push('/login')} className="mx-auto mt-5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-ink"><ArrowLeft size={14}/>Back to sign in</button><div className="mt-7 border-t border-slate-100 pt-5 text-[9px] text-slate-400">Can’t access your authenticator? <button className="font-semibold text-indigo-600">Use a recovery code</button></div></div></main>
}
