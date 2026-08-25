import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";
import SWRegister from "@/components/SWRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo-var",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "Shajaratna — Family Trees Together | شجرتنا",
  description:
    "Build your family tree together with relatives: names, photos and stories in one shared place. ابنِ شجرة عائلتك مع أهلك.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "شجرتنا", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport = {
  themeColor: "#1f6445",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
        <SWRegister />
      </body>
    </html>
  );
}
