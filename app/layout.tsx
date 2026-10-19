import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAMPUS360 | Aditya College of Engineering and Technology",
  description: "A confidential student voice and college issue resolution portal.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
