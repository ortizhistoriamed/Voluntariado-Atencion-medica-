'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { getMedico, cerrarSesionMedico } from '@/lib/session'
import { useRouter } from 'next/navigation'
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
  Calendar,
  Share,
  CheckCircle2,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import InstallBanner from '@/components/InstallBanner'
import CustomModal from '@/components/CustomModal'

export const dynamic = 'force-dynamic';

export default function App() {
  const router = useRouter()
  const [medicoActivo, setMedicoActivo] = useState(null)
  const [mostrarBienvenida, setMostrarBienvenida] = useState(false)
  
  // Navegación
  const [activeTab, setActiveTab] = useState('search') // search, patient, clinic, recipe, settings
  const [expandedSection, setExpandedSection] = useState(1)
  
  // Estados Globales
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [finalizado, setFinalizado] = useState(false)
  const [jornadaConsultas, setJornadaConsultas] = useState([])
  const [horaInicioConsulta, setHoraInicioConsulta] = useState(null)
  const [observacionesJornada, setObservacionesJornada] = useState('')

  // Modales
  const [modal, setModal] = useState({ open: false, type: 'info', title: '', message: '' })
  const showAlert = (title, message, type = 'info') => setModal({ open: true, title, message, type })

   // Datos
  const [medico, setMedico] = useState({ 
    nombre: '', 
    especialidad: '', 
    registro: '',
    whatsapp_coordinador: '' // Nuevo
  })
  const [paciente, setPaciente] = useState({ 
    id: '', 
    nombre: '', 
    edad: '', 
    cedula: '', 
    telefono: '', 
    pref_contacto: 'WhatsApp',
    sexo: '',
    ubicacion: '',
    alergias: '', 
    patologias: '', 
    motivo_consulta: '',
    inicio_sintomas: '',
    caracteristicas_sintoma: '',
    antecedentes: '',
    medicamentos_habituales: '',
    zona_desastre: false,
    acceso_agua: true,
    acceso_alimentos: true,
    refugio_seguro: true
  })
  const [historia, setHistoria] = useState({ 
    anamnesis: '', 
    examen_fisico: '', 
    diagnostico: '', 
    notas: '',
    estado_general: '',
    glasgow: 'Alerta',
    coloracion_piel: [],
    fc: '',
    fr: '',
    pa: '',
    temperatura: '',
    sato2: '',
    inspeccion_cabeza: '',
    inspeccion_torax: '',
    inspeccion_abdomen: '',
    inspeccion_extremidades: '',
    diagnostico_presuntivo: '',
    nivel_gravedad: 'Leve',
    plan_accion: '',
    criterio_derivacion: false,
    banderas_rojas: [],
    otra_bandera_roja: ''
  })
  const [recipe, setRecipe] = useState({ diagnostico_confirmado: '', medicamentos: [], indicaciones: '', proxima_cita: '' })
  const [historialPaciente, setHistorialPaciente] = useState([]) // Nuevo para Evolución

  // Mic y Voz
  const [globalMicActive, setGlobalMicActive] = useState(false)
  const [patientMicActive, setPatientMicActive] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const med = getMedico()
    if (!med) {
      router.push('/login')
    } else {
      setMedicoActivo(med)
      setMostrarBienvenida(true)
      setTimeout(() => setMostrarBienvenida(false), 2500)
    }

    if (typeof window !== 'undefined') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recognitionRef.current = new SR()
        recognitionRef.current.continuous = true
        recognitionRef.current.lang = 'es-VE'
      }
    }
  }, [])

  const saveMedico = () => {
    localStorage.setItem('medico_data', JSON.stringify(medico))
    showAlert("Perfil", "Datos guardados localmente.", "success")
  }

  // Buscador
  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 3) return setSearchResults([])
    if (!medicoActivo) return

    const supabase = getSupabase()
    const { data } = await supabase
      .from('pacientes')
      .select('*')
      .eq('medico_owner_id', medicoActivo.id)
      .or(`nombre.ilike.%${query}%,cedula.ilike.%${query}%`)
      .limit(5)
    
    setSearchResults(data || [])
  }

  const selectPatient = async (p) => {
    setPaciente({ ...p, id: p.id })
    setSearchResults([])
    setHoraInicioConsulta(new Date().toISOString())
    
    // Tarea: Cargar historial para Evolución
    const supabase = getSupabase()
    const { data } = await supabase
      .from('consultas')
      .select('*')
      .eq('paciente_id', p.id)
      .order('hora_inicio', { ascending: false })
    setHistorialPaciente(data || [])
    
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

  const toggleFieldMic = (field, setter, state) => {
    if (recognitionRef.current && !globalMicActive && !patientMicActive) {
      let fullTranscript = ''
      recognitionRef.current.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) fullTranscript += e.results[i][0].transcript
        }
      }
      recognitionRef.current.onend = () => {
        if (fullTranscript.trim()) {
           setter({ ...state, [field]: (state[field] + ' ' + fullTranscript).trim() })
        }
      }
      recognitionRef.current.start()
      showAlert("Dictando...", `Agregando texto a ${field}...`, "info")
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
      const supabase = getSupabase()
      if (!medicoActivo) return

      // Upsert Paciente
      const { data: pData, error: pError } = await supabase
        .from('pacientes')
        .upsert({ 
          nombre: paciente.nombre, 
          cedula: paciente.cedula,
          edad: paciente.edad, 
          telefono: paciente.telefono,
          pref_contacto: paciente.pref_contacto,
          alergias: paciente.alergias,
          medico_owner_id: medicoActivo.id
        }, { onConflict: 'cedula' })
        .select().single()
      
      if (pError) throw pError

      // Guardar Consulta
      const { error: cError } = await supabase.from('consultas').insert({
        paciente_id: pData.id,
        medico_owner_id: medicoActivo.id,
        medico_nombre: `${medicoActivo.nombre} ${medicoActivo.apellido}`,
        canal_contacto: paciente.pref_contacto,
        
        // Datos clínicos nuevos
        motivo: paciente.motivo_consulta,
        inicio_sintomas: paciente.inicio_sintomas,
        caracteristicas_sintoma: paciente.caracteristicas_sintoma,
        antecedentes: paciente.antecedentes,
        alergias: paciente.alergias,
        medicamentos_habituales: paciente.medicamentos_habituales,
        zona_disastre: paciente.zona_desastre,
        acceso_agua: paciente.acceso_agua,
        acceso_alimentos: paciente.acceso_alimentos,
        refugio_seguro: paciente.refugio_seguro,

        estado_general: historia.estado_general,
        glasgow: historia.glasgow,
        coloracion_piel: historia.coloracion_piel?.join(','),
        fc: historia.fc,
        fr: historia.fr,
        pa: historia.pa,
        temperatura: historia.temperatura,
        sato2: historia.sato2,
        inspeccion_cabeza: historia.inspeccion_cabeza,
        inspeccion_torax: historia.inspeccion_torax,
        inspeccion_abdomen: historia.inspeccion_abdomen,
        inspeccion_extremidades: historia.inspeccion_extremidades,
        diagnostico_presuntivo: historia.diagnostico,
        nivel_gravedad: historia.nivel_gravedad,
        plan_accion: historia.plan_accion,
        criterio_derivacion: historia.criterio_derivacion,
        banderas_rojas: historia.banderas_rojas,

        anamnesis: historia.anamnesis,
        examen_fisico: historia.examen_fisico,
        diagnostico: historia.diagnostico,
        recipe: recipe,
        hora_inicio: horaInicioConsulta,
        hora_fin: new Date().toISOString()
      })
      
      if (cError) throw cError

      setFinalizado(true)
      fetchJornada()
      showAlert("¡Consulta Guardada!", "La atención ha sido registrada exitosamente.", "success")
    } catch (err) { 
        showAlert("Error Guardado", "Detalle: " + (err.message || "Error Supabase"), "error")
    }
    finally { setSaving(false) }
  }

  const fetchJornada = async () => {
    if (!medicoActivo) return
    setLoading(true)
    const supabase = getSupabase()
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('consultas')
        .select('*, pacientes(nombre)')
        .eq('medico_owner_id', medicoActivo.id)
        .gte('hora_inicio', `${today}T00:00:00`)
        .lte('hora_inicio', `${today}T23:59:59`)
        .order('hora_inicio', { ascending: true })
      
      if (error) throw error
      setJornadaConsultas(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Tarea 3: WhatsApp al Paciente
  const enviarWhatsAppPaciente = () => {
    const telefonoRaw = paciente.telefono || ''
    const telefono = telefonoRaw.replace(/\D/g, '') // solo números
    
    // Prefijo 58 si no lo tiene (asumiendo Venezuela por defecto)
    const telFinal = telefono.startsWith('58') ? telefono : `58${telefono}`

    const meds = (recipe.medicamentos || []).map(m =>
      `• ${m.nombre} ${m.dosis} — ${m.indicaciones}`
    ).join('\n')

    const texto =
      `🏥 *RÉCIPE MÉDICO*\n` +
      `👤 *Paciente:* ${paciente.nombre}\n` +
      `👨‍⚕️ *Médico:* Dr(a). ${medicoActivo?.nombre} ${medicoActivo?.apellido}\n` +
      `🎓 *Especialidad:* ${medicoActivo?.especialidad || 'General'}\n` +
      `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}\n\n` +
      `💊 *Medicamentos:*\n${meds}\n\n` +
      `📌 *Indicaciones:* ${recipe.indicaciones}\n` +
      (recipe.proxima_cita ? `🗓 *Próxima cita:* ${recipe.proxima_cita}\n` : '') +
      `\n_Voluntariado Médico_`

    if (!telefono) {
      showAlert("Sin Teléfono", "Este paciente no tiene un número registrado.", "error")
      return
    }
    window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  // Tarea 4: Informe de Jornada
  const generarInformeJornada = () => {
    const doc = new jsPDF()
    const now = new Date()
    
    doc.setFontSize(18).text("INFORME DE JORNADA MÉDICA", 105, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Médico: Dr(a). ${medicoActivo?.nombre} ${medicoActivo?.apellido}`, 20, 35)
    doc.text(`Especialidad: ${medicoActivo?.especialidad || 'General'}`, 20, 42)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-VE')}`, 20, 49)
    doc.text(`Total de pacientes: ${jornadaConsultas.length}`, 20, 56)

    doc.setLineWidth(0.5)
    doc.line(20, 60, 190, 60)

    doc.autoTable({
      startY: 65,
      head: [['#', 'Paciente', 'Hora', 'Diagnóstico', 'Récipe']],
      body: jornadaConsultas.map((c, i) => [
        i + 1,
        c.pacientes?.nombre || 'N/A',
        new Date(c.hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        c.diagnostico?.substring(0, 30) + '...',
        c.recipe?.medicamentos?.length > 0 ? 'Sí' : 'No'
      ]),
      headStyles: { fillColor: [15, 23, 42] }
    })
    
    // Agregar observaciones
    if (observacionesJornada) {
      doc.setFontSize(12).text("Observaciones Generales:", 20, doc.lastAutoTable.finalY + 10)
      doc.setFontSize(10).text(observacionesJornada, 20, doc.lastAutoTable.finalY + 18, { maxWidth: 170 })
    }

    doc.save(`Jornada_${now.toISOString().split('T')[0]}.pdf`)

    // WhatsApp al Coordinador
    if (!medico.whatsapp_coordinador) {
        showAlert("Configuración", "Por favor configura el WhatsApp del coordinador en Perfil.", "info")
        return
    }

    let total = jornadaConsultas.length
    let msg = `*INFORME DE JORNADA - ${now.toLocaleDateString()}*\n`
    msg += `*Médico:* ${medico.nombre}\n`
    msg += `*Total pacientes:* ${total}\n\n`
    
    jornadaConsultas.forEach(c => {
      let hora = new Date(c.hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      let rec = c.recipe?.medicamentos?.length > 0 ? '✅' : '❌'
      msg += `• ${hora} - ${c.pacientes?.nombre} - ${c.diagnostico} ${rec}\n`
    })

    if (observacionesJornada) msg += `\n*Observaciones:* ${observacionesJornada}`
    msg += `\n\n_Generado desde Voluntariado Médico App_`

    const telCoordinador = medico.whatsapp_coordinador.startsWith('58') ? medico.whatsapp_coordinador : `58${medico.whatsapp_coordinador}`
    window.open(`https://wa.me/${telCoordinador}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  useEffect(() => {
    if (activeTab === 'jornada') fetchJornada()
  }, [activeTab])

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

        {/* BIENVENIDA OVERLAY */}
        {mostrarBienvenida && medicoActivo && (
          <div className="fixed inset-0 bg-medical-600 z-[200] flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
             <div className="bg-white/20 p-8 rounded-[40px] backdrop-blur-md border border-white/30 text-center space-y-4 animate-in zoom-in-95 duration-700">
                <div className="text-7xl mb-4">🩺</div>
                <h1 className="text-3xl font-black tracking-tighter uppercase">¡Bienvenido(a)!</h1>
                <div className="space-y-1">
                   <p className="text-xl font-bold">Dr(a). {medicoActivo.nombre} {medicoActivo.apellido}</p>
                   <p className="text-medical-200 font-bold uppercase tracking-widest text-[10px]">{medicoActivo.especialidad}</p>
                </div>
                <div className="pt-4 border-t border-white/10">
                   <p className="text-medical-100 text-xs font-medium">Turno iniciado: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
                      <option>Video</option>
                      <option>SMS</option>
                      <option>Otro</option>
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
            {/* BANNER DE EMERGENCIA */}
            {(historia.nivel_gravedad === 'Emergencia' || (historia.banderas_rojas && historia.banderas_rojas.length > 0)) && (
              <div className="bg-red-600 text-white text-center py-3 rounded-2xl font-bold animate-pulse shadow-lg flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" />
                ⚠️ ATENCIÓN PRESENCIAL INMEDIATA
              </div>
            )}

            {/* SECCIÓN 1: ANAMNESIS */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
              <button 
                onClick={() => setExpandedSection(expandedSection === 1 ? 0 : 1)}
                className={`w-full p-6 flex justify-between items-center ${expandedSection === 1 ? 'bg-medical-600 text-white' : 'text-slate-800'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${expandedSection === 1 ? 'bg-white text-medical-600' : 'bg-medical-100 text-medical-600'}`}>1</div>
                  <span className="text-lg font-bold">Anamnesis y Datos</span>
                </div>
                {expandedSection === 1 ? <ChevronUp /> : <ChevronDown />}
              </button>
              
              {expandedSection === 1 && (
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sexo</label>
                      <select value={paciente.sexo} onChange={e=>setPaciente({...paciente, sexo:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border">
                        <option value="">Seleccionar</option>
                        <option>Masculino</option>
                        <option>Femenino</option>
                        <option>Otro</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Ubicación</label>
                      <input value={paciente.ubicacion} onChange={e=>setPaciente({...paciente, ubicacion:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" placeholder="Ciudad/Sector" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Motivo de Consulta</label>
                      <button onClick={() => toggleFieldMic('motivo_consulta', setPaciente, paciente)} className="p-2 bg-medical-50 text-medical-600 rounded-lg"><Mic className="w-4 h-4"/></button>
                    </div>
                    <textarea value={paciente.motivo_consulta} onChange={e=>setPaciente({...paciente, motivo_consulta:e.target.value})} className="w-full p-3 h-24 bg-slate-50 rounded-xl outline-none border text-sm" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Inicio de Síntomas</label>
                      <input type="datetime-local" value={paciente.inicio_sintomas} onChange={e=>setPaciente({...paciente, inicio_sintomas:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-sm" />
                    </div>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-orange-800 uppercase flex items-center gap-1"><Info className="w-3 h-3"/> Contexto de Contingencia</p>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={()=>setPaciente({...paciente, zona_desastre:!paciente.zona_desastre})} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${paciente.zona_desastre ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Zona Desastre</button>
                       <button onClick={()=>setPaciente({...paciente, acceso_agua:!paciente.acceso_agua})} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${paciente.acceso_agua ? 'bg-blue-600 text-white border-blue-600' : 'bg-red-50 text-red-600 border-red-200'}`}>{paciente.acceso_agua ? 'Agua OK' : 'Sin Agua'}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: EXAMEN FÍSICO */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
              <button 
                onClick={() => setExpandedSection(expandedSection === 2 ? 0 : 2)}
                className={`w-full p-6 flex justify-between items-center ${expandedSection === 2 ? 'bg-slate-700 text-white' : 'text-slate-800'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${expandedSection === 2 ? 'bg-white text-slate-700' : 'bg-slate-200 text-slate-600'}`}>2</div>
                  <span className="text-lg font-bold">Examen Físico</span>
                </div>
                {expandedSection === 2 ? <ChevronUp /> : <ChevronDown />}
              </button>

              {expandedSection === 2 && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Glasgow</label>
                      <select value={historia.glasgow} onChange={e=>setHistoria({...historia, glasgow:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-xs">
                        <option>Alerta</option>
                        <option>Confuso</option>
                        <option>Somnoliento</option>
                        <option>Inconsciente</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">FC (lpm)</label>
                      <input value={historia.fc} onChange={e=>setHistoria({...historia, fc:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" placeholder="--" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">FR (rpm)</label>
                      <input value={historia.fr} onChange={e=>setHistoria({...historia, fr:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" placeholder="--" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">SatO2 (%)</label>
                      <input value={historia.sato2} onChange={e=>setHistoria({...historia, sato2:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border" placeholder="--" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Hallazgos Examen Físico</label>
                      <button onClick={() => toggleFieldMic('examen_fisico', setHistoria, historia)} className="p-2 bg-medical-50 text-medical-600 rounded-lg"><Mic className="w-4 h-4"/></button>
                    </div>
                    <textarea value={historia.examen_fisico} onChange={e=>setHistoria({...historia, examen_fisico:e.target.value})} className="w-full p-3 h-32 bg-slate-50 rounded-xl outline-none border text-sm" placeholder="Dicta los hallazgos por sistemas..." />
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 3: DIAGNÓSTICO Y PLAN */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
              <button 
                onClick={() => setExpandedSection(expandedSection === 3 ? 0 : 3)}
                className={`w-full p-6 flex justify-between items-center ${expandedSection === 3 ? 'bg-indigo-600 text-white' : 'text-slate-800'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${expandedSection === 3 ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-600'}`}>3</div>
                  <span className="text-lg font-bold">Diagnóstico y Plan</span>
                </div>
                {expandedSection === 3 ? <ChevronUp /> : <ChevronDown />}
              </button>

              {expandedSection === 3 && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-2">
                    {['Leve', 'Moderado', 'Severo', 'Emergencia'].map(lvl => (
                      <button 
                        key={lvl} 
                        onClick={()=>setHistoria({...historia, nivel_gravedad:lvl})}
                        className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${historia.nivel_gravedad === lvl ? (lvl === 'Emergencia' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-indigo-600 border-indigo-600 text-white') : 'bg-slate-50 border-transparent text-slate-400'}`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Diagnóstico Presuntivo</label>
                      <button onClick={() => toggleFieldMic('diagnostico', setHistoria, historia)} className="p-2 bg-medical-50 text-medical-600 rounded-lg"><Mic className="w-4 h-4"/></button>
                    </div>
                    <textarea value={historia.diagnostico} onChange={e=>setHistoria({...historia, diagnostico:e.target.value})} className="w-full p-3 h-20 bg-indigo-50 text-indigo-900 font-bold rounded-xl outline-none border border-indigo-100" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Banderas Rojas</label>
                    <div className="flex flex-wrap gap-2">
                      {['Dificultad respiratoria', 'Sangrado', 'Alteración mental', 'Dolor torácico'].map(b => (
                        <button 
                          key={b} 
                          onClick={()=>{
                            const current = historia.banderas_rojas || []
                            const next = current.includes(b) ? current.filter(x=>x!==b) : [...current, b]
                            setHistoria({...historia, banderas_rojas:next})
                          }}
                          className={`px-4 py-2 rounded-full text-[10px] font-bold border-2 transition-all ${historia.banderas_rojas?.includes(b) ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={generarRecipeIA} disabled={aiLoading} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg">
                    {aiLoading ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} Generar Récipe con IA
                  </button>
                </div>
              )}
            </div>

            {/* EVOLUCIÓN (Historial Previo) */}
            {historialPaciente.length > 0 && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200">
                <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Atenciones Previas</h3>
                <div className="space-y-4">
                  {historialPaciente.map((h, i) => (
                    <div key={i} className="text-xs space-y-1 bg-white p-3 rounded-xl shadow-sm">
                      <p className="font-bold text-slate-400">{new Date(h.hora_inicio).toLocaleDateString()}</p>
                      <p className="text-slate-700"><span className="font-bold">Diag:</span> {h.diagnostico}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                 <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4 border-2 border-medical-500">
                   <button onClick={descargarPDF} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2">
                     <Download className="w-6 h-6" /> DESCARGAR RÉCIPE (PDF)
                   </button>
                   <button onClick={enviarWhatsAppPaciente} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2">
                     <Share className="w-6 h-6" /> NOTIFICAR POR WHATSAPP
                   </button>
                   <button onClick={() => window.location.reload()} className="w-full text-medical-600 font-bold underline py-2">Nueva Consulta</button>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* PANTALLA: JORNADA (INFORME DIARIO) */}
        {activeTab === 'jornada' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5 pb-24">
             <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex justify-between items-end">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resumen del Día</p>
                  <h2 className="text-4xl font-black">{jornadaConsultas.length}</h2>
                  <p className="text-xs font-bold text-slate-300">Pacientes atendidos hoy</p>
                </div>
                <Calendar className="w-12 h-12 opacity-20" />
             </div>

             <div className="space-y-3">
               {loading && <Loader2 className="animate-spin mx-auto text-medical-500" />}
               {jornadaConsultas.map((c, i) => (
                 <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 leading-none">{c.pacientes?.nombre}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {new Date(c.hora_inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                        {c.hora_fin && ` - ${new Date(c.hora_fin).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-1">{c.diagnostico}</p>
                    </div>
                    {c.recipe?.medicamentos?.length > 0 ? (
                       <span className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-1 rounded-full uppercase">Con Récipe</span>
                    ) : (
                       <span className="bg-slate-100 text-slate-400 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">Sin Récipe</span>
                    )}
                 </div>
               ))}
               {jornadaConsultas.length === 0 && !loading && (
                 <div className="text-center p-10 text-slate-400 italic">No hay atenciones registradas hoy.</div>
               )}
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones de la Jornada</label>
                <textarea 
                  value={observacionesJornada}
                  onChange={e=>setObservacionesJornada(e.target.value)}
                  placeholder="Ej: Jornada exitosa, se requiere reposición de Paracetamol..."
                  className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none h-24 text-sm font-medium"
                />
             </div>

             {jornadaConsultas.length > 0 && (
               <button 
                 onClick={generarInformeJornada}
                 className="w-full py-5 bg-medical-600 text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
               >
                 <Send className="w-6 h-6" /> GENERAR E INFORMAR JORNADA
               </button>
             )}
          </div>
        )}

        {/* PANTALLA: PERFIL */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5 pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-xl space-y-6 border border-slate-100">
               <div className="flex items-center gap-4 border-b pb-6">
                  <div className="bg-medical-500 p-4 rounded-3xl text-white">
                     <UserCircle className="w-12 h-12" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">{medicoActivo?.nombre} {medicoActivo?.apellido}</h2>
                    <p className="text-sm font-bold text-medical-600 uppercase tracking-widest mt-1">{medicoActivo?.especialidad}</p>
                  </div>
               </div>

               <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cédula</p>
                    <p className="font-bold text-slate-800">{medicoActivo?.cedula}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo</p>
                    <p className="font-bold text-slate-800">{medicoActivo?.correo || 'No registrado'}</p>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">WhatsApp Coordinador</label>
                    <input 
                      value={medico.whatsapp_coordinador} 
                      onChange={e=>setMedico({...medico, whatsapp_coordinador:e.target.value})} 
                      className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-medical-500 outline-none font-bold" 
                      placeholder="58412..." 
                    />
                 </div>
                 <button onClick={saveMedico} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-black shadow-lg">GUARDAR AJUSTES</button>
               </div>

               <button 
                 onClick={cerrarSesionMedico}
                 className="w-full py-4 border-2 border-red-500 text-red-500 rounded-2xl font-black hover:bg-red-50 transition-all"
               >
                 CERRAR SESIÓN DEL TURNO
               </button>
            </div>
          </div>
        )}

        {/* PANTALLA: PERFIL MEDICO (LEGACY) */}
        {activeTab === 'profile' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6 animate-in slide-in-from-bottom-5">
            <h2 className="text-xl font-black flex items-center gap-2 text-slate-900 border-b pb-4"><UserCircle className="text-medical-500" /> PERFIL PROFESIONAL</h2>
            <div className="space-y-4">
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                 <input value={medico.nombre} onChange={e=>setMedico({...medico, nombre:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-medical-500 outline-none font-bold" />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Especialidad</label>
                 <input value={medico.especialidad} onChange={e=>setMedico({...medico, especialidad:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-medical-500 outline-none font-bold" />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reg. Médico / ID</label>
                 <input value={medico.registro} onChange={e=>setMedico({...medico, registro:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-medical-500 outline-none font-bold" />
               </div>
               <div className="pt-4 border-t">
                 <label className="text-[10px] font-bold text-medical-600 uppercase tracking-widest">WhatsApp Coordinador</label>
                 <input value={medico.whatsapp_coordinador} onChange={e=>setMedico({...medico, whatsapp_coordinador:e.target.value})} className="w-full p-4 bg-medical-50 rounded-2xl border-2 border-medical-200 outline-none font-bold text-medical-900" placeholder="Ej: 584120000000" />
                 <p className="text-[9px] text-medical-400 mt-1">* Código de país sin el símbolo +</p>
               </div>
               <button onClick={saveMedico} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest">Guardar Perfil</button>
               
               <div className="pt-6 border-t mt-6">
                 <button 
                   onClick={async () => {
                     setLoading(true)
                     try {
                        const { data, error } = await supabase.from('pacientes').select('count', { count: 'exact', head: true })
                        if (error) showAlert("Error DB", "Fallo de conexión: " + error.message, "error")
                        else showAlert("Conexión OK", "Supabase responde correctamente. Pacientes en DB: " + (data?.[0]?.count || 0), "success")
                     } catch (e) {
                        showAlert("Crash", e.message, "error")
                     } finally {
                        setLoading(false)
                     }
                   }}
                   className="w-full py-4 bg-slate-800 text-white border-2 border-white/20 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl"
                 >
                   {loading ? 'Verificando...' : 'Probar conexión con Base de Datos'}
                 </button>
               </div>
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
        <button onClick={() => setActiveTab('recipe')} className={`flex flex-col items-center min-w-[56px] p-2 rounded-xl transition-all ${activeTab === 'recipe' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <ClipboardCheck className="w-5 h-5 mb-1" />
          <span className="text-[8px] font-black uppercase tracking-tighter">Récipe</span>
        </button>
        <button onClick={() => setActiveTab('jornada')} className={`flex flex-col items-center min-w-[56px] p-2 rounded-xl transition-all ${activeTab === 'jornada' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <Calendar className="w-5 h-5 mb-1" />
          <span className="text-[8px] font-black uppercase tracking-tighter">Jornada</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center min-w-[56px] p-2 rounded-xl transition-all ${activeTab === 'profile' ? 'text-medical-600 bg-medical-50' : 'text-slate-500'}`}>
          <UserCircle className="w-5 h-5 mb-1" />
          <span className="text-[8px] font-black uppercase tracking-tighter">Perfil</span>
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
