export async function checkAndApplyDecay() {
  try {
    const response = await fetch("/api/decay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return 0;
    }

    const data = (await response.json()) as { lost?: number };
    return Number(data.lost || 0);
  } catch {
    return 0;
  }
}
