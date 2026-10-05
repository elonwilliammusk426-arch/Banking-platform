import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Haven — Your money, in focus', template: '%s · Haven' },
  description: 'Secure, modern personal banking built around your life.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="bg-canvas font-sans text-ink antialiased">{children}</body></html>;
}
