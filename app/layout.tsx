import type { Metadata } from "next";
import "./globals.css";
import KryptonSidebar from "@/components/KryptonSidebar";

export const metadata: Metadata = {
  title: "Krypton AI - Build Anything with AI",
  description: "Create websites, apps, games with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#050505" }}>
        <div style={{ display: "flex" }}>
          <KryptonSidebar />
          <main style={{ marginLeft: "240px", flex: 1, minHeight: "100vh" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
