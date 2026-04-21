import type { BaseMapRecord } from "./base";

export type AtmosphereBestTime = "morning" | "day" | "dusk" | "night" | "rainy" | "any";
export type AtmosphereCrowdFeel = "empty" | "calm" | "lively" | "chaotic";
export type AtmospherePhotoPriority = "low" | "medium" | "high";

export type AtmosphereRecord = BaseMapRecord & {
  appType: "atmosphere";
  moodTags: string[];
  bestTime: AtmosphereBestTime;
  visualStyle?: string[];
  soundFeel?: string[];
  crowdFeel?: AtmosphereCrowdFeel;
  weatherAffinity?: string[];
  photoPriority?: AtmospherePhotoPriority;
  vibeNote?: string;
};
