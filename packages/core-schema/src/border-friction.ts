import type { BaseMapRecord } from "./base";

export type BorderFrictionCrossingType =
  | "land-border"
  | "airport"
  | "seaport"
  | "city-access-zone";

export type BorderFrictionAdvisoryStatus = "normal" | "watch" | "warning";

export type BorderFrictionRecord = BaseMapRecord & {
  appType: "border-friction";
  crossingType: BorderFrictionCrossingType;
  vehicleTypes?: string[];
  laneTypes?: string[];
  docsNeeded?: string[];
  trustedPrograms?: string[];
  officialSourceUrl?: string;
  advisoryStatus?: BorderFrictionAdvisoryStatus;
  currentWaitMinutes?: number | null;
  historicalWaitLabel?: string | null;
  openHoursNote?: string;
  nearbyAlternativeIds?: string[];
};
