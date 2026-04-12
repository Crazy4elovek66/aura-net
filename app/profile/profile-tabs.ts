export const PROFILE_TAB_ITEMS = [
  {
    key: "profile",
    label: "Профиль",
    description: "Статус и базовые действия",
  },
  {
    key: "progress",
    label: "Прогресс",
    description: "Гонка, цели и динамика",
  },
  {
    key: "circle",
    label: "Круг",
    description: "Люди, инвайты и шэринг",
  },
  {
    key: "history",
    label: "Активность",
    description: "История и события",
  },
  {
    key: "shop",
    label: "Магазин",
    description: "Траты и эффекты",
  },
] as const;

export type ProfileTabKey = (typeof PROFILE_TAB_ITEMS)[number]["key"];

export const DEFAULT_PROFILE_TAB: ProfileTabKey = "profile";

export function normalizeProfileTab(value: string | null | undefined): ProfileTabKey {
  const tab = (value || "").toLowerCase();
  const known = PROFILE_TAB_ITEMS.find((item) => item.key === tab);
  return known?.key || DEFAULT_PROFILE_TAB;
}
