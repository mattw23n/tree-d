import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "API-to-3D Pipeline | Met Museum Art Converter",
  description: "Convert 2D painting data from the Met Museum API into 1:1 scale 3D GLB models",
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
