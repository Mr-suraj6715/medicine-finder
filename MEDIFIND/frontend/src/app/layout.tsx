import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediFind – Find Cheapest Medicine Near You",
  description: "Compare medicine prices across 500+ verified local pharmacies. Save money on prescriptions with MediFind.",
  keywords: "medicine, pharmacy, cheap medicine, drug store, healthcare",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
