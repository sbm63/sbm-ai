import Navbar from '@/components/Navbar';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import PlausibleProvider from 'next-plausible';
import AuthGuard from '@/components/AuthGuard';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

let title = 'Diskiao AI - Interview Management Platform';
let description = 'AI-powered interview platform for candidate assessment';
let url = 'https://www.diskiao.ai';
let ogimage = 'https://www.diskiao.ai/og-image.png';
let sitename = 'Diskiao AI';

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    images: [ogimage],
    title,
    description,
    url: url,
    siteName: sitename,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    images: [ogimage],
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <PlausibleProvider domain="diskiao.ai" />
      </head>
      <body className={inter.className}>
        <Navbar />
        <AuthGuard>
          <main>{children}</main>

          <Footer />
        </AuthGuard>
      </body>
    </html>
  );
}
