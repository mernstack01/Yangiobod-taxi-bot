import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taxi Bot Admin',
  description: 'Taxi Bot Admin Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
