/**
 * Layout for /api/v1/docs.
 *
 * Renders Scalar full-screen without dashboard chrome.
 * Body styles are reset to let Scalar control its own layout.
 */

import type { ReactNode } from "react";

export const metadata = {
  title: "Reyna Pay Engine API — Documentation",
  description:
    "Interactive API documentation for the Reyna Pay payments engine. Charges, customers, saved cards, multi-location, risk monitoring, webhooks, and more.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: "100vh", width: "100vw", margin: 0, padding: 0 }}>
      {children}
    </div>
  );
}
