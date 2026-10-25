import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// App icon: v-1's discipleship-cycle logo (assets/discipleship-cycle.png, copied from
// v-1/public/dj-logo.png) with the Service Team heart in its open center. Rendered by
// app/icon.tsx (browser tab) and app/apple-icon.tsx (home screen).

const HEART = "M20 29.5s-8.5-5-8.5-11a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 6-8.5 11-8.5 11z";
// Teal, not the coral accent — coral would blend into the cycle's red "Empower" arrow
const HEART_COLOR = "#0f766e";

export async function renderBrandIcon(size: number, { background }: { background?: string } = {}) {
  const logo = await readFile(join(process.cwd(), "assets/discipleship-cycle.png"), "base64");
  const heart = Math.round(size * 0.36);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: background ?? "transparent",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>, not next/image */}
        <img
          src={`data:image/png;base64,${logo}`}
          width={background ? size * 0.9 : size}
          height={background ? size * 0.9 : size}
          alt=""
        />
        <svg
          width={heart}
          height={heart}
          viewBox="11 12 18 18"
          style={{ position: "absolute", top: (size - heart) / 2 + size * 0.02, left: (size - heart) / 2 }}
        >
          <path d={HEART} fill={HEART_COLOR} />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
