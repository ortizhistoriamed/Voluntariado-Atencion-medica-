'use client'
import { Mic } from 'lucide-react'

export default function MicButton({ active, onToggle }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className={`p-2 rounded-full transition-all duration-300 ${
        active 
          ? 'bg-red-500 text-white animate-pulse shadow-lg ring-4 ring-red-200' 
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
      title={active ? "Escuchando..." : "Activar micrófono"}
    >
      <Mic className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
    </button>
  )
}
