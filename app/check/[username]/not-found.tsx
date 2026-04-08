import FeedbackPage from "@/components/ux/FeedbackPage";

export default function ProfileNotFound() {
  return (
    <FeedbackPage
      code="PROFILE"
      title="Профиль не найден"
      description="Такого публичного профиля сейчас нет. Возможно, ник изменился или ссылка была битой."
      primaryLabel="К разведке"
      primaryHref="/discover"
      secondaryLabel="На главную"
      secondaryHref="/"
    />
  );
}
