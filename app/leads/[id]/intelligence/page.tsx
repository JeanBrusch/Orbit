import { redirect } from "next/navigation"

// This route was merged into /lead/[id] — redirect there
export default async function LeadIntelligencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/lead/${id}`)
}
