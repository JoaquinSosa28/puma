import type { Metadata } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Providers } from "@/components/providers/nuqs-provider";
import { getSettings } from "@/lib/db/settings";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "P.U.M.A — Procrastination Ultimate Management App",
  description: "Personal life-management dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const defaultTheme = settings?.theme ?? "light";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${schibsted.variable} ${jetbrains.variable} antialiased`}>
        <Providers>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme={defaultTheme}
            enableSystem={false}
          >
            {children}
            <Toaster
              position="bottom-center"
              toastOptions={{
                classNames: {
                  toast:
                    "animate-puma-toast bg-ink text-background font-semibold border-none",
                  actionButton: "font-mono text-[11px] text-faint2",
                },
              }}
            />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
