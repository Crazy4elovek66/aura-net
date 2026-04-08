import FeedbackPage from "@/components/ux/FeedbackPage";

export default function NotFound() {
  return (
    <FeedbackPage
      code="404"
      title="Страница не найдена"
      description="Маршрут не существует или уже убран. Вернись в приложение и продолжай с рабочего сценария."
      primaryLabel="На главную"
      primaryHref="/"
      secondaryLabel="Открыть профиль"
      secondaryHref="/profile"
    />
  );
}
