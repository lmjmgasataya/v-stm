import { renderBrandIcon } from "@/lib/brandIcon";

// Home-screen icon (iOS/Android "Add to Home Screen"). Same mark as the tab icon on white,
// with a little padding since the OS applies its own rounded mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderBrandIcon(size.width, { background: "#ffffff" });
}
