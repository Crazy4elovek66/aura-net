export const PROFILE_TAB_ITEMS = [
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
    key: "history",
    label: "Лента",
    description: "Уведомления, лидеры и история ауры",
  },
  {
    key: "shop",
    label: "Эффекты",
    description: "Полезные траты ауры с таймерами",
  },
] as const;

export type ProfileTabKey = (typeof PROFILE_TAB_ITEMS)[number]["key"];

export const DEFAULT_PROFILE_TAB: ProfileTabKey = "profile";

export function normalizeProfileTab(value: string | null | undefined): ProfileTabKey {
  const tab = (value || "").toLowerCase();
  const known = PROFILE_TAB_ITEMS.find((item) => item.key === tab);
  return known?.key || DEFAULT_PROFILE_TAB;
}
