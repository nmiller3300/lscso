import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Los Santos County Sheriff’s Office — Driven to Protect. Dedicated to Serve.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const patchResponse = await fetch(
    "https://lscsogov.vercel.app/images/lscso-patch-color.png",
    { cache: "no-store" },
  );

  if (!patchResponse.ok) {
    throw new Error(`Unable to load LSCSO patch: ${patchResponse.status}`);
  }

  const patch = await patchResponse.arrayBuffer();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#090a08",
          color: "#f4f3ef",
          padding: "70px 84px",
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
            height: 8,
            background: "#c5a95c",
          }}
        />

        <div
          style={{
            width: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 70,
          }}
        >
          <img
            src={patch as unknown as string}
            width="245"
            height="300"
            style={{ objectFit: "contain" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 58,
              lineHeight: 1.03,
              fontWeight: 800,
              letterSpacing: -1.5,
              textTransform: "uppercase",
            }}
          >
            <span>Los Santos County</span>
            <span style={{ color: "#d4b96c", marginTop: 8 }}>Sheriff’s Office</span>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 46,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 7,
              textTransform: "uppercase",
              color: "#85827c",
            }}
          >
            Driven to Protect. Dedicated to Serve.
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 34,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#c5a95c",
            }}
          >
            Established 1963 · State of San Andreas
          </div>
        </div>
      </div>
    ),
    size,
  );
}
