import type { Metadata } from 'next'
import { Audiowide, IBM_Plex_Sans, Turret_Road } from 'next/font/google'
import './globals.css'

const serif = Audiowide({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-serif',
  display: 'swap',
})

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
})

const data = Turret_Road({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-data',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Better Call Jon — Personal Injury Intake',
  description: 'Confidential case intake for Better Call Jon law firm.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${data.variable}`}>
      <body className="font-sans bg-background text-text antialiased">
        {children}
      </body>
    </html>
  )
}