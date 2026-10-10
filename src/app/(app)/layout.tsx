// Signed-in shell: sidebar + top bar around every management page.
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/server/repo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const company = await getCompany(user.companyId);
  // Remember the collapsed/expanded sidebar across reloads (cookie written by SidebarProvider).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar user={{ name: user.name, email: user.email }} companyName={company?.name ?? "Your company"} />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
