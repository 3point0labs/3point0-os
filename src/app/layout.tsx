import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { DiscoveryScheduler } from "@/components/DiscoveryScheduler";
import { PodcastWorkspaceProvider } from "@/components/PodcastWorkspaceProvider";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} h-full antialiased dark`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-[var(--color-bg-primary)] text-[var(--color-accent-eggshell)]">
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
