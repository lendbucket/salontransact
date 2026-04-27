"use client";

import Image from "next/image";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col-reverse md:flex-row" style={{ background: "#FBFBFB" }}>
      {/* Form column */}
      <div
        className="flex-1 flex flex-col justify-center px-6 py-12 md:px-20 md:py-16 w-full"
        style={{ maxWidth: 640 }}
      >
        <div style={{ marginBottom: 40 }}>
          <Image
            src="/salontransact-logo.png"
            alt="SalonTransact"
            width={240}
            height={40}
            priority
            style={{ height: 40, width: "auto", objectFit: "contain" }}
          />
        </div>

        {children}

        <div style={{ marginTop: "auto", paddingTop: 48 }}>
          <p style={{ fontSize: 12, color: "#878787" }}>
            &copy; 2026 SalonTransact. All rights reserved.
          </p>
        </div>
      </div>

      {/* Photo column — desktop */}
      <div
        className="hidden md:block flex-1 relative"
        style={{
          backgroundImage: "url('/auth-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(1,126,167,0.10) 0%, rgba(1,126,167,0.20) 100%)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: 16,
            right: 16,
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Photo: SumUp via Unsplash
        </div>
      </div>

      {/* Photo column — mobile (small hero at top, rendered last in DOM but first visually via flex-col-reverse) */}
      <div
        className="md:hidden"
        style={{
          height: 200,
          backgroundImage: "url('/auth-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background:
              "linear-gradient(180deg, rgba(1,126,167,0.10) 0%, rgba(1,126,167,0.30) 100%)",
          }}
        />
      </div>
    </div>
  );
}
