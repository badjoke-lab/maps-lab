import type { LastChancesRecord } from "@maps-lab/core-schema";
import seed from "../../../data/seeds/last-chances/seed-input.json";

type SeedRecord = (typeof seed.records)[number];

const OFFICIAL_DOMAIN_HINTS = [".gov", ".go.jp", ".gouv.", ".gov.uk", ".edu", ".ac.jp"] as const;
const SOCIAL_DOMAIN_HINTS = ["x.com/", "twitter.com/", "instagram.com/", "reddit.com/", "facebook.com/"] as const;
const EDITORIAL_DOMAIN_HINTS = [
  "wikipedia.org/",
  "atlasobscura.com/",
  "timeout.com/",
  "theguardian.com/",
  "nytimes.com/",
  "bbc.",
  "cnn.com/",
  "standard.co.uk/",
  "lemonde.fr/",
  "japantimes.co.jp/",
  "estie.jp/",
  "konrad.jp/"
] as const;

function hasAny(url: string, needles: readonly string[]) {
  return needles.some((needle) => url.includes(needle));
}

function slugify(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 80);
}

function compact(parts: Array<string | undefined | null>): string[] {
  return parts.filter((value): value is string => Boolean(value && value.trim()));
}

function detectSourceType(url: string): LastChancesRecord["sourceType"] {
  const lower = url.toLowerCase();
  if (hasAny(lower, OFFICIAL_DOMAIN_HINTS)) return "official";
  if (hasAny(lower, SOCIAL_DOMAIN_HINTS)) return "community";
  if (hasAny(lower, EDITORIAL_DOMAIN_HINTS) || lower.includes("local") || lower.includes("news")) return "editorial";
  return "manual";
}

function detectEvidenceKind(url: string): LastChancesRecord["evidenceLinks"][number]["kind"] {
  const lower = url.toLowerCase();
  if (hasAny(lower, OFFICIAL_DOMAIN_HINTS)) return "official";
  if (hasAny(lower, SOCIAL_DOMAIN_HINTS)) return "social";
  if (lower.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/) || lower.includes("/photo") || lower.includes("/image")) return "photo";
  if (hasAny(lower, EDITORIAL_DOMAIN_HINTS) || lower.includes("news") || lower.includes("article") || lower.includes("story") || lower.includes("guardian") || lower.includes("times") || lower.includes("bbc")) return "news";
  return "other";
}

function detectConfidence(url: string, disappearanceReason: SeedRecord["disappearanceReason"]): LastChancesRecord["confidence"] {
  const sourceType = detectSourceType(url);
  if (sourceType === "official") return "high";
  if (sourceType === "editorial") return disappearanceReason === "uncertain" ? "low" : "medium";
  if (sourceType === "community") return "low";
  return "medium";
}

function buildRecord(input: SeedRecord, index: number): LastChancesRecord {
  const slugBase = compact([input.city, input.area, input.title]).join("-");
  const slug = slugify(slugBase) || `record-${index + 1}`;
  const countrySlug = slugify(input.country) || "unknown-country";
  const citySlug = slugify(input.city || "unknown-city") || "unknown-city";
  const id = `lcm_${countrySlug}_${citySlug}_${slug}_${String(index + 1).padStart(3, "0")}`;
  const sourceType = detectSourceType(input.sourceUrl);
  const evidenceKind = detectEvidenceKind(input.sourceUrl);
  const confidence = detectConfidence(input.sourceUrl, input.disappearanceReason);
  const timestamp = "2026-04-21T00:00:00.000Z";

  return {
    id,
    slug,
    appType: "last-chances",
    title: input.title,
    summary: input.summary,
    detail: "",
    lat: input.lat,
    lng: input.lng,
    country: input.country,
    region: undefined,
    city: input.city,
    area: input.area,
    address: undefined,
    category: input.category,
    tags: input.tags ?? [],
    images: input.imageUrl ? [{ id: `${id}_img_001`, url: input.imageUrl, alt: input.title }] : [],
    evidenceLinks: [{ id: `${id}_evi_001`, label: input.sourceLabel, url: input.sourceUrl, kind: evidenceKind }],
    status: "published",
    confidence,
    sourceType,
    reviewState: "none",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastVerifiedAt: timestamp,
    metadata: {},
    disappearanceReason: input.disappearanceReason,
    urgency: input.urgency,
    lastSeenAt: input.lastSeenAt,
    lossRiskNote: "",
    preservationNote: "",
    stillAccessible: input.stillAccessible ?? true,
    expectedEndDate: input.expectedEndDate ?? null
  };
}

const records = seed.records.map((record, index) => buildRecord(record, index));

export function getAllRecords(): LastChancesRecord[] {
  return records;
}

export function getRecordBySlug(slug: string): LastChancesRecord | undefined {
  return records.find((record) => record.slug === slug);
}

export function getFeaturedRecords(): LastChancesRecord[] {
  return [...records]
    .sort((a, b) => {
      const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    })
    .slice(0, 4);
}

export function getRecentlyLost(limit = 4): LastChancesRecord[] {
  return records.filter((record) => record.stillAccessible === false).slice(0, limit);
}

export function getCityCounts(): Array<{ city: string; count: number }> {
  const map = new Map<string, number>();
  for (const record of records) {
    const city = record.city ?? "Unknown";
    map.set(city, (map.get(city) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([city, count]) => ({ city, count }));
}

export function getRelatedRecords(record: LastChancesRecord, limit = 3): LastChancesRecord[] {
  return records
    .filter((candidate) => candidate.id !== record.id)
    .filter((candidate) => candidate.city === record.city || candidate.category === record.category)
    .slice(0, limit);
}

export function projectRecordPoint(record: LastChancesRecord): { left: number; top: number } {
  const lats = records.map((item) => item.lat);
  const lngs = records.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const left = ((record.lng - minLng) / (maxLng - minLng || 1)) * 100;
  const top = ((maxLat - record.lat) / (maxLat - minLat || 1)) * 100;
  return { left, top };
}
