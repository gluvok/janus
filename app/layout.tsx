import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { BootingScreen } from "@/components/booting-screen";
import { getServerSession } from "@/lib/auth";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
});

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mesto",
  description: "Mesto Automations Platform",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const session = await getServerSession();

  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        manrope.variable,
        "smooth-scroll",
      )}
    >
      <head />
      <body>
        <BootingScreen
          initialUser={session?.user ?? null}
          initialFactory={session?.factory ?? null}
          defaultOpen={defaultOpen}
        >
          {children}
        </BootingScreen>
        <Toaster />
      </body>
    </html>
  );
}
