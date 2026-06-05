"use client";

import { usePathname } from "next/navigation";
import KryptonSidebar from "./KryptonSidebar";

export default function SidebarWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const noSidebar = ["/landing", "/auth/login", "/auth/signup"];
  const showSidebar = !noSidebar.some((p) => pathname.startsWith(p));

  return (
    <div style={{ display: "flex" }}>
      {showSidebar && <KryptonSidebar />}
      <main style={{
        marginLeft: showSidebar ? "240px" : "0",
        flex: 1,
        minHeight: "100vh",
      }}>
        {children}
      </main>
    </div>
  );
}
