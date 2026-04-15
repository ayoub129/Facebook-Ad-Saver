import mongoose, { Schema, Model, models } from "mongoose";

export interface IAd {
  userId: mongoose.Types.ObjectId;
  boardIds: mongoose.Types.ObjectId[];
  advertiserName: string;
  adLibraryId: string;
  adCopy: string;
  headline: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  domain: string;
  landingPageUrl: string;
  platform: string;
  status: string;
  startDate: string;
  images: string[];
  videos: string[];
  thumbnailUrl: string;
  localImages: string[];
  localVideos: string[];
  localThumbnailUrl: string;
  imageCandidates: string[];
  videoCandidates: string[];
  mediaCacheStatus: "idle" | "processing" | "ok" | "failed";
  mediaCacheError: string;
  mediaCachedAt?: Date;
  refreshStatus: "idle" | "ok" | "failed";
  refreshError: string;
  lastRefreshedAt?: Date;
  rawHtml: string;
  rawPayload: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdSchema = new Schema<IAd>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    boardIds: [{ type: Schema.Types.ObjectId, ref: "Board" }],
    advertiserName: { type: String, default: "" },
    adLibraryId: { type: String, default: "" },
    adCopy: { type: String, default: "" },
    headline: { type: String, default: "" },
    description: { type: String, default: "" },
    ctaText: { type: String, default: "" },
    ctaUrl: { type: String, default: "" },
    domain: { type: String, default: "" },
    landingPageUrl: { type: String, default: "" },
    platform: { type: String, default: "facebook_ad_library" },
    status: { type: String, default: "" },
    startDate: { type: String, default: "" },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    thumbnailUrl: { type: String, default: "" },
    localImages: { type: [String], default: [] },
    localVideos: { type: [String], default: [] },
    localThumbnailUrl: { type: String, default: "" },
    imageCandidates: { type: [String], default: [] },
    videoCandidates: { type: [String], default: [] },
    mediaCacheStatus: { type: String, default: "idle" },
    mediaCacheError: { type: String, default: "" },
    mediaCachedAt: { type: Date, default: null },
    refreshStatus: { type: String, default: "idle" },
    refreshError: { type: String, default: "" },
    lastRefreshedAt: { type: Date, default: null },
    rawHtml: { type: String, default: "" },
    rawPayload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Ad: Model<IAd> = models.Ad || mongoose.model<IAd>("Ad", AdSchema);
export default Ad;