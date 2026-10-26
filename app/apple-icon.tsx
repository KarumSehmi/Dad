import { monogram } from "@/lib/monogram";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iPhones round the corners themselves.
export default function AppleIcon() {
  return monogram(180, { rounded: false });
}
