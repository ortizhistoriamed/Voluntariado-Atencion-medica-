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
      <div className="bg-medical-900 text-white p-5 rounded-3xl shadow-2xl flex flex-col gap-3 relative overflow-hidden ring-4 ring-medical-500/20">
        <button onClick={() => setShowBanner(false)} className="absolute top-3 right-3 opacity-50 hover:opacity-100">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-lg">
            <img src="https://cdn-icons-png.flaticon.com/512/3774/3774299.png" className="w-10 h-10" alt="App Icon" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight">Instalar Voluntario App</h3>
            <p className="text-[10px] text-medical-200">Acceso rápido desde tu pantalla de inicio.</p>
          </div>
        </div>

        {platform === 'android' ? (
          <button 
            onClick={handleInstall}
            className="w-full bg-medical-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-medical-600 transition-all border-b-4 border-medical-700 active:border-b-0 active:translate-y-1"
          >
            <Download className="w-5 h-5" /> INSTALAR AHORA
          </button>
        ) : (
          <div className="bg-medical-800/50 p-3 rounded-xl text-[10px] space-y-2 border border-medical-700/50">
            <p className="font-bold text-medical-300 flex items-center gap-2 uppercase tracking-widest"><Share className="w-3 h-3" /> Instrucciones para iPhone:</p>
            <ol className="list-decimal list-inside space-y-1 opacity-80">
              <li>Toca el botón <strong>Compartir</strong> <Share className="inline w-3 h-3" /> abajo.</li>
              <li>Baja y selecciona <strong>"Agregar a Inicio"</strong> <PlusSquare className="inline w-3 h-3" /></li>
              <li>Dale a <strong>"Agregar"</strong> arriba a la derecha.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
