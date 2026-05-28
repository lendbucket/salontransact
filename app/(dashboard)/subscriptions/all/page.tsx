import { Suspense } from "react";
import { AllListClient } from "./all-list-client";

export default function AllSubscriptionsPage() {
  return (
    <Suspense>
      <AllListClient />
    </Suspense>
  );
}
