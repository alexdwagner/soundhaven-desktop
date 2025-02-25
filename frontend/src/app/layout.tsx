import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TracksProvider } from "./providers/TracksProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { PlaybackProvider } from "./providers/PlaybackProvider";
import { CommentsProvider } from "./providers/CommentsProvider";
import { PlaylistsProvider } from "./providers/PlaylistsProvider";

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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <CommentsProvider>
            <TracksProvider>
              <PlaybackProvider>
                <PlaylistsProvider>
                  <main>{children}</main>
                </PlaylistsProvider>
              </PlaybackProvider>
            </TracksProvider>
          </CommentsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
