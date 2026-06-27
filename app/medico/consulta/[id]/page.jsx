'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MicButton from '@/components/MicButton'
import { 
  Plus, 
  Trash2, 
  Send, 
  Download, 
  Save, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Stethoscope, 
  User, 
  History,
  AlertCircle
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function ConsultaPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [paciente, setPaciente] = useState(null)
  const [consultasPrevias, setConsultasPrevias] = useState([])
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [finalizado, setFinalizado] = useState(false)
  const [consultaId, setConsultaId] = useState(null)

  // Estados del Formulario
  const [historia, setHistoria] = useState({
    anamnesis: '',
    examen_fisico: '',
    diagnostico: '',
    notas: ''
  })

  // Estados del Récipe
  const [recipe, setRecipe] = useState({
    diagnostico_confirmado: '',
    medicamentos: [],
    indicaciones: '',
    proxima_cita: ''
  })

  // Estados de Micrófonos
  const [micStates, setMicStates] = useState({
    anamnesis: false,
    examen_fisico: false,
    diagnostico: false
  })

  const recognitionRef = useRef(null)

  useEffect(() => {
    fetchData()
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'es-VE'
      }
    }
  }, [id])

  async function fetchData() {
    try {
      setLoading(true)
      // Cargar datos del paciente
      const { data: pData, error: pError } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', id)
        .single()

      if (pError) throw pError
      setPaciente(pData)

      // Cargar consultas anteriores
      const { data: cData, error: cError } = await supabase
        .from('consultas')
        .select('*, medicos(nombre)')
        .eq('paciente_id', id)
        .order('created_at', { ascending: false })

      if (!cError) setConsultasPrevias(cData)

    } catch (err) {
      console.error("Error al cargar datos:", err)
      // MOCK DATA para desarrollo si falla
      setPaciente({
        id,
        nombre: "Paciente de Prueba",
        edad: 35,
        patologias: "Hipertensión",
        medicamentos: "Enalapril 10mg",
        alergias: "Penicilina",
        motivo_consulta: "Control de rutina",
        telefono: "+584120000000"
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleMic = (field) => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz.")
      return
    }

    if (micStates[field]) {
      recognitionRef.current.stop()
      setMicStates(prev => ({ ...prev, [field]: false }))
    } else {
      // Detener otros mics si están activos
      Object.keys(micStates).forEach(key => {
        if (micStates[key]) setMicStates(prev => ({ ...prev, [key]: false }))
      })

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript
        setHistoria(prev => ({
          ...prev,
          [field]: prev[field] + (prev[field] ? ' ' : '') + transcript
        }))
      }

      recognitionRef.current.onerror = (e) => {
        console.error("Speech Error:", e)
        setMicStates(prev => ({ ...prev, [field]: false }))
      }

      recognitionRef.current.start()
      setMicStates(prev => ({ ...prev, [field]: true }))
    }
  }

  const generarRecipeIA = async () => {
    if (historia.diagnostico.length < 10) return

    setGenerating(true)
    try {
      const res = await fetch('/api/generar-recipe', {
        method: 'POST',
        body: JSON.stringify({
          paciente: {
            nombre: paciente.nombre,
            edad: paciente.edad,
            patologias: paciente.patologias,
            alergias: paciente.alergias,
            medicamentos: paciente.medicamentos
          },
          historia: {
            anamnesis: historia.anamnesis,
            examen_fisico: historia.examen_fisico,
            diagnostico: historia.diagnostico
          }
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setRecipe({
        diagnostico_confirmado: data.diagnostico_confirmado || historia.diagnostico,
        medicamentos: data.medicamentos || [],
        indicaciones: data.indicaciones || '',
        proxima_cita: data.proxima_cita || ''
      })
    } catch (err) {
      alert("Error al generar récipe con Groq. Inténtalo de nuevo.")
    } finally {
      setGenerating(false)
    }
  }

  const handleAddMed = () => {
    setRecipe(prev => ({
      ...prev,
      medicamentos: [...prev.medicamentos, { nombre: '', dosis: '', frecuencia: '', duracion: '' }]
    }))
  }

  const handleMedChange = (index, field, value) => {
    const newMeds = [...recipe.medicamentos]
    newMeds[index][field] = value
    setRecipe(prev => ({ ...prev, medicamentos: newMeds }))
  }

  const handleRemoveMed = (index) => {
    setRecipe(prev => ({
      ...prev,
      medicamentos: prev.medicamentos.filter((_, i) => i !== index)
    }))
  }

  const finalizarConsulta = async () => {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('consultas')
        .insert({
          paciente_id: id,
          medico_id: '88888888-8888-4888-8888-888888888888', // MOCK Medico ID (Reemplazar con Auth)
          anamnesis: historia.anamnesis,
          examen_fisico: historia.examen_fisico,
          diagnostico: historia.diagnostico,
          notas: historia.notas,
          recipe: recipe
        })
        .select()
        .single()

      if (error) throw error
      setConsultaId(data.id)
      setFinalizado(true)
      fetchData() // Recargar historial
    } catch (err) {
      console.error(err)
      alert("Error al guardar en la base de datos.")
    } finally {
      setSaving(false)
    }
  }

  const enviarWhatsApp = () => {
    const texto = `*Récipe Médico*\n*Paciente:* ${paciente.nombre}\n*Fecha:* ${new Date().toLocaleDateString()}\n*Diagnóstico:* ${recipe.diagnostico_confirmado}\n\n*Medicamentos:*\n${recipe.medicamentos.map(m => `- ${m.nombre} ${m.dosis} — ${m.frecuencia} por ${m.duracion}`).join('\n')}\n\n*Indicaciones:* ${recipe.indicaciones}\n\n*Próxima cita:* ${recipe.proxima_cita}`
    window.open(`https://wa.me/${paciente.telefono}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const descargarPDF = () => {
    const doc = new jsPDF()
    const medicoNombre = "Dr. Voluntario" // Reemplazar con Auth
    const fecha = new Date().toLocaleDateString()

    // Header
    doc.setFontSize(10)
    doc.text(`${medicoNombre}\nMédico General\n${fecha}`, 195, 20, { align: 'right' })

    // Título
    doc.setFontSize(18)
    doc.text("RÉCIPE MÉDICO", 105, 45, { align: 'center' })

    // Paciente
    doc.setFontSize(11)
    doc.text(`Paciente: ${paciente.nombre}`, 20, 60)
    doc.text(`Edad: ${paciente.edad} años`, 20, 65)
    doc.text(`Diagnóstico: ${recipe.diagnostico_confirmado}`, 20, 75)

    // Tabla Medicamentos
    const columns = ["Medicamento", "Dosis", "Frecuencia", "Duración"]
    const rows = recipe.medicamentos.map(m => [m.nombre, m.dosis, m.frecuencia, m.duracion])

    doc.autoTable({
      startY: 85,
      head: [columns],
      body: rows,
      theme: 'grid',
      headStyles: { fillStyle: '#0ea5e9' }
    })

    const finalY = doc.lastAutoTable.finalY || 85

    // Indicaciones
    doc.text("Indicaciones:", 20, finalY + 15)
    doc.setFontSize(10)
    const splitText = doc.splitTextToSize(recipe.indicaciones, 170)
    doc.text(splitText, 20, finalY + 22)

    // Pie
    doc.setFontSize(11)
    doc.text(`Próxima cita: ${recipe.proxima_cita || 'N/A'}`, 20, 270)

    doc.save(`Recipe_${paciente.nombre}_${fecha}.pdf`)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-medical-500" />
        <p>Cargando información clínica...</p>
      </div>
    )
  }

  return (
    <main className="max-w-4xl mx-auto p-4 pb-20 space-y-6">
      {/* Header Paciente (Solo lectura) */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
        <div className="bg-medical-100 p-4 rounded-xl flex items-center justify-center">
          <User className="w-12 h-12 text-medical-600" />
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</p>
            <p className="font-semibold text-slate-800">{paciente.nombre}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edad</p>
            <p className="font-semibold text-slate-800">{paciente.edad} años</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alergias</p>
            <p className="font-semibold text-red-600">{paciente.alergias || 'Ninguna'}</p>
          </div>
          <div className="col-span-full border-t pt-2 mt-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Motivo de consulta</p>
            <p className="text-slate-700 italic">"{paciente.motivo_consulta}"</p>
          </div>
        </div>
      </section>

      {/* Formulario de Historia */}
      <section className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 space-y-6">
        <div className="flex items-center gap-2 border-b pb-3 mb-4">
          <Stethoscope className="text-medical-600" />
          <h2 className="text-lg font-bold text-slate-800">Historia Clínica del Día</h2>
        </div>

        {/* Anamnesis */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-slate-600 uppercase tracking-tight">Anamnesis (Interrogatorio)</label>
            <MicButton active={micStates.anamnesis} onToggle={() => toggleMic('anamnesis')} />
          </div>
          <textarea
            value={historia.anamnesis}
            onChange={(e) => setHistoria(prev => ({ ...prev, anamnesis: e.target.value }))}
            className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none"
            placeholder="Relato del paciente..."
          />
        </div>

        {/* Examen Físico */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-slate-600 uppercase tracking-tight">Examen Físico</label>
            <MicButton active={micStates.examen_fisico} onToggle={() => toggleMic('examen_fisico')} />
          </div>
          <textarea
            value={historia.examen_fisico}
            onChange={(e) => setHistoria(prev => ({ ...prev, examen_fisico: e.target.value }))}
            className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none"
            placeholder="Hallazgos físicos..."
          />
        </div>

        {/* Diagnóstico */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-slate-600 uppercase tracking-tight">Diagnóstico Presuntivo</label>
            <MicButton active={micStates.diagnostico} onToggle={() => toggleMic('diagnostico')} />
          </div>
          <textarea
            value={historia.diagnostico}
            onChange={(e) => setHistoria(prev => ({ ...prev, diagnostico: e.target.value }))}
            className="w-full min-h-[80px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none font-medium"
            placeholder="Conclusión del médico..."
          />
        </div>

        {/* Botón IA */}
        <div className="flex justify-center py-4">
          <button
            onClick={generarRecipeIA}
            disabled={generating || historia.diagnostico.length < 10}
            className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 active:scale-95
              ${generating || historia.diagnostico.length < 10 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-medical-600 text-white shadow-xl hover:bg-medical-700'}`}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" />
                <span>Generando Récipe...</span>
              </>
            ) : (
              <>
                <History className="w-5 h-5" />
                <span>Generar Récipe con IA</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Sección de Récipe (Solo si hay datos o está generado/editando) */}
      {(recipe.medicamentos.length > 0 || recipe.diagnostico_confirmado) && (
        <section className="bg-blue-50 rounded-2xl p-6 shadow-inner border-2 border-blue-200 space-y-6">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-4">
            <h2 className="text-xl font-black text-blue-900 flex items-center gap-2">
              <Plus className="bg-white rounded-full p-1 text-blue-600" />
              RÉCIPE MÉDICO
            </h2>
            {recipe.medicamentos.length === 0 && <AlertCircle className="text-blue-400 animate-bounce" />}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-blue-700 uppercase">Diagnóstico Confirmado</label>
              <input
                type="text"
                value={recipe.diagnostico_confirmado}
                onChange={(e) => setRecipe(prev => ({ ...prev, diagnostico_confirmado: e.target.value }))}
                className="w-full p-2 bg-white border border-blue-200 rounded-lg outline-none"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-blue-800">Medicamentos</p>
                <button onClick={handleAddMed} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:bg-blue-700">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
              
              <div className="space-y-2">
                {recipe.medicamentos.map((med, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 bg-white p-3 rounded-lg border border-blue-100 shadow-sm items-end">
                    <div className="col-span-12 md:col-span-4">
                      <label className="text-[10px] text-slate-400 uppercase">Medicamento</label>
                      <input 
                        value={med.nombre} 
                        onChange={(e) => handleMedChange(idx, 'nombre', e.target.value)}
                        className="w-full text-sm font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="text-[10px] text-slate-400 uppercase">Dosis</label>
                      <input 
                        value={med.dosis} 
                        onChange={(e) => handleMedChange(idx, 'dosis', e.target.value)}
                        className="w-full text-sm outline-none"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-3">
                      <label className="text-[10px] text-slate-400 uppercase">Frecuencia</label>
                      <input 
                        value={med.frecuencia} 
                        onChange={(e) => handleMedChange(idx, 'frecuencia', e.target.value)}
                        className="w-full text-sm outline-none"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <label className="text-[10px] text-slate-400 uppercase">Días</label>
                      <input 
                        value={med.duracion} 
                        onChange={(e) => handleMedChange(idx, 'duracion', e.target.value)}
                        className="w-full text-sm outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => handleRemoveMed(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">Indicaciones Adicionales</label>
              <textarea
                value={recipe.indicaciones}
                onChange={(e) => setRecipe(prev => ({ ...prev, indicaciones: e.target.value }))}
                className="w-full min-h-[80px] p-3 bg-white border border-blue-200 rounded-xl outline-none"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-blue-700 uppercase">Próxima Cita</label>
                <input
                  type="date"
                  value={recipe.proxima_cita}
                  onChange={(e) => setRecipe(prev => ({ ...prev, proxima_cita: e.target.value }))}
                  className="w-full p-2 bg-white border border-blue-200 rounded-lg outline-none"
                />
              </div>
            </div>

            {!finalizado ? (
              <button
                onClick={finalizarConsulta}
                disabled={saving}
                className="w-full py-4 bg-medical-600 text-white rounded-xl font-black shadow-lg hover:bg-medical-700 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                FINALIZAR Y GUARDAR CONSULTA
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button
                  onClick={enviarWhatsApp}
                  className="flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-bold shadow-md hover:bg-green-600 transition-all"
                >
                  <Send className="w-5 h-5" /> WhatsApp
                </button>
                <button
                  onClick={descargarPDF}
                  className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-md hover:bg-slate-900 transition-all"
                >
                  <Download className="w-5 h-5" /> Descargar PDF
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Historial Colapsable */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-all"
        >
          <div className="flex items-center gap-2">
            <History className="text-slate-400" />
            <h3 className="font-bold text-slate-700">Consultas Anteriores ({consultasPrevias.length})</h3>
          </div>
          {historyExpanded ? <ChevronUp /> : <ChevronDown />}
        </button>

        {historyExpanded && (
          <div className="p-4 border-t divide-y">
            {consultasPrevias.length > 0 ? (
              consultasPrevias.map((c, i) => (
                <div key={i} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-slate-800">{new Date(c.created_at).toLocaleDateString()}</p>
                    <p className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{c.medicos?.nombre || 'Dr. Voluntario'}</p>
                  </div>
                  <p className="text-sm text-slate-600"><span className="font-bold">Diagnóstico:</span> {c.diagnostico}</p>
                  <details className="mt-2 group">
                    <summary className="text-xs text-medical-600 cursor-pointer font-bold hover:underline list-none">
                      Ver récipe completo...
                    </summary>
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs space-y-2">
                      <p><span className="font-bold">Medicamentos:</span> {c.recipe?.medicamentos?.map(m => m.nombre).join(', ') || 'N/A'}</p>
                      <p><span className="font-bold">Indicaciones:</span> {c.recipe?.indicaciones || 'Ninguna'}</p>
                    </div>
                  </details>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 py-4 italic">No hay historial previo para este paciente.</p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
