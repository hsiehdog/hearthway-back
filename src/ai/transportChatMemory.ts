export type PendingAction =
  | {
      type: "create-flight";
      flight: any;
      memberIds: string[];
      options?: any[];
    }
  | {
      type: "choose-flight";
      options: any[];
      memberIds: string[];
    };

export type AssistantPayload = {
  message: string;
  status: "clarify" | "confirm" | "created" | "error";
  pendingAction?: PendingAction | null;
  options?: any[];
  createdItemId?: string;
};

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
    const t = parsed?.pendingAction?.type;
    if (t === "create-flight" || t === "choose-flight")
      return parsed!.pendingAction as PendingAction;
  }
  return null;
}
