'use client'

interface Interaction {
  id: string
  fromMe: boolean
  content: string
  type?: 'text' | 'file' | 'property'
  createdAt: string
}

export function InteractionsColumn({
  interactions,
}: {
  interactions: Interaction[]
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <h2 className="text-xs uppercase tracking-wide text-white/40">
        Interações
      </h2>

      {interactions.map(i => (
        <div
          key={i.id}
          className={`rounded-lg p-3 ${
            i.fromMe
              ? 'border border-white/15 bg-white/10'
              : 'border border-white/5 bg-white/5'
          }`}
        >
          <p className="text-sm text-white/90">{i.content}</p>

          <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
            {i.fromMe && (
              <span className="rounded bg-white/10 px-1.5 py-0.5">
                Enviado
              </span>
            )}
            <span>{i.createdAt}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
