import { NextResponse } from "next/server";

const IMAGE = `PLACEHOLDER`;

export const dynamic = "force-static";

export async function GET() {
  const body = Buffer.from(IMAGE, "base64");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
