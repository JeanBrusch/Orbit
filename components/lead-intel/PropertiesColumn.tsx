'use client'

interface PropertyItem {
  id: string
  title: string
  price: string
  sentAt?: string
  status: 'interessado' | 'visualizado' | 'ignorado' | 'enviado'
}

export function PropertiesColumn({
  properties,
}: {
  properties: PropertyItem[]
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <h2 className="text-xs uppercase tracking-wide text-white/40">
        Imóveis Enviados
      </h2>

      {properties.map(p => (
        <div
          key={p.id}
          className={`rounded-lg border p-3 ${
            p.status === 'interessado'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-white/10 bg-white/5'
          }`}
        >
          <p className="text-sm text-white">{p.title}</p>
          <p className="text-xs text-white/50">{p.price}</p>

          <div className="mt-2 flex items-center justify-between text-xs text-white/60">
            <span>{p.status}</span>
            {p.sentAt && <span>{p.sentAt}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
