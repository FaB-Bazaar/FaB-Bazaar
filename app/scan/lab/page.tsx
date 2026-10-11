import { notFound } from "next/navigation"
import ScanLab from "@/components/scan/ScanLab"

export const dynamic = "force-dynamic"

// Dev-only lab for the in-browser banner scanner (lib/scan/banner): open it on a phone against a LAN dev server
// (`next dev -H 0.0.0.0`) to measure real-device speed. No sign-in — OAuth callbacks don't work on a LAN address.
export default function ScanLabPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <ScanLab />
}
