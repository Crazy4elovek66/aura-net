"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export default function TelegramInit() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
        // Попытка убрать вертикальные свайпы для более нативного ощущения
        if (tg.disableVerticalSwipes) {
          tg.disableVerticalSwipes();
        }
      } catch (e) {
        console.error("Telegram WebApp initialization error:", e);
      }
    }
  }, []);

  return null;
}
