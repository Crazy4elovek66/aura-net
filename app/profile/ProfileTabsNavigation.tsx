"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PROFILE_TAB_ITEMS, type ProfileTabKey } from "./profile-tabs";

interface ProfileTabsNavigationProps {
  activeTab: ProfileTabKey;
  children: ReactNode;
}

interface SwipePoint {
  x: number;
  y: number;
  startedAt: number;
}

const SWIPE_MIN_X = 56;
const SWIPE_MAX_Y = 82;
const SWIPE_MAX_TIME_MS = 650;

export default function ProfileTabsNavigation({ activeTab, children }: ProfileTabsNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [optimisticTab, setOptimisticTab] = useState<ProfileTabKey>(activeTab);
  const [touchEnabled, setTouchEnabled] = useState(false);
  const swipeStartRef = useRef<SwipePoint | null>(null);

  useEffect(() => {
    setOptimisticTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    setTouchEnabled(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const activeIndex = useMemo(
    () => PROFILE_TAB_ITEMS.findIndex((item) => item.key === optimisticTab),
    [optimisticTab],
  );

  const updateTab = (nextTab: ProfileTabKey) => {
    if (nextTab === optimisticTab) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    const query = params.toString();

    setOptimisticTab(nextTab);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const navigateBySwipe = (direction: "next" | "prev") => {
    const nextIndex = direction === "next" ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex < 0 || nextIndex >= PROFILE_TAB_ITEMS.length) return;
    updateTab(PROFILE_TAB_ITEMS[nextIndex].key);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (!touchEnabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startedAt: Date.now(),
    };
  };

  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    if (!touchEnabled || !start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - start.x);
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX > 16 && deltaX > deltaY + 10) {
      event.preventDefault();
    }
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!touchEnabled || !start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Date.now() - start.startedAt;

    if (elapsed > SWIPE_MAX_TIME_MS) return;
    if (Math.abs(deltaY) > SWIPE_MAX_Y) return;
    if (Math.abs(deltaX) < SWIPE_MIN_X) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;

    navigateBySwipe(deltaX < 0 ? "next" : "prev");
  };

  const activeTabInfo = PROFILE_TAB_ITEMS.find((item) => item.key === optimisticTab) || PROFILE_TAB_ITEMS[0];

  return (
    <section className="w-full max-w-xl">
      <div className="rounded-3xl border border-white/10 bg-black/35 p-2 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROFILE_TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateTab(tab.key)}
              aria-current={optimisticTab === tab.key ? "page" : undefined}
              className={[
                "min-w-[124px] rounded-2xl border px-3 py-2 text-left transition-all",
                optimisticTab === tab.key
                  ? "border-neon-purple/45 bg-neon-purple/15 text-white shadow-[0_0_16px_rgba(180,74,255,0.12)]"
                  : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white/85",
              ].join(" ")}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em]">{tab.label}</p>
              <p className="mt-1 text-[10px] leading-tight text-white/50">{tab.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 px-2">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/58">
          Раздел: <span className="text-white/88">{activeTabInfo.label}</span>
        </p>
      </div>

      <div className="mt-3" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </section>
  );
}
