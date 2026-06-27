'use client'

import { useState, useEffect } from 'react'
import { getMedico, cerrarSesionMedico } from '@/lib/session'
import { useRouter } from 'next/navigation'
import { 
  User, 
  ArrowLeft, 
  Save, 
  LogOut, 
  MessageSquare, 
  CheckCircle2,
  Shield,
  CreditCard,
  Mail
} from 'lucide-react'

export default function PerfilPage() {
  const router = useRouter()
  const [medico, setMedico] = useState(null)
  const [whatsappCoordinador, setWhatsappCoordinador] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const med = getMedico()
    if (!med) {
      router.push('/login')
      return
    }
    setMedico(med)
    setWhatsappCoordinador(localStorage.getItem('whatsapp_coordinador') || '')
  }, [])

  const handleSave = () => {
    setSaving(true)
    localStorage.setItem('whatsapp_coordinador', whatsappCoordinador)
    setTimeout(() => {
      setSaving(false)
      alert("Configuración guardada correctamente.")
    }, 500)
  }

  const handleLogout = () => {
    if (confirm("¿Estás seguro que deseas cerrar sesión?")) {
      cerrarSesionMedico(router)
    }
  }

  if (!medico) return null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white p-6 sticky top-0 z-40 border-b flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="p-3 bg-slate-50 rounded-2xl text-slate-400">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Mi Perfil</h1>
        <div className="w-12"></div>
      </header>

      <main className="p-6 space-y-8 pb-32">
        {/* Info del Médico */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Información del Profesional</h3>
          <div className="bg-white rounded-[40px] p-8 shadow-xl space-y-6 border border-slate-100">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-medical-50 rounded-3xl flex items-center justify-center text-medical-600 border border-medical-100">
                <User className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-black text-medical-600 uppercase mb-1">Médico Voluntario</p>
                <h2 className="text-2xl font-black text-slate-900 leading-none">{medico.nombre} {medico.apellido}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-4">
                <Shield className="w-5 h-5 text-slate-300" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Especialidad</p>
                  <p className="font-bold text-slate-700">{medico.especialidad || 'General'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <CreditCard className="w-5 h-5 text-slate-300" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Cédula / MPPS</p>
                  <p className="font-bold text-slate-700">{medico.cedula}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="w-5 h-5 text-slate-300" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Usuario</p>
                  <p className="font-bold text-slate-700 italic text-sm">{medico.email || 'Registro Móvil'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Configuración de Alertas */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Configuración de Contingencia</h3>
          <div className="bg-white rounded-[40px] p-8 shadow-xl space-y-6 border border-slate-100">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-medical-600" />
                <label className="text-sm font-black text-slate-700 uppercase tracking-tight">WhatsApp del Coordinador</label>
              </div>
              <p className="text-xs text-slate-400 font-medium">Este número recibirá las alertas automáticas de banderas rojas críticas.</p>
              <input 
                type="tel"
                value={whatsappCoordinador}
                onChange={e => setWhatsappCoordinador(e.target.value)}
                placeholder="58412XXXXXXX"
                className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-medical-300 outline-none font-bold text-lg"
              />
              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 bg-medical-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />} {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </section>

        {/* Cierre de Sesión */}
        <button 
          onClick={handleLogout}
          className="w-full py-6 bg-red-50 text-red-600 rounded-[32px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 border-red-100 active:scale-95 transition-all"
        >
          <LogOut className="w-6 h-6" /> Cerrar Sesión
        </button>
      </main>
    </div>
  )
}
