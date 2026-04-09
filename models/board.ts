import mongoose, { Schema, Model, models } from "mongoose";

export interface IBoard {
  userId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  parentBoardId: mongoose.Types.ObjectId | null;
  order: number;
  source: string;
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
  },
  { timestamps: true }
);

const Board: Model<IBoard> = models.Board || mongoose.model<IBoard>("Board", BoardSchema);
export default Board;