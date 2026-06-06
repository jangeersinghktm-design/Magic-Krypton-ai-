"use client";

import "./globals.css";
import KryptonSidebar from "@/components/KryptonSidebar";
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const noSidebar = ["/landing", "/auth", "/create"];
  const showSidebar = !noSidebar.some((p) => pathname.startsWith(p));

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#050505" }}>
        <style>{`
          @media (max-width: 767px) {
            .main-content { margin-left: 0 !important; }
          }
        `}</style>
        <div style={{ display: "flex" }}>
          {showSidebar && <KryptonSidebar />}
          <main
            className="main-content"
            style={{
              marginLeft: showSidebar ? "240px" : "0",
              flex: 1,
              minHeight: "100vh",
              transition: "margin-left 0.25s ease",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
