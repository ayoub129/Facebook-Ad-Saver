import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    await connectToDatabase();

    return NextResponse.json({
      success: true,
      message: "MongoDB connected successfully",
    });
  } catch (error) {
    console.error("DB connection error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to MongoDB",
      },
      { status: 500 }
    );
  }
}