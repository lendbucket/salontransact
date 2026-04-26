import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar, BottomNav } from "@/components/dashboard-nav";
import { Topbar } from "@/components/topbar";

export default async function MasterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;

  if (!user || user.role !== "master portal") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FBFBFB]">
        <div
          className="max-w-md text-center px-8 py-12 bg-white rounded-2xl"
          style={{
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)",
          }}
        >
          <h1
            className="text-2xl font-semibold text-[#1A1313] mb-2"
            style={{ letterSpacing: "-0.31px" }}
          >
            Access denied
          </h1>
          <p className="text-sm text-[#878787] leading-[20px]">
            This area is restricted to master portal users.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        businessName="Master Portal"
        plan="admin"
        role="master portal"
      />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
