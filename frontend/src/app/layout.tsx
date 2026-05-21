import type { Metadata } from 'next'
import { Geist, Geist_Mono, Cormorant_Garamond } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Aligné',
  description: 'Estudio de pilates — clases, horarios y reservas',
}

// Hemisferio sur (Argentina). El mes ART evita que el server (UTC) caiga en otra estación a fin de día.
function getSeasonAR(): 'autumn' | 'winter' | 'spring' | 'summer' {
  const month = Number(
    new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date()),
  )
  if (month >= 3 && month <= 5) return 'autumn'
  if (month >= 6 && month <= 8) return 'winter'
  if (month >= 9 && month <= 11) return 'spring'
  return 'summer'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const season = getSeasonAR()
  return (
    <html
      lang="es"
      data-season={season}
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
