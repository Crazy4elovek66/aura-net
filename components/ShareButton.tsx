"use client";

import { useEffect, useState } from "react";
import { toBlob } from "html-to-image";
import { useNotice } from "@/components/notice/NoticeProvider";

export default function ShareButton({ username }: { username: string }) {
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { notify } = useNotice();

  useEffect(() => {
    return () => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
    };
  }, [resultUrl]);

  const handleShare = async () => {
    const node = document.getElementById("aura-card-element");
    if (!node || loading) return;

    setLoading(true);
    const originalPosition = node.style.position;
    const originalSrcs = new Map<HTMLImageElement, string>();
    try {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      const images = Array.from(node.getElementsByTagName("img"));

      await Promise.all(
        images.map(async (img) => {
          try {
            originalSrcs.set(img, img.src);
            const response = await fetch(img.src);
            const blob = await response.blob();
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            img.src = base64;
            await new Promise((resolve) => setTimeout(resolve, 50));
          } catch (error) {
            console.warn("Failed to inline image for share card", img.src, error);
          }
        }),
      );
      node.style.position = "relative";

      await new Promise((resolve) => setTimeout(resolve, 600));

      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#000000",
        style: {
          borderRadius: "0",
          transform: "scale(1)",
          position: "relative",
        },
        canvasWidth: 1080,
        canvasHeight: 1920,
      });
      if (!blob) throw new Error("Blob generation failed");

      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }

      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setShowResult(true);

      if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const link = document.createElement("a");
        link.download = `aura-card-${username}.png`;
        link.href = url;
        link.click();
      }
    } catch (err) {
      console.error("Capture Error:", err);
      notify({
        variant: "error",
        title: "Карточка не собралась",
        message: "Не удалось подготовить изображение. Попробуй ещё раз через пару секунд.",
      });
    } finally {
      originalSrcs.forEach((src, img) => {
        img.src = src;
      });
      node.style.position = originalPosition;
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full px-4 mb-8">
        <button
          type="button"
          onClick={handleShare}
          disabled={loading}
          className="w-full py-4 rounded-3xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-neon-purple transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center disabled:opacity-60"
        >
          {loading ? "Собираем карточку..." : "Скачать для сторис"}
        </button>
      </div>
      <p className="text-[9px] text-center mt-3 text-white/30 font-black uppercase tracking-widest hidden sm:block">
        9:16 PNG • Чёткое качество
      </p>

      {showResult && resultUrl && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-[320px] aspect-[9/16] bg-black/50 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- Preview uses an object URL from html-to-image. */}
            <img src={resultUrl} alt="Готовая карточка" className="w-full h-full object-contain" />
          </div>

          <div className="mt-8 text-center space-y-4 px-6">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] leading-relaxed animate-pulse">
              Нажми на картинку и сохрани её в фото
            </p>

            <button
              type="button"
              onClick={() => setShowResult(false)}
              className="w-full py-4 rounded-2xl border-2 border-white/20 text-white font-black text-[12px] uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
            >
              Вернуться в профиль
            </button>
          </div>
        </div>
      )}
    </>
  );
}
