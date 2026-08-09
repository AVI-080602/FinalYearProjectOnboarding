"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Plan a route" },
  { href: "/quiet-spaces", label: "Quiet spaces" },
  { href: "/add-a-calm-space", label: "Suggest a place" },
];

export default function AppHeader({
  statusChip,
}: {
  statusChip?: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-euca text-sm font-extrabold text-card">
            SN
          </span>
          <span className="font-display text-lg text-ink">
            Sensory Navigator
          </span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                  active
                    ? "bg-eucasoft text-euca"
                    : "text-inksoft hover:bg-mist hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {statusChip && <div className="ml-auto">{statusChip}</div>}
      </div>
    </header>
  );
}
