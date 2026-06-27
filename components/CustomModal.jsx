'use client'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export default function CustomModal({ isOpen, onClose, type = 'info', title, message }) {
  if (!isOpen) return null

  const icons = {
    info: <Info className="text-blue-500 w-12 h-12" />,
    success: <CheckCircle2 className="text-green-500 w-12 h-12" />,
    error: <AlertCircle className="text-red-500 w-12 h-12" />
  }

  const colors = {
    info: 'border-blue-100',
    success: 'border-green-100',
    error: 'border-red-100'
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative bg-white w-full max-w-xs p-8 rounded-[40px] shadow-2xl border-2 ${colors[type]} animate-in zoom-in-95 duration-300 text-center space-y-4`}>
        <div className="flex justify-center">{icons[type]}</div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{title}</h3>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
        <button 
          onClick={onClose}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
        >
          ENTENDIDO
        </button>
      </div>
    </div>
  )
}
