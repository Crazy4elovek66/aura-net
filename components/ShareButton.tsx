"use client";

import { useState } from "react";
import { toBlob } from "html-to-image";

export default function ShareButton({ username }: { username: string }) {
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleShare = async () => {
    const node = document.getElementById("aura-card-element");
    if (!node) return;

    setLoading(true);
    try {
      // 1. Ждем шрифты
      await document.fonts.ready;

      // 2. Конвертируем все картинки в Base64 для 100% стабильности
      const images = Array.from(node.getElementsByTagName('img'));
      const originalSrcs = new Map<HTMLImageElement, string>();

      await Promise.all(images.map(async (img) => {
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
          await new Promise(r => setTimeout(r, 50));
        } catch (e) {
          console.warn("Failed to base64 image:", img.src, e);
        }
      }));

      // 3. Статичный размер 1080x1920
      const originalPosition = node.style.position;
      node.style.position = 'relative';

      await new Promise(r => setTimeout(r, 600));

      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#000000",
        style: {
          borderRadius: '0',
          transform: 'scale(1)',
          position: 'relative',
        },
        canvasWidth: 1080,
        canvasHeight: 1920,
      });

      // 4. Восстановление
      originalSrcs.forEach((src, img) => { img.src = src; });
      node.style.position = originalPosition;

      if (!blob) throw new Error("Blob generation failed");

      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setShowResult(true);

      // На ПК всё равно триггерим обычную загрузку для удобства
      if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const link = document.createElement("a");
        link.download = `aura-card-${username}.png`;
        link.href = url;
        link.click();
      }
    } catch (err) {
      console.error("Capture Error:", err);
      alert("Ошибка при создании карточки. Попробуй еще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full px-4 mb-8">
        <button
          onClick={handleShare}
          disabled={loading}
          className="w-full py-4 rounded-3xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-neon-purple transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center"
        >
          {loading ? "ГЕНЕРАЦИЯ..." : "СКАЧАТЬ ДЛЯ STORIES"}
        </button>
      </div>
      <p className="text-[9px] text-center mt-3 text-white/30 font-black uppercase tracking-widest hidden sm:block">
        9:16 PNG • High Quality
      </p>

      {/* Result Modal / Result View */}
      {showResult && resultUrl && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-[320px] aspect-[9/16] bg-black/50 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <img 
              src={resultUrl} 
              alt="Result" 
              className="w-full h-full object-contain"
            />
          </div>
          
          <div className="mt-8 text-center space-y-4 px-6">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] leading-relaxed animate-pulse">
              Инструкция: Зажми картинку пальцем <br/> и выбери «Сохранить в фото»
            </p>
            
            <button
              onClick={() => setShowResult(false)}
              className="w-full py-4 rounded-2xl border-2 border-white/20 text-white font-black text-[12px] uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
            >
              ВЕРНУТЬСЯ В ПРОФИЛЬ ⚡
            </button>
          </div>
        </div>
      )}
    </>
  );
}
