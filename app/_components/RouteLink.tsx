import Link from "next/link";

type RouteLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "gold" | "outline" | "text";
};

export function RouteLink({ href, children, variant = "gold" }: RouteLinkProps) {
  return (
    <Link className={`route-link route-link--${variant}`} href={href}>
      <span>{children}</span>
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
