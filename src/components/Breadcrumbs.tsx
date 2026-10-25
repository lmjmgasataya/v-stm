import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-stone-400 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="select-none">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-stm-brand transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-stone-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
