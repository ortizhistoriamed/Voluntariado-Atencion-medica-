'use client'

export const dynamic = 'force-dynamic'

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
import InstallBanner from '@/components/InstallBanner'
import CustomModal from '@/components/CustomModal'

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

  // Modales
  const [modal, setModal] = useState({ open: false, type: 'info', title: '', message: '' })
  const showAlert = (title, message, type = 'info') => setModal({ open: true, title, message, type })

  // Datos
  const [medico, setMedico] = useState({ nombre: '', especialidad: '', registro: '' })
  const [paciente, setPaciente] = useState({ 
    id: '', 
    nombre: '', 
    edad: '', 
    cedula: '', 
    telefono: '', 
    pref_contacto: 'WhatsApp', // Nuevo campo
    alergias: '', 
    patologias: '', 
    motivo_consulta: '' 
  })
  const [historia, setHistoria] = useState({ anamnesis: '', examen_fisico: '', diagnostico: '', notas: '' })
  const [recipe, setRecipe] = useState({ diagnostico_confirmado: '', medicamentos: [], indicaciones: '', proxima_cita: '' })

  // Mic y Voz
  const [globalMicActive, setGlobalMicActive] = useState(false)
  const [patientMicActive, setPatientMicActive] = useState(false)
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
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) fullTranscript += e.results[i][0].transcript
        }
      }
      recognitionRef.current.onend = async () => {
        setGlobalMicActive(false)
        if (fullTranscript.trim()) structureWithAI(fullTranscript)
      }
      recognitionRef.current.start()
      setGlobalMicActive(true)
    }
  }

  const togglePatientMic = () => {
    if (patientMicActive) {
      recognitionRef.current.stop()
      setPatientMicActive(false)
    } else {
      let fullTranscript = ''
      recognitionRef.current.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) fullTranscript += e.results[i][0].transcript
        }
      }
      recognitionRef.current.onend = async () => {
        setPatientMicActive(false)
        if (fullTranscript.trim()) extractPatientDataWithAI(fullTranscript)
      }
      recognitionRef.current.start()
      setPatientMicActive(true)
    }
  }

  const extractPatientDataWithAI = async (text) => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/structurar-paciente', {
        method: 'POST',
        body: JSON.stringify({ rawText: text })
      })
      const data = await res.json()
      setPaciente(prev => ({
        ...prev,
        nombre: data.nombre || prev.nombre,
        cedula: data.cedula || prev.cedula,
        edad: data.edad || prev.edad,
        telefono: data.telefono || prev.telefono,
        pref_contacto: data.pref_contacto || prev.pref_contacto,
        alergias: data.alergias || prev.alergias
      }))
      showAlert("DocBot", "Datos extraídos y cargados correctamente.", "success")
    } catch (err) { 
      showAlert("Error Asistente", "No pudimos extraer los datos del relato.", "error")
    }
    finally { setAiLoading(false) }
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
    } catch (err) { 
      showAlert("Error IA", "No pudimos estructurar el relato. Intenta dictar más pausado.", "error")
    }
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
    } catch (err) { 
        showAlert("Error Generación", "Hubo un problema al crear el récipe con Groq.", "error")
    }
    finally { setAiLoading(false) }
  }

  const finalizarYGuardar = async () => {
    setSaving(true)
    try {
      // Upsert Paciente
      const { data: pData, error: pError } = await supabase
        .from('pacientes')
        .upsert({ 
          nombre: paciente.nombre, 
          cedula: paciente.cedula,
          edad: paciente.edad, 
          telefono: paciente.telefono,
          pref_contacto: paciente.pref_contacto,
          alergias: paciente.alergias 
        }, { onConflict: 'cedula' })
        .select().single()
      
      if (pError) throw pError

      // Guardar Consulta
      const { error: cError } = await supabase.from('consultas').insert({
        paciente_id: pData.id,
        medico_id: '88888888-8888-4888-8888-888888888888',
        anamnesis: historia.anamnesis,
        examen_fisico: historia.examen_fisico,
        diagnostico: historia.diagnostico,
        recipe: recipe
      })
      
      if (cError) throw cError

      setFinalizado(true)
      showAlert("¡Consulta Guardada!", "La atención ha sido registrada exitosamente.", "success")
    } catch (err) { 
        showAlert("Error Guardado", "No pudimos conectar con Supabase. Revisa tu internet.", "error")
    }
    finally { setSaving(false) }
  }

  // PDF Profesional (Tamaño Carta)
  const descargarPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'letter'
    })

    // Header con diseño
    doc.setFillColor(14, 165, 233)
    doc.rect(0, 0, 216, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text("CONSULTA MÉDICA", 20, 25)
    
    doc.setFontSize(10)
    doc.text(`${medico.nombre}\n${medico.especialidad}\nReg: ${medico.registro}`, 190, 15, { align: 'right' })

    // Cuerpo
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text("DATOS DEL PACIENTE", 20, 55)
    doc.line(20, 57, 196, 57)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Nombre: ${paciente.nombre}`, 20, 65)
    doc.text(`Cédula: ${paciente.cedula}`, 20, 72)
    doc.text(`Edad: ${paciente.edad} años`, 100, 65)
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 100, 72)
    
    doc.setFont('helvetica', 'bold')
    doc.text("HISTORIA Y EVALUACIÓN", 20, 85)
    doc.line(20, 87, 196, 87)
    doc.setFont('helvetica', 'normal')
    doc.text("Anamnesis:", 20, 95)
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(historia.anamnesis || "No registrada", 176), 20, 100)
    
    doc.setFontSize(11)
    doc.text("Diagnóstico:", 20, 130)
    doc.setFont('helvetica', 'bold')
    doc.text(recipe.diagnostico_confirmado || historia.diagnostico, 20, 135)
    
    doc.setFontSize(12)
    doc.text("PLAN Y TRATAMIENTO", 20, 155)
    doc.line(20, 157, 196, 157)
    
    doc.autoTable({
      startY: 165,
      margin: { left: 20, right: 20 },
      head: [["Medicamento", "Dosis", "Frecuencia", "Duración"]],
      body: recipe.medicamentos.map(m => [m.nombre, m.dosis, m.frecuencia, m.duracion]),
      headStyles: { fillColor: [14, 165, 233] },
      styles: { fontSize: 10 }
    })
    
    let finalY = doc.lastAutoTable.finalY || 165
    doc.setFont('helvetica', 'bold')
    doc.text("Indicaciones:", 20, finalY + 15)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(recipe.indicaciones, 176), 20, finalY + 20)
    
    doc.setFont('helvetica', 'bold')
    doc.text(`Próxima Cita: ${recipe.proxima_cita || 'Por definir'}`, 20, 250)
    
    // Firma placeholder
    doc.line(70, 265, 146, 265)
    doc.setFontSize(8)
    doc.text("Firma y Sello del Médico", 108, 270, { align: 'center' })

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
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between relative overflow-hidden">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">Asistente DocBot</h2>
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">Presiona el micro y dicta los datos</p>
                </div>
                <button 
                  onClick={togglePatientMic}
                  className={`p-4 rounded-2xl shadow-lg transition-all ${patientMicActive ? 'bg-red-600 animate-pulse' : 'bg-black hover:bg-slate-800'}`}
                >
                  <Mic className={`w-8 h-8 text-white ${patientMicActive ? 'animate-bounce' : ''}`} />
                </button>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6 border border-black animate-in slide-in-from-bottom-5">
              {aiLoading && <div className="flex items-center justify-center gap-2 text-black font-bold text-sm bg-slate-100 p-3 rounded-xl"><Loader2 className="animate-spin" /> DocBot procesando...</div>}
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alergias Relevantes</label>
                  <input value={paciente.alergias} onChange={e=>setPaciente({...paciente, alergias:e.target.value})} className="w-full p-3 bg-red-50 text-red-700 rounded-xl outline-none border border-red-200 font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                    <input value={paciente.telefono} onChange={e=>setPaciente({...paciente, telefono:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" placeholder="+58..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Contacto Pref.</label>
                    <select value={paciente.pref_contacto} onChange={e=>setPaciente({...paciente, pref_contacto:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-xs font-bold text-slate-700">
                      <option>WhatsApp</option>
                      <option>Llamada</option>
                      <option>SMS</option>
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={()=>setActiveTab('clinic')} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2">
                Continuar a Evaluación <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* PANTALLA: CLINICA (GROQ ASSISTANT) */}
        {activeTab === 'clinic' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5 pb-20">
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
               <h2 className="text-2xl font-black mb-1 relative z-10 text-white uppercase tracking-tighter">DocBot Clínico</h2>
               <p className="text-xs text-slate-300 relative z-10 font-bold uppercase tracking-widest mb-6">Evaluación por Voz Activa</p>
               
               <button 
                  onClick={toggleGlobalMic}
                  className={`w-full py-8 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all shadow-xl ${globalMicActive ? 'bg-red-600 animate-pulse' : 'bg-white text-slate-900 hover:bg-slate-200'}`}
               >
                 {globalMicActive ? <Loader2 className="animate-spin w-10 h-10" /> : <Mic className="w-10 h-10" />}
                 <span className="font-black text-lg tracking-tight">{globalMicActive ? 'FINALIZAR Y PROCESAR' : 'EMPEZAR A DICTAR'}</span>
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
                  <textarea value={historia.diagnostico} onChange={e=>setHistoria({...historia, diagnostico:e.target.value})} className="w-full bg-transparent p-0 h-16 outline-none font-bold text-slate-800" />
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
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tighter text-white">Récipe Sugerido</h2>
                <p className="text-xs text-slate-300 font-bold italic">Edita los fármacos según tu criterio.</p>
              </div>
              <ClipboardCheck className="w-10 h-10 text-slate-500" />
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
               <button onClick={saveMedico} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-bold shadow-lg">Guardar Cambios Localmente</button>
            </div>
          </div>
        )}

      </main>

      {/* Navegación Inferior (Estilo Móvil Premium) */}
      <nav className="bg-white border-t p-2 flex justify-between items-center w-full sticky bottom-0 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('search')} className={`flex flex-col items-center min-w-[64px] p-2 rounded-xl transition-all ${activeTab === 'search' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <Search className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">BUSCAR</span>
        </button>
        <button onClick={() => setActiveTab('patient')} className={`flex flex-col items-center min-w-[64px] p-2 rounded-xl transition-all ${activeTab === 'patient' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <UserIcon className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">PACIENTE</span>
        </button>
        <button onClick={() => setActiveTab('clinic')} className={`flex flex-col items-center min-w-[64px] p-2 rounded-xl transition-all ${activeTab === 'clinic' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <Stethoscope className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">CONSULTA</span>
        </button>
        <button onClick={() => setActiveTab('recipe')} className={`flex flex-col items-center min-w-[64px] p-2 rounded-xl transition-all ${activeTab === 'recipe' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <ClipboardCheck className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">RÉCIPE</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center min-w-[64px] p-2 rounded-xl transition-all ${activeTab === 'profile' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <UserCircle className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">PERFIL</span>
        </button>
      </nav>

      {/* Elementos Globales de PWA */}
      <InstallBanner />
      <CustomModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })} 
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

    </div>
  )
}
