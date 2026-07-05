"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotice } from "@/components/notice/NoticeProvider";
import Link from "next/link";

interface QASectionProps {
  mode: "public" | "owner";
  username: string; // Username of the profile owner
  profileId: string; // Profile ID
  isLoggedIn: boolean;
  isAdmin?: boolean;
}

interface QAQuestion {
  id: string;
  text: string;
  isAnonymous: boolean;
  createdAt: string;
  sender: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  answer: {
    id: string;
    text: string;
    mediaType: string;
    mediaFileId: string | null;
    createdAt: string;
    likesCount: number;
    hasLiked: boolean;
  } | null;
}

export default function QASection({ mode, username, profileId, isLoggedIn, isAdmin = false }: QASectionProps) {
  const { notify } = useNotice();
  const [activeTab, setActiveTab] = useState<"inbox" | "answers">(mode === "owner" ? "inbox" : "answers");
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [inbox, setInbox] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states (asking)
  const [askText, setAskText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Form states (answering)
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  // Admin deanon information
  const [deanonData, setDeanonData] = useState<Record<string, { username: string; displayName: string }>>({});
  const [deanonLoading, setDeanonLoading] = useState<string | null>(null);

  const fetchPublicAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/qa/list?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setQuestions(data.questions || []);
      } else {
        notify({
          variant: "error",
          title: "Ошибка",
          message: data.error || "Не удалось загрузить ответы.",
        });
      }
    } catch (e: unknown) {
      console.error("[QASection] fetchPublicAnswers failed:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      notify({
        variant: "error",
        title: "Ошибка сети (Public)",
        message: `Детали: ${errMsg}`,
      });
    } finally {
      setLoading(false);
    }
  }, [username, notify]);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qa/inbox");
      const data = await res.json();
      if (res.ok && data.success) {
        setInbox(data.questions || []);
      } else {
        notify({
          variant: "error",
          title: "Ошибка",
          message: data.error || "Не удалось загрузить входящие вопросы.",
        });
      }
    } catch (e: unknown) {
      console.error("[QASection] fetchInbox failed:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      notify({
        variant: "error",
        title: "Ошибка сети (Inbox)",
        message: `Детали: ${errMsg}`,
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (mode === "public") {
      fetchPublicAnswers();
    } else {
      if (activeTab === "inbox") {
        fetchInbox();
      } else {
        fetchPublicAnswers();
      }
    }
  }, [mode, activeTab, fetchPublicAnswers, fetchInbox]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/qa/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: profileId,
          text: askText,
          isAnonymous,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notify({
          variant: "success",
          title: "Вопрос отправлен!",
          message: isAnonymous
            ? "Анонимный вопрос успешно отправлен (списано 15 ауры)."
            : "Вопрос успешно отправлен.",
        });
        setAskText("");
        setIsAnonymous(false);
        // Если это стена ответов, то вопрос появится только после ответа получателя,
        // но мы обновляем список на всякий случай
        fetchPublicAnswers();
      } else {
        notify({
          variant: "error",
          title: "Ошибка отправки",
          message: data.error || "Не удалось задать вопрос.",
        });
      }
    } catch {
      notify({
        variant: "error",
        title: "Ошибка сети",
        message: "Не удалось связаться с сервером.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = async (questionId: string) => {
    if (!answerText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/qa/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          text: answerText,
          mediaType: "text",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notify({
          variant: "success",
          title: "Ответ опубликован!",
          message: "Твой ответ успешно сохранен и опубликован на стене.",
        });
        setAnswerText("");
        setAnsweringId(null);
        fetchInbox();
      } else {
        notify({
          variant: "error",
          title: "Ошибка",
          message: data.error || "Не удалось сохранить ответ.",
        });
      }
    } catch {
      notify({
        variant: "error",
        title: "Ошибка сети",
        message: "Сеть временно недоступна.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (answerId: string) => {
    if (!isLoggedIn) {
      notify({
        variant: "error",
        title: "Вход обязателен",
        message: "Пожалуйста, войди через Telegram, чтобы ставить лайки.",
      });
      return;
    }

    try {
      const res = await fetch("/api/qa/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Локальное обновление списка вопросов/ответов
        setQuestions((prev) =>
          prev.map((q) => {
            if (q.answer && q.answer.id === answerId) {
              return {
                ...q,
                answer: {
                  ...q.answer,
                  likesCount: data.likesCount,
                  hasLiked: !q.answer.hasLiked,
                },
              };
            }
            return q;
          })
        );
      } else {
        notify({
          variant: "error",
          title: "Ошибка",
          message: data.error || "Не удалось оценить ответ.",
        });
      }
    } catch {
      notify({
        variant: "error",
        title: "Ошибка сети",
        message: "Сеть временно недоступна.",
      });
    }
  };

  const handleAdminDeanon = async (questionId: string) => {
    if (deanonLoading) return;
    setDeanonLoading(questionId);

    try {
      const res = await fetch("/api/qa/deanon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDeanonData((prev) => ({
          ...prev,
          [questionId]: {
            username: data.username,
            displayName: data.displayName,
          },
        }));
        notify({
          variant: "success",
          title: "Автор раскрыт",
          message: `Автор: @${data.username}`,
        });
      } else {
        notify({
          variant: "error",
          title: "Ошибка деанона",
          message: data.error || "Не удалось раскрыть автора.",
        });
      }
    } catch {
      notify({
        variant: "error",
        title: "Ошибка сети",
        message: "Сеть временно недоступна.",
      });
    } finally {
      setDeanonLoading(null);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      {/* Шапка/Переключатель вкладок для владельца */}
      {mode === "owner" && (
        <div className="flex gap-2 rounded-2xl bg-white/[0.03] p-1 border border-white/5">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "inbox"
                ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/35"
                : "text-white/60 hover:text-white"
            }`}
          >
            Входящие ({inbox.length})
          </button>
          <button
            onClick={() => setActiveTab("answers")}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "answers"
                ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/35"
                : "text-white/60 hover:text-white"
            }`}
          >
            Моя стена ({questions.length})
          </button>
        </div>
      )}

      {/* Контент: Входящие (только владелец) */}
      {mode === "owner" && activeTab === "inbox" && (
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50 px-1">
            Новые вопросы
          </h3>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-center backdrop-blur-md">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neon-purple border-t-transparent" />
              <p className="mt-2 text-xs text-white/50 font-medium">Загружаем вопросы...</p>
            </div>
          ) : inbox.length === 0 ? (
            <div className="rounded-3xl border border-white/5 bg-black/20 p-8 text-center">
              <p className="text-sm text-white/40">Пока нет новых вопросов.</p>
              <p className="mt-1 text-[10px] text-white/30 uppercase tracking-wider">Поделись профилем, чтобы спросили!</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {inbox.map((q) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-md flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white/90 leading-relaxed">{q.text}</p>
                      <p className="mt-2 text-[9px] text-white/40 uppercase tracking-widest font-black">
                        {q.isAnonymous ? "Анонимно" : q.sender ? `От @${q.sender.username}` : "Открыто"}
                        {" • "}
                        {new Date(q.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>

                    {/* Кнопка админ-деанона */}
                    {isAdmin && q.isAnonymous && (
                      <div>
                        {deanonData[q.id] ? (
                          <div className="text-right">
                            <span className="text-[9px] text-neon-pink font-black uppercase tracking-wider">
                              Раскрыт: @{deanonData[q.id].username}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAdminDeanon(q.id)}
                            disabled={deanonLoading === q.id}
                            className="px-2 py-1 rounded-lg border border-neon-pink/30 hover:border-neon-pink text-[9px] font-black uppercase tracking-wider text-neon-pink/80 hover:text-neon-pink bg-neon-pink/5 hover:bg-neon-pink/10 transition-all"
                          >
                            {deanonLoading === q.id ? "..." : "Деанон"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {answeringId === q.id ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Напиши свой глубокий, ироничный или честный ответ..."
                        maxLength={4000}
                        rows={3}
                        className="w-full rounded-2xl border border-neon-purple/40 bg-black/50 p-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-purple"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-white/40">
                          {answerText.length}/4000
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAnsweringId(null)}
                            className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={() => handleAnswer(q.id)}
                            disabled={submitting || !answerText.trim()}
                            className="px-4 py-1.5 rounded-xl bg-neon-purple/20 border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/30 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                          >
                            {submitting ? "Публикация..." : "Ответить"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAnsweringId(q.id);
                        setAnswerText("");
                      }}
                      className="w-full py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-black uppercase tracking-wider text-white/80 hover:text-white transition-all text-center"
                    >
                      Написать ответ
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Контент: Публичная стена Q&A (или стена ответов в профиле владельца) */}
      {(mode === "public" || (mode === "owner" && activeTab === "answers")) && (
        <div className="flex flex-col gap-6">
          {/* Форма "Задать вопрос" на публичной странице */}
          {mode === "public" && (
            <section className="rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-md">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50 mb-3 px-1">
                Задать вопрос @{username}
              </h3>

              {!isLoggedIn ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 text-center">
                  <p className="text-xs text-white/60">Зайди через Telegram, чтобы задать вопрос.</p>
                  <Link
                    href={`/login?ref=ask_${username}`}
                    className="mt-3 inline-block px-5 py-2 rounded-xl bg-neon-purple/20 border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/30 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                  >
                    Войти в 1 клик
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleAsk} className="flex flex-col gap-4">
                  <textarea
                    value={askText}
                    onChange={(e) => setAskText(e.target.value)}
                    placeholder="Спроси что-нибудь анонимно или открыто..."
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white placeholder-white/30 focus:border-neon-purple focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="rounded border-white/20 bg-black text-neon-purple focus:ring-neon-purple h-4 w-4"
                      />
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                        Анонимно (-15 Ауры)
                      </span>
                    </label>

                    <div className="flex items-center gap-3 ml-auto">
                      <span className="text-[10px] text-white/40">
                        {askText.length}/1000
                      </span>
                      <button
                        type="submit"
                        disabled={submitting || !askText.trim()}
                        className="px-5 py-2.5 rounded-xl bg-neon-purple text-white shadow-[0_0_16px_rgba(180,74,255,0.25)] hover:shadow-[0_0_24px_rgba(180,74,255,0.4)] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:shadow-none"
                      >
                        {submitting ? "Отправка..." : "Спросить"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </section>
          )}

          {/* Лента ответов */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50 px-1">
              Стена ответов
            </h3>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-center backdrop-blur-md">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neon-purple border-t-transparent" />
                <p className="mt-2 text-xs text-white/50 font-medium">Загружаем ответы...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-black/20 p-8 text-center">
                <p className="text-sm text-white/45">На этой стене пока нет ответов.</p>
                <p className="mt-1 text-[10px] text-white/30 uppercase tracking-wider">Спроси первым!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-md flex flex-col gap-4"
                  >
                    {/* Вопрос */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-neon-purple/80">
                          Вопрос
                        </span>
                        <span className="text-[8px] text-white/30 uppercase">
                          {new Date(q.createdAt).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-white/90 leading-relaxed">{q.text}</p>
                      <p className="text-[8px] text-white/40 italic">
                        {q.isAnonymous ? "Анонимно" : q.sender ? `От @${q.sender.username}` : "Открытый вопрос"}
                      </p>
                    </div>

                    {/* Разделитель */}
                    <div className="h-px bg-white/5 w-full" />

                    {/* Ответ */}
                    {q.answer && (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neon-green/80">
                            Ответ
                          </span>
                          <span className="text-[8px] text-white/30 uppercase">
                            {new Date(q.answer.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed font-sans">{q.answer.text}</p>

                        {/* Действия: Лайки */}
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleLike(q.answer!.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${
                              q.answer.hasLiked
                                ? "border-neon-pink/40 bg-neon-pink/10 text-neon-pink"
                                : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20"
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill={q.answer.hasLiked ? "currentColor" : "none"}
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-3.5 h-3.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                              />
                            </svg>
                            <span>{q.answer.likesCount}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
