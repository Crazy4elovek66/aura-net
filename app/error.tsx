"use client";

import { useEffect } from "react";
import FeedbackPage from "@/components/ux/FeedbackPage";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <FeedbackPage
      code="ERROR"
      title="Что-то сломалось"
      description="Приложение поймало необработанную ошибку. Попробуй повторить действие. Если сбой повторяется, лучше вернуться на стабильный экран."
      primaryLabel="Повторить"
      onPrimaryClick={unstable_retry}
      secondaryLabel="На главную"
      secondaryHref="/"
    />
  );
}
