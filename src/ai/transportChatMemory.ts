import type { AssistantPayload, PendingAction } from "./assistantPayload";

export function parseAssistantPayload(
  raw: string | null
): AssistantPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AssistantPayload;
    return parsed && typeof parsed.message === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function buildHistoryMessages(
  records: { prompt: string; response: string }[]
) {
  // Intentionally untyped: avoids CoreMessage deprecation churn.
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const record of records) {
    const parsed = parseAssistantPayload(record.response);

    if (parsed?.resetContext) {
      messages.length = 0;
    }

    messages.push({ role: "user", content: record.prompt });
    messages.push({
      role: "assistant",
      content: parsed?.message ?? record.response ?? "",
    });
  }

  return messages;
}

export function getLatestPendingAction(
  sessions: { response: string }[]
): PendingAction | null {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const parsed = parseAssistantPayload(sessions[i]?.response ?? null);
    if (!parsed) continue;

    // ✅ hard stop: assistant explicitly reset context
    if (parsed.resetContext) return null;

    // ✅ hard stop: assistant explicitly cleared pending action
    // (your toPayload() default sets pendingAction: null)
    if (parsed.pendingAction === null) return null;

    const t = parsed.pendingAction?.type;
    if (t === "create-flight" || t === "choose-flight") {
      return parsed.pendingAction as PendingAction;
    }
  }
  return null;
}
