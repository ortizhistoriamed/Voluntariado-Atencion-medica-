'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { iniciarSesionMedico, getMedico } from '@/lib/session'
import { UserCircle, ShieldCheck, UserPlus, Stethoscope, Loader2, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // login, register
  const [loading, setLoading] = useState(false)
  
  // Login State
  const [cedulaInput, setCedulaInput] = useState('')
  
  // Register State
  const [registerData, setRegisterData] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    especialidad: 'Medicina General',
    correo: ''
  })

  useEffect(() => {
    if (getMedico()) router.push('/')
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!cedulaInput.trim()) return
    setLoading(true)
    
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('cedula', cedulaInput.trim())
        .single()
      
      if (error || !data) {
        alert('Cédula no registrada. Si es tu primera vez, por favor regístrate.')
      } else {
        iniciarSesionMedico(data)
        router.push('/')
      }
    } catch (err) {
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!registerData.cedula || !registerData.nombre || !registerData.apellido) {
      alert('Por favor rellena los campos obligatorios.')
      return
    }
    setLoading(true)
    
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('medicos')
        .insert({
          nombre: registerData.nombre,
          apellido: registerData.apellido,
          cedula: registerData.cedula.trim(),
          especialidad: registerData.especialidad,
          correo: registerData.correo
        })
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') alert('Esta cédula ya existe. Por favor inicia sesión.')
        else alert('Error: ' + error.message)
      } else {
        iniciarSesionMedico(data)
        router.push('/')
      }
    } catch (err) {
      alert('Error de registro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-medical-500 rounded-[32px] shadow-2xl shadow-medical-500/20">
            <Stethoscope className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Voluntario App</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Misión de Atención Médica</p>
        </div>

        {/* Tab Selection */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm flex gap-1 border border-slate-100">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${mode === 'login' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
          >
            Iniciar Sesión
          </button>
          <button 
            onClick={() => setMode('register')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${mode === 'register' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
          >
            Registro
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 space-y-6">
          
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-black text-slate-800">BIENVENIDO, DOCTOR</h2>
                <p className="text-sm text-slate-400 font-medium">Introduce tu cédula para entrar</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cédula de Identidad</label>
                <div className="relative">
                   <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <input 
                    type="tel"
                    placeholder="Solo números"
                    value={cedulaInput}
                    onChange={e => setCedulaInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-medical-500 outline-none font-black text-xl tracking-widest"
                    disabled={loading}
                   />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || !cedulaInput}
                className="w-full py-5 bg-medical-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-medical-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                ENTRAR AL TURNO
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-black text-slate-800">REGISTRO DE MÉDICO</h2>
                <p className="text-sm text-slate-400 font-medium">Únete a la misión del voluntariado</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                   <input 
                    value={registerData.nombre}
                    onChange={e => setRegisterData({...registerData, nombre: e.target.value})}
                    className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-medical-500 outline-none font-bold text-sm"
                    placeholder="Tu nombre"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apellido</label>
                   <input 
                    value={registerData.apellido}
                    onChange={e => setRegisterData({...registerData, apellido: e.target.value})}
                    className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-medical-500 outline-none font-bold text-sm"
                    placeholder="Tu apellido"
                   />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cédula</label>
                 <input 
                  type="tel"
                  value={registerData.cedula}
                  onChange={e => setRegisterData({...registerData, cedula: e.target.value.replace(/\D/g, '')})}
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-medical-500 outline-none font-bold text-lg tracking-widest"
                  placeholder="Solo números"
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Especialidad</label>
                 <select 
                  value={registerData.especialidad}
                  onChange={e => setRegisterData({...registerData, especialidad: e.target.value})}
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-medical-500 outline-none font-bold text-sm"
                 >
                   <option>Medicina General</option>
                   <option>Pediatría</option>
                   <option>Ginecología</option>
                   <option>Cardiología</option>
                   <option>Traumatología</option>
                   <option>Otra</option>
                 </select>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo (Opcional)</label>
                 <input 
                  type="email"
                  value={registerData.correo}
                  onChange={e => setRegisterData({...registerData, correo: e.target.value})}
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-medical-500 outline-none font-bold text-sm"
                  placeholder="doctor@voluntario.com"
                 />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-5 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <UserPlus className="w-6 h-6" />}
                REGISTRARME Y ENTRAR
              </button>
            </form>
          )}

        </div>
        
        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest px-8 leading-relaxed">
          Acceso exclusivo para personal médico autorizado del Voluntariado
        </p>

      </div>
    </div>
  )
}
