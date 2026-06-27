'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { getMedico } from '@/lib/session'
import { useRouter } from 'next/navigation'
import { 
  Calendar, 
  ArrowLeft, 
  FileText, 
  Download, 
  Loader2, 
  Send,
  User as UserIcon,
  Clock,
  Activity,
  CheckCircle2,
  Trash2
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function JornadaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [consultas, setConsultas] = useState([])
  const [medico, setMedico] = useState(null)
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    const med = getMedico()
    if (!med) {
      router.push('/login')
      return
    }
    setMedico(med)
    fetchConsultas(med.id)
  }, [])

  const fetchConsultas = async (medicoId) => {
    setLoading(true)
    const supabase = getSupabase()
    try {
      const hoy = new Date()
      const inicio = new Date(hoy.setHours(0,0,0,0)).toISOString()
      const fin = new Date(hoy.setHours(23,59,59,999)).toISOString()

      const { data, error } = await supabase
        .from('consultas')
        .select('*')
        .eq('medico_owner_id', medicoId)
        .gte('hora_inicio', inicio)
        .lte('hora_inicio', fin)
        .order('hora_inicio', { ascending: true })

      if (error) throw error
      setConsultas(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const enviarRecipePaciente = (consulta) => {
    const tel = (consulta.paciente_telefono || '').replace(/\D/g, '')
    const numero = tel.startsWith('58') ? tel : `58${tel}`

    const meds = consulta.recipe?.medicamentos?.map(m =>
      `• ${m.nombre} ${m.dosis} — ${m.frecuencia || ''} ${m.duracion || ''}`
    ).join('\n') || 'Ver indicaciones'

    const texto =
      `🏥 *RÉCIPE MÉDICO*\n` +
      `👤 *Paciente:* ${consulta.paciente_nombre || 'Paciente'}\n` +
      `📅 *Fecha:* ${new Date(consulta.hora_inicio).toLocaleDateString('es-VE')}\n` +
      `👨‍⚕️ *Médico:* Dr(a). ${consulta.medico_nombre}\n\n` +
      `💊 *Medicamentos:*\n${meds}\n\n` +
      `📌 *Indicaciones:* ${consulta.recipe?.indicaciones || 'Ver con su médico'}\n` +
      (consulta.recipe?.proxima_cita ? `📅 *Próxima cita:* ${consulta.recipe.proxima_cita}\n` : '') +
      `\n_Voluntariado Médico — Atención de Emergencia_`

    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const enviarReporteGlobalCoordinador = () => {
    const coordinador = localStorage.getItem('whatsapp_coordinador')?.replace(/\D/g, '')
    if (!coordinador) {
        alert("Primero configura el WhatsApp del Coordinador en tu Perfil.")
        return
    }

    const tabla = consultas.map((c, i) => {
        const hora = new Date(c.hora_inicio).toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'})
        const pac = (c.paciente_nombre || 'N/A').padEnd(15).substring(0, 15)
        const dx = (c.diagnostico_presuntivo || 'Sin Dx').padEnd(15).substring(0, 15)
        return `${(i+1).toString().padStart(2)}. ${hora} | ${pac} | ${dx} | ${c.nivel_gravedad}`
    }).join('\n')

    const texto = 
      `📋 *INFORME DE JORNADA MÉDICA*\n` +
      `👨‍⚕️ *Médico:* ${medico?.nombre} ${medico?.apellido}\n` +
      `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}\n` +
      `👥 *Total pacientes:* ${consultas.length}\n\n` +
      `*RESUMEN DE CASOS:*\n` +
      `#  HORA  | PACIENTE        | DIAGNÓSTICO     | GRAV.\n` +
      `----------------------------------------------\n` +
      `${tabla}\n` +
      `----------------------------------------------\n` +
      (observaciones ? `\n📝 *Observaciones:* ${observaciones}\n` : '') +
      `\n_Reporte automático de Gestión Médica_`

    window.open(`https://wa.me/${coordinador}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const enviarReporteIndividualCoordinador = (c) => {
    const coordinador = localStorage.getItem('whatsapp_coordinador')?.replace(/\D/g, '')
    if (!coordinador) {
        alert("Primero configura el WhatsApp del Coordinador en tu Perfil.")
        return
    }

    const texto = 
      `🚨 *ALERTA DE CASO INDIVIDUAL*\n` +
      `👨‍⚕️ *Médico:* ${medico?.nombre} ${medico?.apellido}\n` +
      `👤 *Paciente:* ${c.paciente_nombre}\n` +
      `📝 *Diagnóstico:* ${c.diagnostico_presuntivo}\n` +
      `🚩 *Banderas Rojas:* ${c.banderas_rojas?.join(', ') || 'Ninguna'}\n` +
      `⚠️ *Gravedad:* ${c.nivel_gravedad}\n` +
      `📌 *Plan:* ${c.plan_accion || 'Evaluado'}\n` +
      (c.criterio_derivacion ? `\n❗*REQUIERE EVACUACIÓN/DERIVACIÓN*` : '') +
      `\n_Enviado desde Voluntariado Médico_`

    window.open(`https://wa.me/${coordinador}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const generarPDFJornada = () => {
    const doc = new jsPDF()
    doc.setFontSize(18).text("INFORME DE JORNADA MÉDICA", 105, 20, { align: 'center' })
    
    doc.setFontSize(10)
    doc.text(`Médico: Dr(a). ${medico?.nombre} ${medico?.apellido}`, 20, 35)
    doc.text(`Especialidad: ${medico?.especialidad || 'General'}`, 20, 40)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-VE')}`, 20, 45)
    doc.text(`Total pacientes: ${consultas.length}`, 20, 50)

    const tableData = consultas.map((c, i) => [
      i + 1,
      c.paciente_nombre || 'N/A',
      new Date(c.hora_inicio).toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'}),
      c.diagnostico_presuntivo || 'Sin dx',
      c.nivel_gravedad || 'Leve',
      c.recipe ? '✅' : '❌'
    ])

    doc.autoTable({
      startY: 60,
      head: [['#', 'Paciente', 'Hora', 'Diagnóstico', 'Gravedad', 'Récipe']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#1D512D' }
    })

    const finalY = doc.lastAutoTable.finalY + 10
    doc.text("Observaciones:", 20, finalY)
    doc.setFontSize(9).text(observaciones || "Sin observaciones adicionales.", 20, finalY + 7, { maxWidth: 170 })

    doc.save(`Jornada_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24">
      {/* Header */}
      <header className="bg-white p-6 sticky top-0 z-40 border-b flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="p-3 bg-slate-50 rounded-2xl text-slate-400">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Resumen Jornada</h1>
        <div className="w-12"></div>
      </header>

      <main className="p-6 space-y-8">
        <div className="bg-medical-600 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Atenciones de hoy</p>
            <h2 className="text-6xl font-black tracking-tighter">{consultas.length}</h2>
            <p className="text-sm font-bold opacity-80">Pacientes atendidos en esta jornada</p>
          </div>
          <Calendar className="absolute -bottom-6 -right-6 w-48 h-48 opacity-10" />
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Lista de Pacientes</h3>
          
          {loading ? (
             <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 text-medical-600 animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {consultas.map((c, i) => (
                <div key={c.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-bold border">{i+1}</div>
                      <div>
                        <p className="font-black text-slate-900 uppercase leading-none mb-1">{c.paciente_nombre}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          <Clock className="w-3 h-3" /> {new Date(c.hora_inicio).toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'})}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-white ${
                            c.nivel_gravedad === 'Emergencia' ? 'bg-red-600' :
                            c.nivel_gravedad === 'Urgencia' ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}>{c.nivel_gravedad}</span>
                        </div>
                      </div>
                    </div>
                    {c.recipe && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  </div>

                  <div className="pl-16 space-y-3">
                     <p className="text-sm text-slate-600 font-medium italic">"{c.diagnostico_presuntivo || 'Sin diagnóstico registrado'}"</p>
                     
                     <div className="flex items-center gap-3">
                       {c.paciente_telefono ? (
                         <button 
                           onClick={() => enviarRecipePaciente(c)}
                           className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-[11px] font-black uppercase px-4 py-3 rounded-2xl transition-all shadow-md active:scale-95"
                         >
                           <Send className="w-3 h-3" /> Enviar Récipe
                         </button>
                       ) : (
                         <span className="text-[10px] font-bold text-slate-300 uppercase italic">Sin teléfono registrado</span>
                       )}

                       <button 
                         onClick={() => enviarReporteIndividualCoordinador(c)}
                         className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-black uppercase px-4 py-3 rounded-2xl transition-all shadow-md active:scale-95"
                       >
                         <Activity className="w-3 h-3" /> Alertar Coordinador
                       </button>
                     </div>
                  </div>
                </div>
              ))}
              {consultas.length === 0 && (
                <div className="text-center p-12 bg-white rounded-3xl border-2 border-dashed text-slate-400 italic">No hay consultas registradas para hoy.</div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Observaciones Generales</label>
           <textarea 
             value={observaciones}
             onChange={e => setObservaciones(e.target.value)}
             className="w-full p-6 bg-white rounded-[32px] border border-slate-200 outline-none h-32 text-sm font-medium focus:ring-4 focus:ring-medical-50 transition-all shadow-inner"
             placeholder="Escribe aquí notas sobre la jornada, insumos faltantes o novedades..."
           />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-40 grid grid-cols-2 gap-3">
         <button 
           onClick={generarPDFJornada}
           className="py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-tighter text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all outline-none border border-slate-200"
         >
           <Download className="w-4 h-4" /> Bajar PDF
         </button>
         <button 
           onClick={enviarReporteGlobalCoordinador}
           className="py-5 bg-medical-700 text-white rounded-2xl font-black uppercase tracking-tighter text-[10px] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all outline-none"
         >
           <Send className="w-4 h-4" /> Reportar Cierre
         </button>
      </footer>
    </div>
  )
}
