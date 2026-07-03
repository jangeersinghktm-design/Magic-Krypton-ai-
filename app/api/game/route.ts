import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json(
    { error: "Game Builder has been removed." },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Game Builder has been removed." },
    { status: 410 }
  );
}
