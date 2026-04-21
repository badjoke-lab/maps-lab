import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LastChancesRecord } from "../../packages/core-schema/src/last-chances";
import { validateLastChancesRecord } from "../../packages/core-schema/src/validators";

type LastChancesSeedInput = {
  title: string;
  country: string;
  city?: string;
  area?: string;
  lat: number;
  lng: number;
  category: string;
  summary: string;
  disappearanceReason: "closure" | "redevelopment" | "demolition" | "decline" | "uncertain" | "other";
  urgency: "low" | "medium" | "high" | "critical";
  sourceLabel: string;
  sourceUrl: string;
  lastSeenAt?: string;
  stillAccessible?: boolean;
  expectedEndDate?: string | null;
  tags?: string[];
  imageUrl?: string;
};

type SeedFile = { records: LastChancesSeedInput[] };

const INPUT_PATH = resolve("data/seeds/last-chances/seed-input.json");
const OUTPUT_PATH = resolve("data/seeds/last-chances/records.generated.json");

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

function hasAny(url: string, needles: readonly string[]): boolean {
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

function detectConfidence(url: string, disappearanceReason: LastChancesSeedInput["disappearanceReason"]): LastChancesRecord["confidence"] {
  const sourceType = detectSourceType(url);
  if (sourceType === "official") return "high";
  if (sourceType === "editorial") return disappearanceReason === "uncertain" ? "low" : "medium";
  if (sourceType === "community") return "low";
  return "medium";
}

function buildRecord(input: LastChancesSeedInput, index: number, nowIso: string): LastChancesRecord {
  const slugBase = compact([input.city, input.area, input.title]).join("-");
  const slug = slugify(slugBase) || `record-${index + 1}`;
  const countrySlug = slugify(input.country) || "unknown-country";
  const citySlug = slugify(input.city || "unknown-city") || "unknown-city";
  const id = `lcm_${countrySlug}_${citySlug}_${slug}_${String(index + 1).padStart(3, "0")}`;
  const sourceType = detectSourceType(input.sourceUrl);
  const evidenceKind = detectEvidenceKind(input.sourceUrl);
  const confidence = detectConfidence(input.sourceUrl, input.disappearanceReason);

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
    createdAt: nowIso,
    updatedAt: nowIso,
    lastVerifiedAt: nowIso,
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

function main() {
  const raw = readFileSync(INPUT_PATH, "utf-8");
  const parsed = JSON.parse(raw) as SeedFile;
  if (!parsed.records || !Array.isArray(parsed.records)) {
    throw new Error("seed-input.json must have { records: [] }");
  }

  const nowIso = new Date().toISOString();
  const records = parsed.records.map((record, index) => buildRecord(record, index, nowIso));
  const errors: string[] = [];

  records.forEach((record, index) => {
    const result = validateLastChancesRecord(record);
    if (!result.ok) {
      result.errors.forEach((error) => {
        errors.push(`records[${index}] ${record.title}: ${error}`);
      });
    }
  });

  if (errors.length > 0) {
    console.error("Validation failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify({ records }, null, 2), "utf-8");
  console.log(`Generated ${records.length} Last Chances records`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main();
