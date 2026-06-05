import KryptonSidebar from "@/components/KryptonSidebar";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex" }}>
      <KryptonSidebar />
      <main style={{ marginLeft: "240px", flex: 1, minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
