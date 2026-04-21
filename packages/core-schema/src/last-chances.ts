import type { BaseMapRecord } from "./base";

export type LastChancesDisappearanceReason =
  | "closure"
  | "redevelopment"
  | "demolition"
  | "decline"
  | "uncertain"
  | "other";

export type LastChancesUrgency = "low" | "medium" | "high" | "critical";

export type LastChancesRecord = BaseMapRecord & {
  appType: "last-chances";
  disappearanceReason: LastChancesDisappearanceReason;
  urgency: LastChancesUrgency;
  lastSeenAt?: string;
  lossRiskNote?: string;
  preservationNote?: string;
  stillAccessible?: boolean;
  expectedEndDate?: string | null;
};
