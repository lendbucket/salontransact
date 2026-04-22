import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, BottomNav } from "@/components/dashboard-nav";

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

  // Admin users don't have merchant records — send them to admin panel
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
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
