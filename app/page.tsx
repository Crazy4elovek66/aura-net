"use client";

import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import AuraCard from "@/components/AuraCard";
import LeaderboardPreview from "@/components/LeaderboardPreview";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const DEMO_USERS = [
  {
    username: "npc_mike",
    displayName: "Миша",
    avatarUrl: null,
    auraPoints: 234,
    totalVotesUp: 44,
    totalVotesDown: 91,
    status: "Типичный НПС. Твой вклад в экономику ауры — это просто существовать.",
  },
  {
    username: "vibe_check_alex",
    displayName: "Алекс",
    avatarUrl: null,
    auraPoints: 1250,
    totalVotesUp: 389,
    totalVotesDown: 167,
    status: "Уровень героя разблокирован. Твой вайб — это чистый мейн-кэрактер момент.",
  },
  {
    username: "dima_vibes",
    displayName: "Дмитрий",
    avatarUrl: null,
    auraPoints: 4120,
    totalVotesUp: 852,
    totalVotesDown: 42,
    status: "Тот самый, о ком все шепчутся в коридорах. Индиго-вайб.",
  },
  {
    username: "sigma_sarah",
    displayName: "Сара",
    avatarUrl: null,
    auraPoints: 5247,
    totalVotesUp: 642,
    totalVotesDown: 12,
    status: "Абсолютная сигма. Твое присутствие буквально повышает ФПС у окружающих.",
  },
];

const TIER_DATA = [
  {
    range: "0 - 500",
    name: "НПС",
    emoji: "🤡",
    desc: "Серый и залоченный. Вы не имеете права голоса в этом мире.",
    color: "text-muted",
    border: "border-muted/30",
    bg: "bg-muted/5",
  },
  {
    range: "501 - 2000",
    name: "ГЕРОЙ",
    emoji: "🤠",
    desc: "Разблокирован и сияет. Твоя аура начинает пульсировать.",
    color: "text-neon-purple",
    border: "border-neon-purple/30",
    bg: "bg-neon-purple/5",
  },
  {
    range: "2001 - 5000",
    name: "ТОТ САМЫЙ",
    emoji: "😏",
    desc: "Элитный статус. Доступ к Журналу Сгорания и индиговое свечение.",
    color: "text-indigo-400",
    border: "border-indigo-400/30",
    bg: "bg-indigo-400/5",
  },
  {
    range: "5001+",
    name: "СИГМА",
    emoji: "👑",
    desc: "Легенда. Ты И ЕСТЬ алгоритм этого мира. Золотое сияние.",
    color: "text-yellow-400",
    border: "border-yellow-400/30",
    bg: "bg-yellow-400/5",
  },
];

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);

    return () => clearInterval(timer);
  }, [target]);

  return <span>{count.toLocaleString("ru-RU")}</span>;
}

function FloatingOrb({
  delay,
  size,
  color,
  x,
  y,
}: {
  delay: number;
  size: number;
  color: string;
  x: string;
  y: string;
}) {
  return (
    <motion.div
      className="absolute rounded-full blur-3xl pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        left: x,
        top: y,
        opacity: 0.15,
      }}
      animate={{
        y: [0, -30, 0, 30, 0],
        x: [0, 15, 0, -15, 0],
        scale: [1, 1.1, 1, 0.9, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

const supabase = createClient();

interface LandingAuraLeader {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
}

interface LandingGrowthLeader extends LandingAuraLeader {
  growthPoints: number;
}

interface LandingLeaderboardPayload {
  auraLeaders: LandingAuraLeader[];
  growthLeaders: LandingGrowthLeader[];
}

const EMPTY_LEADERBOARD: LandingLeaderboardPayload = {
  auraLeaders: [],
  growthLeaders: [],
};

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<LandingLeaderboardPayload>(EMPTY_LEADERBOARD);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    let isActive = true;

    const loadLeaderboardPreview = async () => {
      try {
        const response = await fetch("/api/leaderboard/preview");

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as LandingLeaderboardPayload;
        if (isActive) {
          setLeaderboardData({
            auraLeaders: payload.auraLeaders || [],
            growthLeaders: payload.growthLeaders || [],
          });
        }
      } catch {
        // Для лендинга молча оставляем пустой teaser, если API недоступен.
      } finally {
        if (isActive) {
          setLeaderboardLoading(false);
        }
      }
    };

    void loadLeaderboardPreview();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-unbounded">
       {!mounted ? (
         <div className="fixed inset-0 z-[1000] bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
               <div className="w-10 h-10 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
               <span className="text-[10px] text-neon-purple/50 font-black uppercase tracking-[0.3em]">Loading AURA...</span>
            </div>
         </div>
       ) : (
         <LandingContent user={user} leaderboardData={leaderboardData} leaderboardLoading={leaderboardLoading} />
       )}
    </div>
  );
}

function LandingContent({
  user,
  leaderboardData,
  leaderboardLoading,
}: {
  user: any;
  leaderboardData: LandingLeaderboardPayload;
  leaderboardLoading: boolean;
}) {
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.15 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return (
    <div className="relative overflow-hidden animate-in fade-in duration-700">
      {/* Навигация */}
      <nav className="fixed top-0 left-0 right-0 z-[150] p-6 flex justify-between items-center bg-background/50 backdrop-blur-md border-b border-card-border">
        <Link href="/" className="text-xl font-bold tracking-tighter">
          <span className="text-neon-purple">AURA</span>
          <span className="text-white/70">.NET</span>
        </Link>
        <div className="flex gap-4">
          {user ? (
            <Link
              href="/profile"
              className="px-4 py-2 rounded-lg border border-card-border hover:border-neon-purple transition-all text-sm font-medium"
            >
              Профиль
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg border border-neon-purple/50 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 transition-all text-sm font-medium"
            >
              Войти
            </Link>
          )}
        </div>
      </nav>

      {/* Фоновые эффекты */}
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <FloatingOrb delay={0} size={400} color="rgba(180,74,255,0.3)" x="10%" y="20%" />
      <FloatingOrb delay={2} size={300} color="rgba(57,255,20,0.2)" x="70%" y="60%" />
      <FloatingOrb delay={4} size={250} color="rgba(255,45,149,0.15)" x="50%" y="10%" />

      {/* ===== HERO ===== */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center"
      >
        {/* Бейдж */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-neon-purple/30 bg-neon-purple/5 text-neon-purple text-sm font-medium">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_8px_rgba(57,255,20,0.8)]"
            />
            Бета — зашёл первым = получил больше
          </span>
        </motion.div>

        {/* Заголовок */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-[clamp(3.5rem,10vw,8rem)] font-bold tracking-tighter mb-6 leading-none"
        >
          <span className="text-glow-purple text-neon-purple">AURA</span>
          <span className="text-white/70">.NET</span>
        </motion.h1>

        {/* Подзаголовок */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="text-lg sm:text-xl text-muted max-w-md mb-4"
        >
          Социальная игра статуса.{" "}
          <span className="text-foreground font-semibold">
            Пусть друзья оценят твой вайб.
          </span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-sm text-muted/60 mb-10"
        >
          НПС 👻 → Герой 💜 → Сигма ⚡
        </motion.p>

        {/* Кнопки действий */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, type: "spring" }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link href={user ? "/profile" : "/login"}>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="px-8 py-4 rounded-xl font-bold text-lg bg-neon-purple text-white border-2 border-neon-purple neon-glow-purple cursor-pointer transition-colors w-full sm:w-auto"
          >
            ⚡ Узнай свою ауру
          </motion.button>
          </Link>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="px-8 py-4 rounded-xl font-bold text-lg border-2 border-card-border text-muted hover:text-foreground hover:border-neon-purple/50 cursor-pointer transition-colors"
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          >
            Как это работает ↓
          </motion.button>
        </motion.div>
      </motion.section>

      {/* ===== КАК ЭТО РАБОТАЕТ ===== */}
      <section className="relative py-24 px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-100px" }}
          className="max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Как это{" "}
              <span className="text-neon-purple text-glow-purple">работает</span>
            </h2>
            <p className="text-muted max-w-md mx-auto text-sm">
              Три шага, чтобы узнать — ты герой или просто НПС
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: "📸",
                title: "Покажи себя",
                desc: "Запости фото. Покажи свой стиль. Пусть твой вайб говорит за тебя.",
              },
              {
                step: "02",
                icon: "🔗",
                title: "Отправь ссылку",
                desc: "Кинь свою уникальную ссылку друзьям, подписчикам или запости в сторис.",
              },
              {
                step: "03",
                icon: "⚡",
                title: "Получи оценку",
                desc: "Люди голосуют +Аура или −Аура. Твой тир меняется в реальном времени.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -5, borderColor: "rgba(180,74,255,0.3)" }}
                transition={{
                  y: { type: "spring", stiffness: 400, damping: 10 },
                  borderColor: { duration: 0.3, ease: "easeInOut" }
                }}
                className="neo-card rounded-2xl p-6 border-2 border-card-border"
              >
                <div className="text-xs text-muted font-mono mb-4">
                  ШАГ {item.step}
                </div>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-muted text-xs">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===== СИСТЕМА ТИРОВ ===== */}
      <section className="relative py-24 px-4 border-t border-card-border/50">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-100px" }}
          className="max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Тиры{" "}
              <span className="text-neon-green text-glow-green">ауры</span>
            </h2>
            <p className="text-muted max-w-md mx-auto text-sm">
              Твоя аура тухнет на 3% каждые 24ч. Оставайся на виду или оставайся обычным НПС.
            </p>
          </motion.div>

          <div className="flex flex-col gap-6">
            <div className="grid md:grid-cols-3 gap-6">
              {TIER_DATA.slice(0, 3).map((tier, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className={`rounded-2xl p-6 border-2 ${tier.border} ${tier.bg} transition-colors`}
                >
                  <div className="text-5xl mb-4 text-center">{tier.emoji}</div>
                  <div className={`text-xs font-mono mb-2 ${tier.color} text-center`}>
                    {tier.range} ОЧКОВ
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${tier.color} text-center`}>
                    {tier.name}
                  </h3>
                  <p className="text-muted text-xs text-center">{tier.desc}</p>
                </motion.div>
              ))}
            </div>
            
            <div className="flex justify-center">
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className={`w-full md:w-[calc(33.333%-1rem)] rounded-2xl p-6 border-2 ${TIER_DATA[3].border} ${TIER_DATA[3].bg} transition-colors relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-yellow-400/5" />
                <div className="relative z-10">
                  <div className="text-6xl mb-4 text-center">{TIER_DATA[3].emoji}</div>
                  <div className={`text-xs font-mono mb-2 ${TIER_DATA[3].color} text-center uppercase tracking-widest`}>
                    {TIER_DATA[3].range} ОЧКОВ
                  </div>
                  <h3 className={`text-2xl font-black mb-2 ${TIER_DATA[3].color} text-center italic`}>
                    {TIER_DATA[3].name}
                  </h3>
                  <p className="text-muted text-xs text-center font-medium">{TIER_DATA[3].desc}</p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== ДЕМО КАРТОЧКИ ===== */}
      <section className="relative py-24 px-4 overflow-x-hidden">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-100px" }}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Живые{" "}
              <span className="text-neon-pink">карточки</span>{" "}
              ауры
            </h2>
            <p className="text-muted max-w-md mx-auto text-sm">
              Так выглядит твой профиль, когда люди чекают твою ауру
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10 items-center justify-items-center px-4 pb-20">
            {DEMO_USERS.map((user, idx) => (
              <motion.div 
                key={user.username} 
                variants={itemVariants} 
                className={`w-full max-w-[380px] hover:z-50 transition-all duration-300 transform-gpu ${idx === 3 ? 'lg:col-start-2' : ''}`}
              >
                <AuraCard {...user} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===== СТАТИСТИКА ===== */}
      <section className="relative pb-24 px-4 -mt-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-100px" }}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Р“Р»Р°РІРЅС‹Рµ{" "}
              <span className="text-neon-green text-glow-green">Р»РёРґРµСЂС‹</span>
            </h2>
            <p className="text-muted max-w-2xl mx-auto text-sm">
              РљС‚Рѕ РґРµСЂР¶РёС‚ РІРµСЂС… РїРѕ РѕР±С‰РµР№ Р°СѓСЂРµ Рё РєС‚Рѕ СѓСЃРєРѕСЂСЏРµС‚СЃСЏ Р±С‹СЃС‚СЂРµРµ РІСЃРµС… Р·Р° РїРѕСЃР»РµРґРЅСЋСЋ РЅРµРґРµР»СЋ.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="relative">
            <div className="pointer-events-none absolute -inset-8 bg-neon-purple/10 blur-3xl" />
            <div className="relative">
              {leaderboardLoading ? (
                <div className="w-full rounded-[2rem] border border-white/12 bg-black/30 backdrop-blur-xl p-5 md:p-7 animate-pulse">
                  <div className="h-6 w-56 bg-white/10 rounded mb-4" />
                  <div className="h-4 w-full max-w-xl bg-white/8 rounded mb-6" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                      <div className="h-4 w-32 bg-white/10 rounded" />
                      <div className="h-9 bg-white/7 rounded-xl" />
                      <div className="h-9 bg-white/7 rounded-xl" />
                      <div className="h-9 bg-white/7 rounded-xl" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                      <div className="h-4 w-32 bg-white/10 rounded" />
                      <div className="h-9 bg-white/7 rounded-xl" />
                      <div className="h-9 bg-white/7 rounded-xl" />
                      <div className="h-9 bg-white/7 rounded-xl" />
                    </div>
                  </div>
                </div>
              ) : (
                <LeaderboardPreview
                  variant="landing"
                  title="РћСЃРЅРѕРІРЅС‹Рµ Р»РёРґРµСЂС‹"
                  subtitle="РўРѕРї РїРѕ РѕР±С‰РµР№ Р°СѓСЂРµ Рё РїРѕ РїСЂРёСЂРѕСЃС‚Сѓ Р·Р° 7 РґРЅРµР№."
                  auraLeaders={leaderboardData.auraLeaders}
                  growthLeaders={leaderboardData.growthLeaders}
                  currentUserId={user?.id || ""}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="relative py-24 px-4 font-unbounded">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ margin: "-100px" }}
          className="max-w-4xl mx-auto"
        >
          <div className="neo-card rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: 12847, label: "Проверок ауры", suffix: "" },
                { value: 4200, label: "Активных юзеров", suffix: "+" },
                { value: 89, label: "Средняя сессия", suffix: "с" },
                { value: 3, label: "Дневное затухание", suffix: "%" },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl md:text-3xl font-bold text-neon-purple">
                    <AnimatedCounter target={stat.value} />
                    {stat.suffix}
                  </div>
                  <div className="text-[10px] text-muted mt-1 uppercase tracking-wider">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== ФИНАЛЬНЫЙ CTA ===== */}
      <section className="relative py-32 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Готов узнать свою{" "}
            <span className="text-neon-green text-glow-green">настоящую</span>{" "}
            ауру?
          </h2>
          <p className="text-muted text-lg mb-10 max-w-md mx-auto italic">
            Хватит кэпить. Пусть другие решают.
          </p>
          <Link href={user ? "/profile" : "/login"}>
          <motion.button
            whileHover={{ scale: 1.05, y: -3 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="px-10 py-5 rounded-xl font-bold text-xl bg-gradient-to-r from-neon-purple to-neon-pink text-white neon-glow-purple cursor-pointer"
          >
            ⚡ Получить свою Ауру
          </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* ===== ФУТЕР ===== */}
      <footer className="border-t border-card-border py-8 px-4 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted">
            <span className="text-neon-purple font-bold">AURA</span>
            <span className="text-white/70">.NET</span>
            {" "}© 2026
          </div>
          <div className="text-[10px] text-muted/50 uppercase tracking-widest">
            Сделано на вайбах и нулевом бюджете 🫡
          </div>
        </div>
      </footer>
    </div>
  );
}
