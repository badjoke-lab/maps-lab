import type {
  ConfidenceLevel,
  EvidenceKind,
  RecordStatus,
  ReviewState,
  SourceType,
} from "./common";

export type EvidenceLink = {
  id: string;
  label: string;
  url: string;
  kind: EvidenceKind;
};

export type ImageRef = {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  credit?: string;
  sourceUrl?: string;
};

export type BaseMapRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  detail?: string;

  lat: number;
  lng: number;

  country: string;
  region?: string;
  city?: string;
  area?: string;
  address?: string;

  category: string;
  tags: string[];

  images: ImageRef[];
  evidenceLinks: EvidenceLink[];

  status: RecordStatus;
  confidence: ConfidenceLevel;
  sourceType: SourceType;
  reviewState: ReviewState;

  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;

  metadata?: Record<string, string | number | boolean | null>;
};
