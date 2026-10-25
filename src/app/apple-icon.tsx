import { ImageResponse } from "next/og";

// Home-screen icon (iOS/Android "Add to Home Screen"). Same mark as app/icon.svg, drawn
// full-bleed since the OS applies its own rounded mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0f766e" }}>
        <svg width="180" height="180" viewBox="4 4 32 32">
          <path
            d="M20 29.5s-8.5-5-8.5-11a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 6-8.5 11-8.5 11z"
            fill="#f26b4f"
          />
          <path d="M9 31c2-1 4-1 6 .5M31 31c-2-1-4-1-6 .5" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    size
  );
}
