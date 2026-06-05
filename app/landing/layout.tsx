export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#050505" }}>
        {children}
      </body>
    </html>
  );
}
