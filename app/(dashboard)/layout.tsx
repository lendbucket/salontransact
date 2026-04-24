import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, BottomNav } from "@/components/dashboard-nav";
import { Topbar } from "@/components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;

  if (role === "admin") {
    redirect("/admin");
  }

  const merchant = userId
    ? await prisma.merchant.findUnique({ where: { userId } })
    : null;

  if (!merchant) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar businessName={merchant.businessName} plan={merchant.plan} />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
