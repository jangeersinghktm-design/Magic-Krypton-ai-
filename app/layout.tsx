import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata = {
  title: "Krypton AI",
  description: "Build anything with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
