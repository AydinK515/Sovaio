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
  title: {
    template: "%s | Sovaio",
    default: "Sovaio | YouTube Sponsorship Pricing & AI Deal Guidance",
  },
  description: siteDescription,
  keywords: [
    "YouTube sponsorship",
    "sponsorship rate card",
    "YouTube analytics",
    "brand deal negotiation",
    "creator monetization",
    "YouTube CPM",
    "influencer pricing",
    "YouTube creator tools",
    "AI deal guidance",
    "sponsorship valuation",
  ],
  authors: [{ name: "Sovaio", url: "https://sovaio.com" }],
  creator: "Sovaio",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Sovaio | YouTube Sponsorship Pricing & AI Deal Guidance",
    description: siteDescription,
    url: "https://sovaio.com",
    siteName: "Sovaio",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/sovaiolandingpage.PNG",
        width: 2355,
        height: 1349,
        alt: "Sovaio — stop leaving money on the table. Get a data-backed sponsorship rate card and AI deal guidance.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovaio | YouTube Sponsorship Pricing & AI Deal Guidance",
    description: siteDescription,
    images: [
      {
        url: "/sovaiolandingpage.PNG",
        width: 2355,
        height: 1349,
        alt: "Sovaio — stop leaving money on the table. Get a data-backed sponsorship rate card and AI deal guidance.",
      },
    ],
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
