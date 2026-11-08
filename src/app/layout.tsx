import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: 'LaCarte Customer — Waste Management & Supplies',
  description:
    'Schedule waste pickups, track drivers live, manage subscriptions, and shop waste management supplies.',
  icons: {
    icon: '/images/logo-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen bg-[#F9FAFC] text-[#0A0D12] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

