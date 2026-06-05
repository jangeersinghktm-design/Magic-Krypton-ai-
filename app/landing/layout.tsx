export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginLeft: 0 }}>
      {children}
    </div>
  );
}
