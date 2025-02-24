import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import { Toaster } from '@/components/ui/toaster'
import { RouteGuard } from '@/components/auth/RouteGuard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Neuhu - Expert Business News & Analysis',
  description: 'Neuhu delivers business, markets expert news, analysis, and audios to the world, featuring stories from global experts.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={inter.className}>
        <ThemeProvider>
          <RouteGuard>
            {children}
            <Toaster />
          </RouteGuard>
        </ThemeProvider>
      </body>
    </html>
  )
} 