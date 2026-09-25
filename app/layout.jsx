import "./globals.css";

export const metadata = { title: "CyberSentinel", description: "Deterministic security monitoring" };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
