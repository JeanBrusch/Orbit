'use client'

interface MemoryItem {
  id: string
  content: string
  author: string
  createdAt: string
}

export function MemoryColumn({ items }: { items: MemoryItem[] }) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <h2 className="text-xs uppercase tracking-wide text-white/40">
        Memória
      </h2>

      {items.map(item => (
        <div
          key={item.id}
          className="rounded-lg border border-white/10 bg-white/5 p-3"
        >
          <p className="text-sm text-white/90">{item.content}</p>
          <div className="mt-2 text-xs text-white/40">
            {item.author} • {item.createdAt}
          </div>
        </div>
      ))}

      <button className="text-xs text-white/50 hover:text-white">
        + Nova nota
      </button>
    </div>
  )
}
