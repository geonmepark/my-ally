import type { Metadata } from 'next';
import { Providers } from '@/components/common/Providers';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'My Ally Admin',
  description: 'My Ally Admin Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
