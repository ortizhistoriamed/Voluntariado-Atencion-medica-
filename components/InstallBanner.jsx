'use client'
import { useState, useEffect } from 'react'
import { Download, Share, X, PlusSquare } from 'lucide-react'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [platform, setPlatform] = useState('android')

  useEffect(() => {
    // Detectar plataforma
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    if (isIOS) setPlatform('ios')

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Mostrar banner manual para iOS si no está instalado
    if (isIOS && !window.navigator.standalone) {
      setTimeout(() => setShowBanner(true), 3000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowBanner(false)
    setDeferredPrompt(null)
  }

  if (!showBanner) return null

  return (
    <div className="fixed top-6 left-4 right-4 z-[100] animate-in slide-in-from-top-10 duration-500">
      <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col gap-4 relative border border-slate-100 ring-1 ring-slate-100">
        <button onClick={() => setShowBanner(false)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 p-1">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-medical-50 p-2 rounded-2xl border border-medical-100 shadow-sm">
            <img src="https://cdn-icons-png.flaticon.com/512/3774/3774299.png" className="w-12 h-12" alt="App Icon" />
          </div>
          <div>
            <h3 className="font-black text-lg uppercase tracking-tight leading-none mb-1 text-slate-900">Instalar Voluntario App</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acceso rápido desde tu pantalla de inicio.</p>
          </div>
        </div>

        {platform === 'android' ? (
          <button 
            onClick={handleInstall}
            className="w-full bg-medical-500 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-medical-600"
          >
            <Download className="w-5 h-5" /> INSTALAR AHORA
          </button>
        ) : (
          <div className="bg-slate-50 p-4 rounded-2xl text-[11px] space-y-3 border border-slate-200">
            <p className="font-black text-medical-600 flex items-center gap-2 uppercase tracking-widest leading-none"><Share className="w-4 h-4" /> Instrucciones iPhone:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 font-bold">
              <li>Pulsa <strong className="text-slate-900">Compartir</strong> <Share className="inline w-3 h-3" /> (abajo)</li>
              <li>Busca <strong className="text-slate-900">"Añadir a pantalla de inicio"</strong></li>
              <li>Pulsa <strong className="text-slate-900">"Añadir"</strong> arriba.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
