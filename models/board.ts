import mongoose, { Schema, Model, models } from "mongoose";

export interface IBoard {
  userId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  parentBoardId: mongoose.Types.ObjectId | null;
  order: number;
  source: string;
  isPublicShared: boolean;
  publicShareToken: string;
  publicShareRole: "viewer" | "editor";
  shareEntries: {
    email: string;
    invitedUserId?: mongoose.Types.ObjectId | null;
    role: "viewer" | "editor";
    status: "pending" | "accepted";
    invitedAt?: Date;
    acceptedAt?: Date | null;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

const BoardSchema = new Schema<IBoard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    parentBoardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      default: null,
    },
    order: { type: Number, default: 0 },
    source: { type: String, default: "app" },
    isPublicShared: { type: Boolean, default: false },
    publicShareToken: { type: String, default: "", index: true },
    publicShareRole: { type: String, enum: ["viewer", "editor"], default: "editor" },
    shareEntries: [
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        invitedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
        status: { type: String, enum: ["pending", "accepted"], default: "pending" },
        invitedAt: { type: Date, default: Date.now },
        acceptedAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

const Board: Model<IBoard> = models.Board || mongoose.model<IBoard>("Board", BoardSchema);
export default Board;