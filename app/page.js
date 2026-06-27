'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import MicButton from '@/components/MicButton'
import { 
  Search, 
  UserPlus, 
  Stethoscope, 
  ClipboardCheck, 
  UserCircle,
  Plus,
  Trash2,
  Send,
  Download,
  Save,
  Loader2,
  History as HistoryIcon,
  Mic,
  ArrowRight,
  User as UserIcon,
  Calendar
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function App() {
  // Navegación
  const [activeTab, setActiveTab] = useState('search') // search, patient, clinic, recipe, settings
  
  // Estados Globales
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [finalizado, setFinalizado] = useState(false)

  // Datos
  const [medico, setMedico] = useState({ nombre: '', especialidad: '', registro: '' })
  const [paciente, setPaciente] = useState({ id: '', nombre: '', edad: '', cedula: '', telefono: '', alergias: '', patologias: '', motivo_consulta: '' })
  const [historia, setHistoria] = useState({ anamnesis: '', examen_fisico: '', diagnostico: '', notas: '' })
  const [recipe, setRecipe] = useState({ diagnostico_confirmado: '', medicamentos: [], indicaciones: '', proxima_cita: '' })

  // Mic y Voz
  const [globalMicActive, setGlobalMicActive] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('medico_data')
    if (saved) setMedico(JSON.parse(saved))

    if (typeof window !== 'undefined') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recognitionRef.current = new SR()
        recognitionRef.current.continuous = true
        recognitionRef.current.lang = 'es-VE'
      }
    }
  }, [])

  // Buscador
  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 3) return setSearchResults([])
    
    const { data } = await supabase
      .from('pacientes')
      .select('*')
      .or(`nombre.ilike.%${query}%,cedula.ilike.%${query}%`)
      .limit(5)
    
    setSearchResults(data || [])
  }

  const selectPatient = (p) => {
    setPaciente({ ...p, id: p.id, medicamentos_previos: p.medicamentos || '' })
    setSearchResults([])
    setActiveTab('patient')
  }

  // AI Voice Assistant (Estructurador)
  const toggleGlobalMic = () => {
    if (globalMicActive) {
      recognitionRef.current.stop()
      setGlobalMicActive(false)
    } else {
      let fullTranscript = ''
      recognitionRef.current.onresult = (e) => {
        fullTranscript += ' ' + e.results[e.results.length - 1][0].transcript
      }
      recognitionRef.current.onend = async () => {
        if (fullTranscript.trim()) structureWithAI(fullTranscript)
      }
      recognitionRef.current.start()
      setGlobalMicActive(true)
    }
  }

  const structureWithAI = async (text) => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/structurar-historia', {
        method: 'POST',
        body: JSON.stringify({ rawText: text })
      })
      const data = await res.json()
      setHistoria({
        anamnesis: data.anamnesis || '',
        examen_fisico: data.examen_fisico || '',
        diagnostico: data.diagnostico || '',
        notas: ''
      })
      setActiveTab('clinic')
    } catch (err) { alert("Error estructurando con Groq") }
    finally { setAiLoading(false) }
  }

  const generarRecipeIA = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/generar-recipe', {
        method: 'POST',
        body: JSON.stringify({ paciente, historia })
      })
      const data = await res.json()
      setRecipe({
        diagnostico_confirmado: data.diagnostico_confirmado || historia.diagnostico,
        medicamentos: data.medicamentos || [],
        indicaciones: data.indicaciones || '',
        proxima_cita: data.proxima_cita || ''
      })
      setActiveTab('recipe')
    } catch (err) { alert("Error generando récipe") }
    finally { setAiLoading(false) }
  }

  const finalizarYGuardar = async () => {
    setSaving(true)
    try {
      // Upsert Paciente
      const { data: pData } = await supabase
        .from('pacientes')
        .upsert({ 
          nombre: paciente.nombre, 
          cedula: paciente.cedula,
          edad: paciente.edad, 
          telefono: paciente.telefono,
          alergias: paciente.alergias 
        }, { onConflict: 'cedula' })
        .select().single()

      // Guardar Consulta
      await supabase.from('consultas').insert({
        paciente_id: pData.id,
        medico_id: '88888888-8888-4888-8888-888888888888',
        anamnesis: historia.anamnesis,
        examen_fisico: historia.examen_fisico,
        diagnostico: historia.diagnostico,
        recipe: recipe
      })
      setFinalizado(true)
    } catch (err) { alert("Error al guardar") }
    finally { setSaving(false) }
  }

  // PDF
  const descargarPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(10).text(`${medico.nombre}\n${medico.especialidad}\nDoc: ${medico.registro}`, 195, 20, { align: 'right' })
    doc.setFontSize(22).text("RÉCIPE MÉDICO", 105, 50, { align: 'center' })
    doc.setFontSize(11).text(`Paciente: ${paciente.nombre}\nCédula: ${paciente.cedula}\nFecha: ${new Date().toLocaleDateString()}`, 20, 70)
    doc.autoTable({
      startY: 90,
      head: [["Medicamento", "Dosis", "Frecuencia", "Duración"]],
      body: recipe.medicamentos.map(m => [m.nombre, m.dosis, m.frecuencia, m.duracion]),
      headStyles: { fillColor: [14, 165, 233] }
    })
    doc.text(`Indicaciones: ${recipe.indicaciones}`, 20, doc.lastAutoTable.finalY + 15)
    doc.save(`Recipe_${paciente.cedula}.pdf`)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Header Dinámico */}
      <header className="bg-white px-6 py-4 border-b flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-black text-medical-600 tracking-tighter">VOLUNTARIO APP</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase">{activeTab}</p>
        </div>
        {activeTab === 'search' && (
          <button onClick={() => { setPaciente({ nombre:'', edad:'', cedula:'', telefono:'', alergias:'' }); setActiveTab('patient'); }} className="bg-medical-500 text-white p-2 rounded-full shadow-lg">
            <Plus className="w-6 h-6" />
          </button>
        )}
      </header>

      {/* Area Principal */}
      <main className="flex-1 overflow-y-auto p-4 mb-20">
        
        {/* PANTALLA: BUSCADOR */}
        {activeTab === 'search' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="relative">
              <Search className="absolute left-4 top-4 text-slate-400" />
              <input 
                placeholder="Buscar por Nombre o Cédula..." 
                className="w-full p-4 pl-12 bg-white rounded-2xl shadow-xl outline-none border-2 border-transparent focus:border-medical-300 transition-all"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {searchResults.length > 0 ? (
                searchResults.map(p => (
                  <button key={p.id} onClick={() => selectPatient(p)} className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-medical-300">
                    <div className="text-left">
                      <p className="font-bold text-slate-700">{p.nombre}</p>
                      <p className="text-xs text-slate-400">{p.cedula}</p>
                    </div>
                    <ArrowRight className="text-medical-500" />
                  </button>
                ))
              ) : searchQuery.length >= 3 && (
                <div className="text-center p-10 text-slate-400 italic">No hay resultados. Crea un paciente nuevo.</div>
              )}
            </div>

            {/* Recientes/Dashboard */}
            <div className="pt-4">
              <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Atenciones de hoy</h3>
              <div className="bg-white rounded-3xl p-6 text-center border-2 border-dashed border-slate-200">
                <HistoryIcon className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Inicia una búsqueda o crea un nuevo paciente para empezar.</p>
              </div>
            </div>
          </div>
        )}

        {/* PANTALLA: DATOS PACIENTE */}
        {activeTab === 'patient' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6 animate-in slide-in-from-bottom-5">
            <h2 className="text-xl font-bold flex items-center gap-2"><UserIcon className="text-medical-500" /> Datos de Registro</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre</label>
                  <input value={paciente.nombre} onChange={e=>setPaciente({...paciente, nombre:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border active:border-medical-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Cédula / ID</label>
                  <input value={paciente.cedula} onChange={e=>setPaciente({...paciente, cedula:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Edad</label>
                  <input type="number" value={paciente.edad} onChange={e=>setPaciente({...paciente, edad:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Alergias</label>
                <input value={paciente.alergias} onChange={e=>setPaciente({...paciente, alergias:e.target.value})} className="w-full p-3 bg-red-50 text-red-600 rounded-xl outline-none border border-red-100 font-bold" />
              </div>
            </div>
            <button onClick={()=>setActiveTab('clinic')} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-bold shadow-xl">Iniciar Historia Clínica</button>
          </div>
        )}

        {/* PANTALLA: CLINICA (GROQ ASSISTANT) */}
        {activeTab === 'clinic' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5 pb-20">
            <div className="bg-medical-900 text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden">
               <div className="absolute right-0 top-0 w-32 h-32 bg-medical-500/10 rounded-full -mr-16 -mt-16"></div>
               <h2 className="text-xl font-bold mb-1 relative z-10">Asistente de Consulta</h2>
               <p className="text-xs text-medical-200 relative z-10">Presiona el micro y descríbeme el caso. Yo lo estructuraré por ti.</p>
               
               <button 
                  onClick={toggleGlobalMic}
                  className={`mt-6 w-full py-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-xl ${globalMicActive ? 'bg-red-500 animate-pulse' : 'bg-white text-medical-900 hover:bg-medical-50'}`}
               >
                 {globalMicActive ? <Loader2 className="animate-spin w-8 h-8" /> : <Mic className="w-8 h-8" />}
                 <span className="font-black text-sm">{globalMicActive ? 'ESCUCHANDO...' : 'DICTAR HISTORIA COMPLETA'}</span>
               </button>
            </div>

            {aiLoading && <div className="text-center p-4 bg-white rounded-2xl shadow-sm border border-medical-100 flex items-center justify-center gap-3"><Loader2 className="animate-spin text-medical-600" /> <span className="font-bold text-medical-800 italic">Estructurando relato médico...</span></div>}

            <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4 border border-slate-100">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase">Anamnesis</label>
                 <textarea value={historia.anamnesis} onChange={e=>setHistoria({...historia, anamnesis:e.target.value})} className="w-full p-3 h-32 bg-slate-50 rounded-xl outline-none text-sm" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase">Examen Físico</label>
                 <textarea value={historia.examen_fisico} onChange={e=>setHistoria({...historia, examen_fisico:e.target.value})} className="w-full p-3 h-24 bg-slate-50 rounded-xl outline-none text-sm" />
               </div>
               <div className="p-4 bg-medical-50 rounded-2xl border border-medical-100">
                 <label className="text-[10px] font-black text-medical-600 uppercase">Diagnóstico Presuntivo</label>
                 <textarea value={historia.diagnostico} onChange={e=>setHistoria({...historia, diagnostico:e.target.value})} className="w-full bg-transparent p-0 h-16 outline-none font-bold text-medical-900" />
               </div>
               <button onClick={generarRecipeIA} disabled={aiLoading} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg">
                 Generar Récipe con IA <ArrowRight className="w-5 h-5"/>
               </button>
            </div>
          </div>
        )}

        {/* PANTALLA: RECIPE */}
        {activeTab === 'recipe' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5">
            <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Récipe Sugerido</h2>
                <p className="text-xs text-blue-100 italic">Revisa y edita los fármacos o dosis.</p>
              </div>
              <ClipboardCheck className="w-10 h-10 opacity-50" />
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-xl space-y-6 border border-blue-100">
               <div className="space-y-3">
                 <div className="flex justify-between items-center"><p className="font-bold text-slate-700">Medicamentos</p> <button onClick={() => setRecipe({...recipe, medicamentos: [...recipe.medicamentos, {nombre:'', dosis:'', frecuencia:'', duracion:''}]})} className="text-blue-500 text-xs font-bold">+ Agregar</button></div>
                 <div className="space-y-2">
                   {recipe.medicamentos.map((m,i) => (
                     <div key={i} className="flex gap-2 bg-slate-50 p-2 rounded-xl items-center">
                       <input value={m.nombre} onChange={e=>{const n=[...recipe.medicamentos]; n[i].nombre=e.target.value; setRecipe({...recipe, medicamentos:n})}} className="flex-1 bg-transparent text-sm font-bold outline-none" />
                       <input value={m.dosis} onChange={e=>{const n=[...recipe.medicamentos]; n[i].dosis=e.target.value; setRecipe({...recipe, medicamentos:n})}} className="w-16 bg-transparent text-xs outline-none" placeholder="Dosis" />
                       <button onClick={()=>{const n=[...recipe.medicamentos]; n.splice(i,1); setRecipe({...recipe, medicamentos:n})}} className="text-red-400"><Trash2 className="w-4 h-4"/></button>
                     </div>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase">Indicaciones Generales</label>
                 <textarea value={recipe.indicaciones} onChange={e=>setRecipe({...recipe, indicaciones:e.target.value})} className="w-full p-3 h-24 bg-slate-50 rounded-xl outline-none text-sm" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Próxima Cita</label>
                   <input type="date" value={recipe.proxima_cita} onChange={e=>setRecipe({...recipe, proxima_cita:e.target.value})} className="w-full p-2 bg-slate-50 rounded-lg text-sm border-0" />
                 </div>
               </div>

               {!finalizado ? (
                 <button onClick={finalizarYGuardar} className="w-full py-4 bg-medical-700 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                   {saving ? <Loader2 className="animate-spin" /> : <Save />} CERRAR Y GUARDAR CONSULTA
                 </button>
               ) : (
                 <div className="grid grid-cols-2 gap-4">
                   <button onClick={descargarPDF} className="p-3 bg-slate-800 text-white rounded-xl shadow-md font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4" /> PDF</button>
                   <button onClick={()=>window.open(`https://wa.me/${paciente.telefono}?text=Hola, tu récipe está listo.`)} className="p-3 bg-green-500 text-white rounded-xl shadow-md font-bold flex items-center justify-center gap-2"><Send className="w-4 h-4" /> WhatsApp</button>
                   <button onClick={() => window.location.reload()} className="col-span-2 text-medical-600 font-bold underline py-2">Nueva Consulta</button>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* PANTALLA: PERFIL MEDICO */}
        {activeTab === 'profile' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6 animate-in slide-in-from-bottom-5">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><UserCircle className="text-medical-500" /> Perfil Profesional</h2>
            <div className="space-y-4">
               <div><label className="text-[10px] font-bold text-slate-400">Nombre del Médico</label><input value={medico.nombre} onChange={e=>setMedico({...medico, nombre:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border outline-none" /></div>
               <div><label className="text-[10px] font-bold text-slate-400">Especialidad</label><input value={medico.especialidad} onChange={e=>setMedico({...medico, especialidad:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border outline-none" /></div>
               <div><label className="text-[10px] font-bold text-slate-400">Registro Médico / ID Sanitario</label><input value={medico.registro} onChange={e=>setMedico({...medico, registro:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border outline-none" /></div>
               <button onClick={() => {localStorage.setItem('medico_data', JSON.stringify(medico)); alert("Guardado");}} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-bold shadow-lg">Guardar Cambios Localmente</button>
            </div>
          </div>
        )}

      </main>

      {/* Navegación Inferior (Estilo Móvil Premium) */}
      <nav className="bg-white border-t p-3 flex justify-around items-center space-x-2 sticky bottom-0 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('search')} className={`flex flex-col items-center flex-1 p-2 rounded-xl transition-all ${activeTab === 'search' ? 'text-medical-600 bg-medical-50' : 'text-slate-400 hover:text-slate-600'}`}>
          <Search className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-tight">Buscar</span>
        </button>
        <button onClick={() => setActiveTab('patient')} className={`flex flex-col items-center flex-1 p-2 rounded-xl transition-all ${activeTab === 'patient' ? 'text-medical-600 bg-medical-50' : 'text-slate-400 hover:text-slate-600'}`}>
          <UserIcon className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-tight">Paciente</span>
        </button>
        <button onClick={() => setActiveTab('clinic')} className={`flex flex-col items-center flex-1 p-2 rounded-xl transition-all ${activeTab === 'clinic' ? 'text-medical-600 bg-medical-50' : 'text-slate-400 hover:text-slate-600'}`}>
          <Stethoscope className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-tight">Consulta</span>
        </button>
        <button onClick={() => setActiveTab('recipe')} className={`flex flex-col items-center flex-1 p-2 rounded-xl transition-all ${activeTab === 'recipe' ? 'text-medical-600 bg-medical-50' : 'text-slate-400 hover:text-slate-600'}`}>
          <ClipboardCheck className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-tight">Récipe</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center flex-1 p-2 rounded-xl transition-all ${activeTab === 'profile' ? 'text-medical-600 bg-medical-50' : 'text-slate-400 hover:text-slate-600'}`}>
          <UserCircle className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-tight">Perfil</span>
        </button>
      </nav>

    </div>
  )
}
