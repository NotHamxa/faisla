"use client";
// Main navigation: brand + company, nav groups, settings and the signed-in user's menu.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  ChevronsUpDown,
  FilePlus2,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Palette,
  Settings,
  Store,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { BrandMark } from "@/components/brand";
import { ThemeRadioItems } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = { title: string; href: string; icon: LucideIcon; match?: (path: string) => boolean };

const NAV: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Decisions",
    items: [
      { title: "All decisions", href: "/decisions", icon: ListChecks },
      // Plain link until the shared NewDecisionDialog lands; /decisions opens it from ?new=1.
      { title: "New decision", href: "/decisions?new=1", icon: FilePlus2, match: () => false },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Suppliers", href: "/suppliers", icon: Store },
      { title: "Financing", href: "/financing", icon: Landmark },
      { title: "Inbox", href: "/inbox", icon: Inbox },
    ],
  },
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppSidebar({
  user,
  companyName,
}: {
  user: { name: string; email: string };
  companyName: string;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [signingOut, startSignOut] = useTransition();
  // Close the mobile sheet after navigating.
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Dashboard" render={<Link href="/dashboard" onClick={onNavigate} />}>
              <BrandMark />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-heading text-[0.9375rem] font-bold">Faisla</span>
                <span className="truncate text-xs text-muted-foreground">{companyName}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item, pathname)}
                      tooltip={item.title}
                      render={<Link href={item.href} onClick={onNavigate} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/settings")}
              tooltip="Settings"
              render={<Link href="/settings" onClick={onNavigate} />}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground" />}
              >
                <Avatar className="size-8 rounded-lg after:rounded-lg">
                  <AvatarFallback className="rounded-lg border border-sidebar-border bg-sidebar font-mono text-xs font-medium text-foreground">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={6} className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1.5 py-1.5 text-left text-sm">
                      <Avatar className="size-8 rounded-lg after:rounded-lg">
                        <AvatarFallback className="rounded-lg border border-border bg-card font-mono text-xs font-medium text-foreground">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 leading-tight">
                        <span className="truncate font-medium text-foreground">{user.name}</span>
                        <span className="truncate text-xs">{companyName}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/settings" onClick={onNavigate} />}>
                    <Settings />
                    Company settings
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette />
                      Theme
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-36">
                      <ThemeRadioItems />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={() => startSignOut(() => logout())}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
