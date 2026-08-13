import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Cinzel, Silkscreen } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["500", "600", "700", "800"],
})

const silkscreen = Silkscreen({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixel",
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "Gear Perks Card Game",
  description: "2025 Gear Perks Oficial Card Game, Made in BRAZIL",
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
  themeColor: "#1e1b4b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${cinzel.variable} ${silkscreen.variable} bg-background`}>
      <body className="font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
