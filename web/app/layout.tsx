import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "DOD — Live India design jobs",
  description:
    "A live, curated board of UI/UX, Product, Communication and Industrial design roles across India — updated continuously from LinkedIn, Unstop, Greenhouse, Lever, Ashby, RemoteOK and more.",
  applicationName: "DOD",
  authors: [{ name: "DOD" }],
  keywords: [
    "design jobs",
    "India",
    "UI/UX",
    "product design",
    "communication design",
    "industrial design",
  ],
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
