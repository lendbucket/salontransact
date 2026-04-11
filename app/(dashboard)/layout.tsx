import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, BottomNav } from "@/components/dashboard-nav";
import { Providers } from "@/components/providers";

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
  const merchant = userId
    ? await prisma.merchant.findUnique({ where: { userId } })
    : null;

  if (!merchant) {
    redirect("/login");
  }

  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar businessName={merchant.businessName} plan={merchant.plan} />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <BottomNav />
      </div>
    </Providers>
  );
}
