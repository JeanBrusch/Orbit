import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: "ORBIT | Cognitive Interface",
  description: "Advanced cognitive field management system",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Orbit",
  },
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#05060A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var t = localStorage.getItem('orbit-theme') || 'dark';
                document.documentElement.classList.add(t);
              })()
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans antialiased text-[var(--orbit-text)] bg-[var(--orbit-bg)] transition-colors duration-300`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
