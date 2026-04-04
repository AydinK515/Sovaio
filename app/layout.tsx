import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PostHogProvider from "@/components/posthog-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Generate data-backed sponsorship rate cards from your YouTube analytics and negotiate better brand deals with AI-powered guidance.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sovaio.com"),
  title: "Sovaio | YouTube sponsorship pricing and deal guidance",
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Sovaio",
    description: siteDescription,
    url: "https://sovaio.com",
    siteName: "Sovaio",
    type: "website",
    images: [
      {
        url: "/sovaiobanner.png",
        width: 1536,
        height: 1024,
        alt: "Sovaio banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovaio",
    description: siteDescription,
    images: ["/sovaiobanner.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/favicon-32x32.png",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
