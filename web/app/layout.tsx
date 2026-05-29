import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_TITLE = "DOD — Live India Design Jobs";
const SITE_DESCRIPTION =
  "The fastest way to find design jobs in India. DOD aggregates 800+ live UI/UX, Product, Communication and Industrial design roles from LinkedIn, Foundit, Unstop, Internshala and more — filter by city, work type and salary, and save what you like.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dodlovestowork.vercel.app"),
  title: {
    default: SITE_TITLE,
    template: "%s · DOD",
  },
  description: SITE_DESCRIPTION,
  applicationName: "DOD",
  authors: [{ name: "DOD" }],
  keywords: [
    "design jobs India",
    "UI/UX jobs",
    "product design jobs",
    "communication design jobs",
    "industrial design jobs",
    "design internships India",
    "Bengaluru design jobs",
    "remote design jobs India",
  ],
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "DOD",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  category: "jobs",
};

export const viewport: Viewport = {
  themeColor: "#06070d",
  colorScheme: "dark",
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
      <body className="min-h-full">
        <div className="dod-backdrop" aria-hidden="true">
          <div className="dod-bloom dod-bloom--violet" />
          <div className="dod-bloom dod-bloom--teal" />
          <div className="dod-bloom dod-bloom--amber" />
        </div>
        {children}
      </body>
    </html>
  );
}
