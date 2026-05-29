import type { Metadata } from 'next'
import { IBM_Plex_Serif, IBM_Plex_Sans, Turret_Road } from 'next/font/google'
import './globals.css'

const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-serif',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
})

const turretRoad = Turret_Road({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-data',
})

export const metadata: Metadata = {
  title: 'Intake — Lead Qualification',
  description: 'Submit your project inquiry.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${plexSerif.variable} ${plexSans.variable} ${turretRoad.variable}`}>
      <body className="bg-[#080808] text-[#F0EBE1] antialiased">
        {children}
      </body>
    </html>
  )
}