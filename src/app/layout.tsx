import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alexander Wang | Portfolio",
  description: "Welcome to my personal portfolio showcasing AI, Embedded Systems, and Robotics projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >

        <main className="p-4 sm:p-8">{children}</main>

        <footer className="w-full p-4 bg-gray-100 dark:bg-gray-900 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © 2024 Alexander Wang. All rights reserved.
          </p>
        </footer>
      </body>
    </html>
  );
}
