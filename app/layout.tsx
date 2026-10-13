import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WebAnalytics } from "@/components/web-analytics";
import { AmbientBackground } from "@/components/ambient-background";
import { PageTransition } from "@/components/page-transition";
import { CookieNotice } from "@/components/cookie-notice";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/toaster";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { site } from "@/lib/content";

/**
 * All three are variable fonts, so `weight` is omitted and the full axis range
 * ships in one file — fewer requests than pinning four static cuts.
 *
 * Deliberately not a serif display face. A high-contrast serif over a warm
 * accent is one of the looks generated design keeps arriving at, and Source
 * Serif over #E8532E sat right in it. Bricolage Grotesque has varying widths
 * and real oddness at display size — nobody reaches for it by accident.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // `template` suffixes any child route's own title with the brand name, so a
  // route that forgets to set one still reads as generic rather than blank —
  // `default` is what renders when a child sets no title of its own at all.
  title: {
    template: `%s | ${site.owner}`,
    default: `Jobs | ${site.owner}`,
  },
  description: "Vetted opportunities across Africa — from PAC Africa.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class onto <html> before paint, which the server render cannot predict.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased`}
      >
        <ThemeProvider>
          <ScrollRestoration />
          <AmbientBackground />
          <SiteHeader />
          <main className="min-h-screen">
            <PageTransition>{children}</PageTransition>
          </main>
          <SiteFooter />
          <CookieNotice />
          <Toaster />
          <WebAnalytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
