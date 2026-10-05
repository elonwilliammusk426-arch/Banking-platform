import Link from 'next/link';

export default function NotFound(){return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center"><div><span className="font-display text-8xl font-bold text-indigo-100">404</span><h1 className="mt-2 font-display text-2xl font-bold">Page not found</h1><p className="mt-2 text-xs text-slate-400">The page you’re looking for doesn’t exist.</p><Link href="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-cobalt px-4 text-xs font-semibold text-white">Back to dashboard</Link></div></main>}
