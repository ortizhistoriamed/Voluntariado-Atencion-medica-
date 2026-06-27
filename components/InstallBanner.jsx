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
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-black text-white p-6 rounded-[32px] shadow-2xl flex flex-col gap-4 relative overflow-hidden ring-4 ring-white/10">
        <button onClick={() => setShowBanner(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-2xl">
            <img src="https://cdn-icons-png.flaticon.com/512/3774/3774299.png" className="w-12 h-12" alt="App Icon" />
          </div>
          <div>
            <h3 className="font-black text-lg uppercase tracking-tight leading-none mb-1">Voluntario App</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instalar en pantalla de inicio</p>
          </div>
        </div>

        {platform === 'android' ? (
          <button 
            onClick={handleInstall}
            className="w-full bg-medical-500 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Download className="w-5 h-5" /> DESCARGAR AHORA
          </button>
        ) : (
          <div className="bg-slate-900 p-4 rounded-2xl text-[11px] space-y-3 border border-white/10">
            <p className="font-black text-medical-400 flex items-center gap-2 uppercase tracking-widest leading-none"><Share className="w-4 h-4" /> Instrucciones iPhone:</p>
            <ol className="list-decimal list-inside space-y-2 text-slate-300 font-medium">
              <li>Pulsa el icono <strong className="text-white">Compartir</strong> <Share className="inline w-3 h-3 text-white" /> (al fondo)</li>
              <li>Selecciona <strong className="text-white">"Añadir a pantalla de inicio"</strong> <PlusSquare className="inline w-3 h-3 text-white" /></li>
              <li>Pulsa <strong className="text-white">"Añadir"</strong> arriba a la derecha.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
