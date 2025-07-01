import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TracksProvider } from "./providers/TracksProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { PlaybackProvider } from "./providers/PlaybackProvider";
import { CommentsProvider } from "./providers/CommentsProvider";
import { PlaylistsProvider } from "./providers/PlaylistsProvider";
import { DragProvider } from "./providers/DragProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoundHaven",
  description: "An app for organizing and sharing audio files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-mode="light">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}>
        <AuthProvider>
          <TracksProvider>
            <PlaybackProvider>
              <CommentsProvider>
                <PlaylistsProvider>
                  <DragProvider>
                    <main className="min-h-screen">{children}</main>
                  </DragProvider>
                </PlaylistsProvider>
              </CommentsProvider>
            </PlaybackProvider>
          </TracksProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
