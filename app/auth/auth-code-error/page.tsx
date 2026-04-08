import FeedbackPage from "@/components/ux/FeedbackPage";

export default function AuthErrorPage() {
  return (
    <FeedbackPage
      code="AUTH"
      title="Авторизация не завершилась"
      description="Telegram login оборвался или пришёл с невалидным кодом. Повтори вход и проверь, что открываешь приложение из корректного сценария."
      primaryLabel="Открыть вход"
      primaryHref="/login"
      secondaryLabel="На главную"
      secondaryHref="/"
    />
  );
}
