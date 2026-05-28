import { Suspense } from "react";
import { SubscriptionDetailClient } from "./subscription-detail-client";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <SubscriptionDetailClient subscriptionId={id} />
    </Suspense>
  );
}
