"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuraTransactions from "@/components/AuraTransactions";
import InviteLoopCard from "@/components/InviteLoopCard";
import LeaderboardPreview from "@/components/LeaderboardPreview";
import MyCircleCard from "@/components/MyCircleCard";
import ProfileNextStepsCard from "@/components/ProfileNextStepsCard";
import ProfileRaceCard from "@/components/ProfileRaceCard";
import ReengagementEventsCard from "@/components/ReengagementEventsCard";
import ReturnPulseCard from "@/components/ReturnPulseCard";
import ShareButton from "@/components/ShareButton";
import ShareableMomentsCard from "@/components/ShareableMomentsCard";
import CopyLink from "./CopyLink";
import { normalizeProfileTab, PROFILE_TAB_ITEMS, type ProfileTabKey } from "./profile-tabs";
import type { CircleTabPayload, HistoryTabPayload, ProgressTabPayload } from "./profile-tab-data";

interface ProfileTabsNavigationProps {
  initialTab: ProfileTabKey;
  profilePanel: ReactNode;
  shopPanel: ReactNode;
}

interface SwipePoint {
  x: number;
  y: number;
  startedAt: number;
}

type HeavyTabKey = Extract<ProfileTabKey, "progress" | "circle" | "history">;

type HeavyTabPayloadMap = {
  progress: ProgressTabPayload;
  circle: CircleTabPayload;
  history: HistoryTabPayload;
};

const SWIPE_MIN_X = 56;
const SWIPE_MAX_Y = 86;
const SWIPE_MAX_TIME_MS = 650;
const HEAVY_TABS: HeavyTabKey[] = ["progress", "circle", "history"];

function isHeavyTab(tab: ProfileTabKey): tab is HeavyTabKey {
  return HEAVY_TABS.includes(tab as HeavyTabKey);
}

function buildTabUrl(nextTab: ProfileTabKey): string {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("tab", nextTab);
  return `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`;
}

function HeavyTabLoading({ tab }: { tab: HeavyTabKey }) {
  const titleByTab: Record<HeavyTabKey, string> = {
    progress: "Подгружаем прогресс",
    circle: "Подгружаем круг и инвайты",
    history: "Подгружаем историю активности",
  };

  const hintByTab: Record<HeavyTabKey, string> = {
    progress: "Собираем гонку, пульс и ближайшие шаги.",
    circle: "Собираем круг, статусы инвайтов и шеринговые поводы.",
    history: "Собираем события, лидеров и историю транзакций.",
  };

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">{titleByTab[tab]}</p>
      <p className="mt-2 text-[11px] text-white/45">{hintByTab[tab]}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-neon-purple/55" />
      </div>
    </section>
  );
}

function HeavyTabError({ errorText, onRetry }: { errorText?: string; onRetry: () => void }) {
  return (
    <section className="w-full max-w-xl rounded-3xl border border-neon-pink/20 bg-neon-pink/[0.06] p-5 backdrop-blur-md">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neon-pink/90">Не удалось загрузить вкладку</p>
      <p className="mt-2 text-[11px] text-white/70">
        {errorText || "Попробуй ещё раз. Базовый профиль продолжает работать локально."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl border border-neon-pink/35 bg-neon-pink/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-pink"
      >
        Повторить
      </button>
    </section>
  );
}

export default function ProfileTabsNavigation({ initialTab, profilePanel, shopPanel }: ProfileTabsNavigationProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabKey>(initialTab);
  const [touchEnabled, setTouchEnabled] = useState(false);
  const [payloads, setPayloads] = useState<Partial<HeavyTabPayloadMap>>({});
  const [loadingMap, setLoadingMap] = useState<Partial<Record<HeavyTabKey, boolean>>>({});
  const [errorMap, setErrorMap] = useState<Partial<Record<HeavyTabKey, string>>>({});

  const swipeStartRef = useRef<SwipePoint | null>(null);
  const swipeAxisLockRef = useRef<"horizontal" | "vertical" | null>(null);
  const inFlightRef = useRef<Partial<Record<HeavyTabKey, Promise<void>>>>({});

  const activeIndex = useMemo(() => PROFILE_TAB_ITEMS.findIndex((item) => item.key === activeTab), [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    setTouchEnabled(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const current = normalizeProfileTab(new URL(window.location.href).searchParams.get("tab"));
      setActiveTab(current);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const ensureTabPayload = useCallback(
    async (tab: HeavyTabKey) => {
      if (payloads[tab] || inFlightRef.current[tab]) {
        return;
      }

      const task = (async () => {
        setLoadingMap((prev) => ({ ...prev, [tab]: true }));
        setErrorMap((prev) => ({ ...prev, [tab]: "" }));

        try {
          const response = await fetch(`/api/profile/tabs?tab=${tab}`, {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          });

          const data = (await response.json().catch(() => ({}))) as {
            success?: boolean;
            error?: string;
            payload?: HeavyTabPayloadMap[HeavyTabKey];
          };

          if (!response.ok || !data.success || !data.payload) {
            throw new Error(data.error || "PROFILE_TAB_LOAD_FAILED");
          }

          setPayloads((prev) => ({
            ...prev,
            [tab]: data.payload as HeavyTabPayloadMap[typeof tab],
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось загрузить данные вкладки.";
          setErrorMap((prev) => ({ ...prev, [tab]: message }));
        } finally {
          setLoadingMap((prev) => ({ ...prev, [tab]: false }));
          delete inFlightRef.current[tab];
        }
      })();

      inFlightRef.current[tab] = task;
      await task;
    },
    [payloads],
  );

  useEffect(() => {
    if (!isHeavyTab(activeTab)) {
      return;
    }

    void ensureTabPayload(activeTab);
  }, [activeTab, ensureTabPayload]);

  useEffect(() => {
    const neighborKeys: ProfileTabKey[] = [];
    const previous = PROFILE_TAB_ITEMS[activeIndex - 1]?.key;
    const next = PROFILE_TAB_ITEMS[activeIndex + 1]?.key;

    if (previous) {
      neighborKeys.push(previous);
    }

    if (next) {
      neighborKeys.push(next);
    }

    if (!neighborKeys.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      neighborKeys.forEach((key) => {
        if (isHeavyTab(key)) {
          void ensureTabPayload(key);
        }
      });
    }, 160);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, ensureTabPayload]);

  const updateTab = useCallback(
    (nextTab: ProfileTabKey) => {
      if (nextTab === activeTab) return;
      setActiveTab(nextTab);
      window.history.replaceState(null, "", buildTabUrl(nextTab));
    },
    [activeTab],
  );

  const navigateBySwipe = useCallback(
    (direction: "next" | "prev") => {
      const nextIndex = direction === "next" ? activeIndex + 1 : activeIndex - 1;
      if (nextIndex < 0 || nextIndex >= PROFILE_TAB_ITEMS.length) return;
      updateTab(PROFILE_TAB_ITEMS[nextIndex].key);
    },
    [activeIndex, updateTab],
  );

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (!touchEnabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startedAt: Date.now(),
    };
    swipeAxisLockRef.current = null;
  };

  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    if (!touchEnabled || !start || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!swipeAxisLockRef.current && (absX > 8 || absY > 8)) {
      swipeAxisLockRef.current = absX > absY * 1.1 ? "horizontal" : "vertical";
    }

    if (swipeAxisLockRef.current === "horizontal" && absX > 14) {
      event.preventDefault();
    }
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    const axis = swipeAxisLockRef.current;
    swipeStartRef.current = null;
    swipeAxisLockRef.current = null;

    if (!touchEnabled || !start || event.changedTouches.length !== 1 || axis !== "horizontal") return;

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

  const activeTabInfo = PROFILE_TAB_ITEMS.find((item) => item.key === activeTab) || PROFILE_TAB_ITEMS[0];

  const activeContent = useMemo(() => {
    if (activeTab === "profile") {
      return profilePanel;
    }

    if (activeTab === "shop") {
      return shopPanel;
    }

    if (!isHeavyTab(activeTab)) {
      return null;
    }

    const payload = payloads[activeTab];
    const isLoading = loadingMap[activeTab];
    const errorText = errorMap[activeTab];

    if (!payload && (isLoading || !errorText)) {
      return <HeavyTabLoading tab={activeTab} />;
    }

    if (!payload) {
      return <HeavyTabError errorText={errorText} onRetry={() => void ensureTabPayload(activeTab)} />;
    }

    if (activeTab === "progress") {
      const progressPayload = payload as ProgressTabPayload;
      return (
        <>
          <ProfileNextStepsCard
            auraPoints={progressPayload.nextSteps.auraPoints}
            dailyStreak={progressPayload.nextSteps.dailyStreak}
            claimedToday={progressPayload.nextSteps.claimedToday}
            activatedInvites={progressPayload.nextSteps.activatedInvites}
            pendingInvites={progressPayload.nextSteps.pendingInvites}
            votesCast={progressPayload.nextSteps.votesCast}
            profileShareLink={progressPayload.nextSteps.profileShareLink}
            inviteLink={progressPayload.nextSteps.inviteLink}
          />
          <ProfileRaceCard
            raceContext={progressPayload.raceContext}
            weeklyTitles={progressPayload.weeklyTitles}
            auraPoints={progressPayload.nextSteps.auraPoints}
            dailyStreak={progressPayload.nextSteps.dailyStreak}
          />
          <ReturnPulseCard
            trackedAt={progressPayload.trackedAt}
            currentRank={progressPayload.currentRank}
            previousRank={progressPayload.previousRank}
            auraDelta={progressPayload.auraDelta}
            newAchievements={progressPayload.newAchievements}
            newMoments={progressPayload.newMoments}
            activatedReferrals={progressPayload.activatedReferrals}
            pendingEvents={progressPayload.pendingEvents}
          />
        </>
      );
    }

    if (activeTab === "circle") {
      const circlePayload = payload as CircleTabPayload;
      return (
        <>
          <MyCircleCard
            circleProfiles={circlePayload.circleProfiles}
            activatedInvites={circlePayload.activatedInvites}
            pendingInvites={circlePayload.pendingInvites}
          />
          <InviteLoopCard
            inviteCode={circlePayload.inviteCode}
            webInviteLink={circlePayload.webInviteLink}
            telegramInviteLink={circlePayload.telegramInviteLink}
            referrals={circlePayload.referrals}
          />
          <ShareableMomentsCard
            moments={circlePayload.moments}
            username={circlePayload.username}
            displayName={circlePayload.displayName}
            profileShareLink={circlePayload.profileShareLink}
            inviteLink={circlePayload.webInviteLink}
          />
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/20 p-4">
            <CopyLink link={circlePayload.profileShareLink} />
            <ShareButton username={circlePayload.username} />
          </div>
        </>
      );
    }

    const historyPayload = payload as HistoryTabPayload;
    return (
      <>
        <ReengagementEventsCard events={historyPayload.events} />
        <LeaderboardPreview
          auraLeaders={historyPayload.auraLeaders}
          growthLeaders={historyPayload.growthLeaders}
          spotlightLeaders={historyPayload.spotlightLeaders}
          currentUserId={historyPayload.currentUserId}
        />
        <AuraTransactions transactions={historyPayload.transactions} />
      </>
    );
  }, [activeTab, ensureTabPayload, errorMap, loadingMap, payloads, profilePanel, shopPanel]);

  return (
    <section className="w-full max-w-xl">
      <div className="rounded-3xl border border-white/10 bg-black/35 p-2 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROFILE_TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateTab(tab.key)}
              aria-current={activeTab === tab.key ? "page" : undefined}
              className={[
                "min-w-[124px] rounded-2xl border px-3 py-2 text-left transition-all",
                activeTab === tab.key
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

      <div
        className="mt-3 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-6 pb-2"
          >
            {activeContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

