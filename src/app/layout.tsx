import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { DiscoveryScheduler } from "@/components/DiscoveryScheduler";
import { PodcastWorkspaceProvider } from "@/components/PodcastWorkspaceProvider";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "3point0 OS · 3point0 Labs",
  description: "Internal operating system for 3point0 Labs media and content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--fg)]">
        <AuthProvider>
          <PodcastWorkspaceProvider>
            <DiscoveryScheduler />
            {children}
          </PodcastWorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
