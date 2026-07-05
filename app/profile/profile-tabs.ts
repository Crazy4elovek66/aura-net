export const ALL_PROFILE_TAB_ITEMS = [
  {
    key: "profile",
    label: "Профиль",
    description: "Карточка, награда дня и быстрые действия",
  },
  {
    key: "progress",
    label: "Маршрут",
    description: "Куда расти и что сделать следующим",
  },
  {
    key: "circle",
    label: "Круг",
    description: "Друзья, инвайты и поводы поделиться",
  },
  {
    key: "qa",
    label: "Вопросы",
    description: "Входящие вопросы и твои ответы на них",
  },
  {
    key: "history",
    label: "Лента",
    description: "Уведомления, лидеры и история ауры",
  },
  {
    key: "shop",
    label: "Магазин",
    description: "Полезные траты ауры с таймерами",
  },
] as const;

export type ProfileTabKey = (typeof ALL_PROFILE_TAB_ITEMS)[number]["key"];

// Активные вкладки в интерфейсе (Маршрут и Лента временно скрыты)
export const PROFILE_TAB_ITEMS = [
  ALL_PROFILE_TAB_ITEMS[0], // profile (Профиль)
  ALL_PROFILE_TAB_ITEMS[2], // circle (Круг)
  ALL_PROFILE_TAB_ITEMS[3], // qa (Вопросы)
  ALL_PROFILE_TAB_ITEMS[5], // shop (Магазин)
] as const;

export const DEFAULT_PROFILE_TAB: ProfileTabKey = "profile";

export function normalizeProfileTab(value: string | null | undefined): ProfileTabKey {
  const tab = (value || "").toLowerCase();
  const known = PROFILE_TAB_ITEMS.find((item) => item.key === tab);
  return known?.key || DEFAULT_PROFILE_TAB;
}
