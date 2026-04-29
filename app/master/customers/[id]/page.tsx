import { requireMaster } from "@/lib/session";
import { CustomerDetailClient } from "@/app/(dashboard)/customers/[id]/customer-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MasterCustomerDetailPage({ params }: PageProps) {
  await requireMaster();
  const { id } = await params;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <CustomerDetailClient customerId={id} mode="master" />
    </div>
  );
}
