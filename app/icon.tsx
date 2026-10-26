import { monogram } from "@/lib/monogram";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return monogram(64, { rounded: true });
}
