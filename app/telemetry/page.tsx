import { TelemetryDashboard } from "@/components/telemetry/telemetry-dashboard"
import { OrbitProvider } from "@/components/orbit-context"

export default function TelemetryPage() {
  return (
    <OrbitProvider>
      <TelemetryDashboard />
    </OrbitProvider>
  )
}
