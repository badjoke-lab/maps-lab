import type { BaseMapRecord } from "./base";
import type { LastChancesRecord } from "./last-chances";

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateBaseRecord(record: BaseMapRecord): ValidationResult {
  const errors: string[] = [];

  if (!record.id) errors.push("id is required");
  if (!record.slug) errors.push("slug is required");
  if (!record.title) errors.push("title is required");
  if (!record.summary) errors.push("summary is required");
  if (!record.country) errors.push("country is required");
  if (!record.category) errors.push("category is required");

  if (!Number.isFinite(record.lat) || record.lat < -90 || record.lat > 90) {
    errors.push("lat must be a finite number between -90 and 90");
  }

  if (!Number.isFinite(record.lng) || record.lng < -180 || record.lng > 180) {
    errors.push("lng must be a finite number between -180 and 180");
  }

  return { ok: errors.length === 0, errors };
}

export function validateLastChancesRecord(record: LastChancesRecord): ValidationResult {
  const base = validateBaseRecord(record);
  const errors = [...base.errors];

  if (record.appType !== "last-chances") errors.push("appType must be 'last-chances'");
  if (!record.disappearanceReason) errors.push("disappearanceReason is required");
  if (!record.urgency) errors.push("urgency is required");

  return { ok: errors.length === 0, errors };
}
