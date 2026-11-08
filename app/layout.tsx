import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppHeaderControls } from "@/components/app-header-controls";
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
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const isLoginPage = pathname === "/login";

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
        >
          {isLoginPage ? (
            <main className="h-full w-full">{children}</main>
          ) : (
            <SidebarProvider defaultOpen={defaultOpen} className="h-full">
              <AppSidebar />
              <SidebarInset className="min-w-0 h-svh max-h-svh flex flex-col">
                <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-16">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 my-auto data-vertical:h-4" />
                    <AppBreadcrumb />
                  </div>
                  <AppHeaderControls />
                </header>
                <div className="flex flex-1 flex-col gap-2 sm:gap-3 p-2 sm:p-3 md:px-6 md:py-3.5 min-w-0 min-h-0 overflow-hidden">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          )}
        </BootingScreen>
        <Toaster />
      </body>
    </html>
  );
}
