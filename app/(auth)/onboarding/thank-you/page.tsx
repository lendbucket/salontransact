import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AuthLayout from "@/components/auth/AuthLayout";

export const dynamic = "force-dynamic";

export default async function ThankYouPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user?.id) redirect("/login");

  const app = await prisma.merchantApplication.findUnique({
    where: { userId: user.id },
    select: { status: true, submittedAt: true },
  });

  if (!app) redirect("/onboarding");

  return (
    <AuthLayout>
      <h1
        className="text-2xl font-semibold text-[#1A1313]"
        style={{ letterSpacing: "-0.31px" }}
      >
        Application submitted
      </h1>
      <p className="text-sm text-[#878787] mt-2 mb-8">
        Thanks for applying to SalonTransact. Here&apos;s what happens next.
      </p>

      <div className="space-y-4 mb-8">
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#017ea7] text-white flex items-center justify-center text-xs font-medium">
            1
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A1313]">
              Review (1-3 business days)
            </p>
            <p className="text-sm text-[#4A4A4A]">
              We&apos;ll review your application and verify the information you
              provided.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E8EAED] text-[#878787] flex items-center justify-center text-xs font-medium">
            2
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A1313]">
              Sign the merchant agreement
            </p>
            <p className="text-sm text-[#4A4A4A]">
              Complete your SalonTransact merchant agreement to begin processing.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E8EAED] text-[#878787] flex items-center justify-center text-xs font-medium">
            3
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A1313]">
              Start accepting payments
            </p>
            <p className="text-sm text-[#4A4A4A]">
              Once approved, your portal unlocks and you can start processing.
            </p>
          </div>
        </div>
      </div>

      {/* TODO: Replace with real Agreement Express URL */}
      <a
        href="https://agreement-express-placeholder.example.com"
        className="inline-flex items-center justify-center w-full md:w-auto px-6 h-11 rounded-lg text-sm font-medium text-white"
        style={{
          background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
          border: "1px solid #015f80",
          textDecoration: "none",
        }}
      >
        Continue to merchant agreement &rarr;
      </a>

      <p className="text-xs text-[#878787] mt-4">
        Questions? Email{" "}
        <a
          href="mailto:support@salontransact.com"
          className="text-[#017ea7]"
          style={{ textDecoration: "none" }}
        >
          support@salontransact.com
        </a>
      </p>
    </AuthLayout>
  );
}
