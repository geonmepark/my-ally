import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: true, follow: false },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background text-foreground min-h-dvh">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">{children}</div>
    </main>
  );
}
