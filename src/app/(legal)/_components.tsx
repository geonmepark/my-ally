export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-foreground text-lg font-semibold sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-foreground/90 mt-4 text-sm font-semibold">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground/90 text-sm leading-relaxed">{children}</p>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-foreground/90 list-disc space-y-1 pl-5 text-sm leading-relaxed">
      {children}
    </ul>
  );
}
