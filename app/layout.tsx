import type { Metadata } from "next";
import { Unbounded } from "next/font/google";
import Script from "next/script";
import { NoticeProvider } from "@/components/notice/NoticeProvider";
import TelegramInit from "@/components/TelegramInit";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "AURA.NET — Узнай свою ауру",
  description:
    "Социальная игра статуса. Загрузи свой лук, получи оценку от друзей и поднимайся по тирам. Ты NPC или Сигма?",
  keywords: ["аура", "социальная игра", "рейтинг", "сигма", "нпс", "вайб", "aura"],
  openGraph: {
    title: "AURA.NET — Узнай свою ауру",
    description: "Социальная игра статуса. Ты NPC или Сигма?",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${unbounded.variable} min-h-[100dvh] antialiased fill-viewport`} suppressHydrationWarning>
      <head>
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans mb-safe">
        <NoticeProvider>
          <TelegramInit />
          {children}
        </NoticeProvider>
      </body>
    </html>
  );
}
