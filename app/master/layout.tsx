import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function MasterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;

  if (!user || user.role !== "master portal") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#06080d] text-white">
        <div className="max-w-md text-center px-6">
          <h1 className="text-2xl font-semibold mb-3">Access denied</h1>
          <p className="text-gray-400 text-sm">
            This area is restricted to master portal users.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06080d] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
    </main>
  );
}
