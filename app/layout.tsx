import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatKut - AI-Powered Video Editor",
  description: "Create professional videos with natural language commands",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
