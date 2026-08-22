import { ImageResponse } from "next/og";

export const runtime = "edge";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function GET() {
  const patchResponse = await fetch(
    "https://lscsogov.vercel.app/images/lscso-patch-color.png",
    { cache: "no-store" },
  );

  if (!patchResponse.ok) {
    return new Response("Unable to load LSCSO patch", { status: 500 });
  }

  const patchBytes = new Uint8Array(await patchResponse.arrayBuffer());
  const patchSrc = `data:image/png;base64,${bytesToBase64(patchBytes)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          background: "#090a08",
          color: "#f4f3ef",
          padding: "64px 82px",
          position: "relative",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: "8px",
            background: "#c5a95c",
          }}
        />

        <div
          style={{
            width: "280px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "68px",
          }}
        >
          <img
            src={patchSrc}
            width="235"
            height="300"
            style={{ objectFit: "contain" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "58px",
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-1px",
              textTransform: "uppercase",
            }}
          >
            <span>Los Santos County</span>
            <span style={{ color: "#d4b96c", marginTop: "8px" }}>
              Sheriff’s Office
            </span>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "44px",
              fontSize: "23px",
              fontWeight: 700,
              letterSpacing: "6px",
              textTransform: "uppercase",
              color: "#85827c",
            }}
          >
            Driven to Protect. Dedicated to Serve.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "30px",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: "#c5a95c",
            }}
          >
            Established 1963 · State of San Andreas
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
