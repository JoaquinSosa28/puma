import Link from "next/link";
import { cn } from "@/lib/utils";

export function WidgetHeaderLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mx-1 mb-3 flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-hover",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function WidgetRowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg transition-colors hover:bg-hover",
        className
      )}
    >
      {children}
    </Link>
  );
}
