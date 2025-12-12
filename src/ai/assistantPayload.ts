import type { ResolvedFlight } from "../integrations/aeroApiFlightCandidates";

export type PendingAction =
  | {
      type: "create-flight";
      flight: ResolvedFlight;
      memberIds: string[];
      options?: ResolvedFlight[];
    }
  | {
      type: "choose-flight";
      options: ResolvedFlight[];
      memberIds: string[];
    };

export type AssistantPayload = {
  message: string;
  status: "clarify" | "confirm" | "created" | "error";

  // workflow state
  pendingAction?: PendingAction | null;

  // UI helpers
  options?: ResolvedFlight[];
  createdItemId?: string;

  // memory control
  resetContext?: boolean;
};
