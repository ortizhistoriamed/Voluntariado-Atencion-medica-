'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stethoscope, UserSearch } from 'lucide-react'

export default function Home() {
  const [pacienteId, setPacienteId] = useState('')
  const router = useRouter()

  const irAConsulta = (e) => {
    e.preventDefault()
    if (pacienteId) {
      router.push(`/medico/consulta/${pacienteId}`)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full space-y-8 glass border-2 border-white">
        <div className="text-center">
          <div className="bg-medical-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3 hover:rotate-0 transition-transform">
            <Stethoscope className="text-white w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Portal Medico Voluntario</h1>
          <p className="text-slate-500 text-sm">Ingrese el ID del paciente para iniciar consulta</p>
        </div>

        <form onSubmit={irAConsulta} className="space-y-4">
          <div className="relative">
            <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="UUID del Paciente..."
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-medical-100 focus:border-medical-500 outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-medical-600 text-white rounded-xl font-bold hover:bg-medical-700 active:scale-95 transition-all shadow-lg"
          >
            Iniciar Consulta
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">Desarrollado para Voluntariado Médico</p>
        </div>
      </div>
    </main>
  )
}
