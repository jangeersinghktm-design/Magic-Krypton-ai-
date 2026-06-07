"use client";

import KryptonSidebar from "@/components/KryptonSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const noSidebar = ["/landing", "/auth", "/create", "/share"];
  const showSidebar = !noSidebar.some((p) => pathname.startsWith(p));

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
