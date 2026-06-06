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
        <div style={{ display: "flex" }}>
          {showSidebar && <KryptonSidebar />}
          <main style={{
            marginLeft: showSidebar ? "240px" : "0",
            flex: 1, minHeight: "100vh"
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
