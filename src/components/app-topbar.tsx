"use client";
// Sticky bar above every app page: sidebar toggle, breadcrumb from the path, theme and "New decision".
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { Plus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  decisions: "Decisions",
  suppliers: "Suppliers",
  financing: "Financing",
  inbox: "Inbox",
  settings: "Settings",
};

type Crumb = { label: string; href: string };

// "/decisions/abc" → Dashboard / Decisions / Decision
export function crumbsFor(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/dashboard" }];
  if (segments[0] === "dashboard" || segments.length === 0) return crumbs;
  segments.forEach((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = i === 0 ? (SECTION_LABELS[segment] ?? capitalise(segment)) : segments[0] === "decisions" ? "Decision" : capitalise(segment);
    crumbs.push({ label, href });
  });
  return crumbs;
}

function capitalise(s: string): string {
  return decodeURIComponent(s).replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function AppTopbar() {
  const crumbs = crumbsFor(usePathname());

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                {i > 0 && <BreadcrumbSeparator className={i < crumbs.length - 1 ? "hidden sm:block" : undefined} />}
                <BreadcrumbItem className={last ? "min-w-0" : "hidden sm:inline-flex"}>
                  {last ? (
                    <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="hidden border-warning/40 bg-warning/10 text-warning sm:inline-flex">
          Demo data
        </Badge>
        <ThemeToggle />
        <Button nativeButton={false} render={<Link href="/decisions?new=1" />}>
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">New decision</span>
        </Button>
      </div>
    </header>
  );
}
