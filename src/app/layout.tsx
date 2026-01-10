import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ProviderWrapper from "@/redux/provider-wrapper";
import SHToolbar from "@/components/common/sh-toolbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Lab",
  description: "Fantasy Football Tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, height=device-height, initial-scale=1, minimum-scale=1"
        />
        <link href="https://fonts.cdnfonts.com/css/pulang" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/chillit" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/d-dredex" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/hugmate" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/kwizi" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/maria-2" rel="stylesheet" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex flex-col h-[100dvh]">
          <SHToolbar />

          <div className="relative flex flex-col flex-1">
            <ProviderWrapper>
              <div id="modal-root" />
              {children}
            </ProviderWrapper>
          </div>
        </div>
      </body>
    </html>
  );
}
