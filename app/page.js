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
  ChevronUp,
  FileText,
  X
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import InstallBanner from '@/components/InstallBanner'
import CustomModal from '@/components/CustomModal'

export const dynamic = 'force-dynamic';

export default function App() {
  const router = useRouter()
  const [medicoActivo, setMedicoActivo] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [mostrarBienvenida, setMostrarBienvenida] = useState(false)
  
  const [activeTab, setActiveTab] = useState('search') // search, patient, clinic, recipe, settings
  const [expandedSection, setExpandedSection] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  
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
    contexto_contingencia: [],
    otros_detalles_contingencia: '',
    zona_desastre: false
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
      setLoadingSession(false)
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
          edad: parseInt(paciente.edad) || null, 
          telefono: paciente.telefono,
          pref_contacto: paciente.pref_contacto,
          alergias: paciente.alergias,
          motivo: paciente.motivo_consulta,
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
        paciente_telefono: paciente.telefono,
        
        // Datos clínicos nuevos
        motivo: paciente.motivo_consulta,
        inicio_sintomas: paciente.inicio_sintomas,
        caracteristicas_sintoma: paciente.caracteristicas_sintoma,
        contexto_contingencia: [...(paciente.contexto_contingencia || []), paciente.otros_detalles_contingencia].filter(Boolean).join(', '),
        antecedentes: paciente.antecedentes,
        alergias: paciente.alergias,
        medicamentos_habituales: paciente.medicamentos_habituales,
        zona_desastre: paciente.zona_desastre,

        estado_general: historia.estado_general,
        glasgow: historia.glasgow,
        coloracion_piel: historia.coloracion_piel?.join(','),
        fc: historia.fc ? parseInt(historia.fc) : null,
        fr: historia.fr ? parseInt(historia.fr) : null,
        pa: historia.pa, // PA suele ser string (120/80)
        temperatura: historia.temperatura ? parseFloat(historia.temperatura) : null,
        sato2: historia.sato2 ? parseInt(historia.sato2) : null,
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
      `Hola ${paciente.nombre}, le saluda el equipo de *Voluntariado Médico*.\n\n` +
      `A continuación le enviamos el resumen completo de su consulta médica de hoy:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *HISTORIA CLÍNICA*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Paciente: ${paciente.nombre}, ${paciente.edad} años, ${paciente.sexo}\n` +
      `📍 Ubicación: ${paciente.ubicacion || 'No especificada'}\n` +
      `📞 Canal de atención: ${paciente.pref_contacto}\n` +
      `📅 Fecha: ${new Date().toLocaleDateString('es-VE')}\n` +
      `👨‍⚕️ Médico: Dr(a). ${medicoActivo?.nombre} ${medicoActivo?.apellido} — ${medicoActivo?.especialidad || 'General'}\n\n` +
      `🔍 *MOTIVO DE CONSULTA*\n${paciente.motivo_consulta}\n\n` +
      (paciente.inicio_sintomas ? `⏱ Inicio de síntomas: ${new Date(paciente.inicio_sintomas).toLocaleString('es-VE')}\n` : '') +
      (paciente.caracteristicas_sintoma ? `📝 Características: ${paciente.caracteristicas_sintoma}\n` : '') +
      (paciente.antecedentes ? `\n🏥 *ANTECEDENTES*\n${paciente.antecedentes}\n` : '') +
      (paciente.alergias ? `⚠️ Alergias: ${paciente.alergias}\n` : '') +
      (paciente.medicamentos_habituales ? `💊 Medicamentos habituales: ${paciente.medicamentos_habituales}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🩺 *EXAMEN FÍSICO*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (historia.estado_general ? `Estado general: ${historia.estado_general}\n` : '') +
      (historia.glasgow ? `Glasgow: ${historia.glasgow}\n` : '') +
      (historia.coloracion_piel?.length ? `Coloración: ${historia.coloracion_piel.join(', ')}\n` : '') +
      ((historia.fc || historia.fr || historia.pa || historia.temperatura || historia.sato2) ?
        `\n📊 *Signos Vitales*\n` +
        (historia.fc ? `FC: ${historia.fc} lpm\n` : '') +
        (historia.fr ? `FR: ${historia.fr} rpm\n` : '') +
        (historia.pa ? `PA: ${historia.pa} mmHg\n` : '') +
        (historia.temperatura ? `Temp: ${historia.temperatura}°C\n` : '') +
        (historia.sato2 ? `SatO2: ${historia.sato2}%\n` : '')
      : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🔬 *DIAGNÓSTICO Y PLAN*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Diagnóstico: ${recipe.diagnostico_confirmado || historia.diagnostico}\n` +
      `Gravedad: ${historia.nivel_gravedad}\n` +
      (historia.plan_accion ? `Plan: ${historia.plan_accion}\n` : '') +
      (historia.criterio_derivacion ? `⚠️ Se recomienda acudir a un centro hospitalario.\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `💊 *RÉCIPE MÉDICO*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (recipe.medicamentos?.length > 0
        ? recipe.medicamentos.map(m => `• ${m.nombre} ${m.dosis} — ${m.frecuencia || ''} ${m.duracion || ''}`).join('\n')
        : 'Sin medicamentos indicados') +
      `\n\n📌 *Indicaciones:*\n${recipe.indicaciones || 'Ver con su médico'}\n` +
      (recipe.proxima_cita ? `\n🗓 *Próxima cita:* ${recipe.proxima_cita}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `_Este resumen fue generado por el sistema de Voluntariado Médico de Atención en Emergencias._\n` +
      `_Guarde este mensaje como respaldo de su consulta._`

    if (!telefono) {
      showAlert("Sin Teléfono", "Este paciente no tiene un número registrado.", "error")
      return
    }
    window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  // Evolución de Casos
  const cargarEvolucion = (c) => {
    // 1. Cargar paciente
    setPaciente({
      ...c.pacientes,
      id: c.paciente_id,
      nombre: c.pacientes?.nombre || '',
      cedula: c.pacientes?.cedula || '',
      telefono: c.paciente_telefono || '',
      motivo_consulta: c.motivo || '',
      contexto_contingencia: c.contexto_contingencia?.split(', ') || []
    })
    
    // 2. Cargar historia como base para evolución
    setHistoria({
      ...c,
      anamnesis: `[Evolución sugerida tras consulta del ${new Date(c.hora_inicio).toLocaleDateString()}] \nPaciente presentaba: ${c.diagnostico}. \nSubjetivo actual: `,
      notas: c.notas || ''
    })

    // 3. Cargar récipe previo
    setRecipe(c.recipe || { diagnostico_confirmado: '', medicamentos: [], indicaciones: '', proxima_cita: '' })
    
    setActiveTab('clinic')
    showAlert("Iniciando Evolución", "Se han cargado los datos de la sesión anterior como base.", "info")
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

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-medical-50 p-6 rounded-[40px] animate-pulse mb-4">
          <Stethoscope className="w-12 h-12 text-medical-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-1">Cargando Sistema...</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Verificando sesión médica</p>
        <Loader2 className="w-6 h-6 text-medical-600 animate-spin mt-6" />
      </div>
    )
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
        
            {/* PANTALLA: FINALIZADO (RECIFE Y RESUMEN) */}
            {finalizado && (
              <div className="space-y-6 animate-in zoom-in duration-500 pb-24">
                <div className="bg-medical-600 text-white p-8 rounded-[40px] text-center shadow-2xl relative overflow-hidden">
                  <div className="relative z-10 space-y-2">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">¡Consulta Exitosa!</h2>
                    <p className="text-sm font-bold text-medical-100">Atención guardada y récipe listo.</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-100 space-y-6">
                  <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400"><UserIcon /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Paciente</p>
                      <p className="text-lg font-black text-slate-900 uppercase">{paciente.nombre}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowPreview(true)} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-medical-200 transition-all gap-2">
                      <FileText className="w-8 h-8 text-medical-600" />
                      <span className="text-[10px] font-black uppercase">Ver Documento</span>
                    </button>
                    <button onClick={enviarWhatsAppPaciente} className="flex flex-col items-center justify-center p-6 bg-green-50 rounded-3xl border-2 border-transparent hover:border-green-200 transition-all gap-2">
                      <Send className="w-8 h-8 text-green-600" />
                      <span className="text-[10px] font-black uppercase text-green-700">Enviar WhatsApp</span>
                    </button>
                  </div>
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
            {/* BANNER DE EMERGENCIA POTENCIADO */}
            {(historia.banderas_rojas?.length > 0 || historia.nivel_gravedad === 'Emergencia') && (
              <div className="bg-red-600 text-white p-4 rounded-3xl font-black shadow-2xl animate-pulse flex flex-col items-center gap-3 text-center border-4 border-white/20">
                <div className="flex items-center gap-2 text-lg">
                  <AlertCircle className="w-8 h-8" />
                  {historia.banderas_rojas?.length >= 3 
                    ? '🚨 MÚLTIPLES BANDERAS ROJAS — EVACUACIÓN INMEDIATA' 
                    : '⚠️ ATENCIÓN PRESENCIAL INMEDIATA'}
                </div>
                {historia.banderas_rojas?.length >= 3 && (
                   <a 
                    href={`https://wa.me/${medicoActivo?.whatsapp_coordinador || ''}?text=${encodeURIComponent(`🚨 ALERTA ROJA: Paciente ${paciente.nombre} con múltiples banderas rojas en jornada.`)}`} 
                    target="_blank"
                    className="bg-white text-red-600 px-6 py-3 rounded-2xl font-black shadow-xl flex items-center gap-2 hover:bg-slate-100 transition-all uppercase tracking-tighter"
                   >
                     <Phone className="w-5 h-5"/> Alertar Coordinador por WhatsApp
                   </a>
                )}
              </div>
            )}

            {/* SECCIÓN 1: ANAMNESIS */}
            <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-200">
              <button 
                onClick={() => setExpandedSection(expandedSection === 1 ? 0 : 1)}
                className={`w-full p-6 flex justify-between items-center ${expandedSection === 1 ? 'bg-medical-600 text-white' : 'text-slate-800'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${expandedSection === 1 ? 'bg-white text-medical-600' : 'bg-medical-100 text-medical-600'}`}>1</div>
                  <span className="text-xl font-black tracking-tight">Anamnesis y Contexto</span>
                </div>
                {expandedSection === 1 ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
              </button>
              
              {expandedSection === 1 && (
                <div className="p-6 space-y-7">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo Biológico</label>
                      <select value={paciente.sexo} onChange={e=>setPaciente({...paciente, sexo:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-medical-300 font-bold text-slate-700">
                        <option value="">--</option>
                        <option>Masculino</option>
                        <option>Femenino</option>
                        <option>Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo de Consulta</label>
                      <div className="flex gap-2">
                        <button onClick={() => toggleFieldMic('motivo_consulta', setPaciente, paciente)} className={`p-2 rounded-xl transition-all ${globalMicActive ? 'bg-red-100 text-red-600' : 'bg-medical-50 text-medical-600 shadow-sm border border-medical-100'}`}>
                           <Mic className={`w-5 h-5 ${globalMicActive ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <textarea 
                      value={paciente.motivo_consulta} 
                      onChange={e=>setPaciente({...paciente, motivo_consulta:e.target.value})} 
                      className="w-full p-4 h-32 bg-slate-50 rounded-3xl outline-none border-2 border-transparent focus:border-medical-300 text-sm font-medium shadow-inner" 
                      placeholder="Dicta o escribe el motivo..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicio de Síntomas</label>
                      <input type="datetime-local" value={paciente.inicio_sintomas} onChange={e=>setPaciente({...paciente, inicio_sintomas:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-medical-300 font-bold text-slate-600" />
                    </div>
                  </div>

                  <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 space-y-6">
                    <p className="text-xs font-black text-orange-800 uppercase flex items-center gap-2"><Info className="w-4 h-4"/> Contexto de Contingencia (Terremoto)</p>
                    
                    {[
                      { 
                        title: 'Situación:', 
                        items: ['🏚️ Damnificado por terremoto', '🏕️ En albergue/refugio', '🏠 En vivienda dañada', '🌳 A la intemperie', '🚗 Desplazado de su zona'] 
                      },
                      { 
                        title: 'Servicios básicos:', 
                        items: ['💧 Sin agua potable', '🍽️ Sin alimentos', '⚡ Sin electricidad', '📵 Sin comunicación', '🚑 Sin centro de salud cercano'] 
                      },
                      { 
                        title: 'Condición por el evento:', 
                        items: ['🦴 Posible trauma por derrumbe', '🧱 Estuvo atrapado bajo escombros', '😰 Crisis de ansiedad post-trauma', '👁️ Exposición a situaciones traumáticas', '💊 Sin medicamentos crónicos', '🩸 Herida por escombros o vidrios'] 
                      }
                    ].map((grupo, idx) => (
                      <div key={idx} className="space-y-3">
                        <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{grupo.title}</h4>
                        <div className="flex flex-wrap gap-2">
                          {grupo.items.map(chip => {
                            const active = (paciente.contexto_contingencia || []).includes(chip)
                            return (
                              <button 
                                key={chip} 
                                onClick={() => {
                                  const current = paciente.contexto_contingencia || []
                                  const next = active ? current.filter(x => x !== chip) : [...current, chip]
                                  setPaciente({...paciente, contexto_contingencia: next})
                                }}
                                className={`px-4 py-2 rounded-2xl text-[10px] font-bold border-2 transition-all ${active ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'}`}
                              >
                                {chip}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest px-1">Otros detalles del contexto:</label>
                      <input 
                        value={paciente.otros_detalles_contingencia || ''} 
                        onChange={e => setPaciente({...paciente, otros_detalles_contingencia: e.target.value})}
                        className="w-full p-3 bg-white/50 rounded-xl border border-orange-100 outline-none text-xs font-bold text-orange-900 placeholder:text-orange-200" 
                        placeholder="Escribe otros detalles aquí..."
                      />
                    </div>

                    {(paciente.contexto_contingencia?.includes('🧱 Estuvo atrapado bajo escombros') || paciente.contexto_contingencia?.includes('🦴 Posible trauma por derrumbe')) && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 text-yellow-800 text-sm font-semibold animate-pulse">
                        ⚠️ Considerar: síndrome de aplastamiento, trauma cerrado, lesiones en columna.
                      </div>
                    )}
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Banderas Rojas (Triaje Crítico)</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Dificultad respiratoria', 'Sangrado profuso', 'Alteración del estado mental', 'Dolor torácico',
                        '🦴 Fractura expuesta o deformidad evidenté', '🫀 Pulso ausente o muy débil', '🧠 Pérdida de conciencia', 'Vómito persistente o con sangre',
                        '🚽 Orina oscura o ausente', '👁️ Pupilas desiguales', '🫁 Cianosis (labios/dedos azules)', '🤰 Embarazada con dolor/sangrado',
                        '👶 Menor de 5 años con fiebre alta', '⚡ Posible electrocución', '🔥 Quemaduras graves', '💉 Signos de shock'
                      ].map(b => (
                        <button 
                          key={b} 
                          onClick={()=>{
                            const current = historia.banderas_rojas || []
                            const next = current.includes(b) ? current.filter(x=>x!==b) : [...current, b]
                            setHistoria({...historia, banderas_rojas:next})
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${historia.banderas_rojas?.includes(b) ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-red-200'}`}
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

        {/* PANTALLA: RÉCIPE */}
        {activeTab === 'recipe' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5 pb-20">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter">Récipe Médico</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Edita los fármacos según tu criterio</p>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => toggleFieldMic('indicaciones', setRecipe, recipe)} className={`p-3 rounded-2xl transition-all ${globalMicActive ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-slate-900'}`}>
                    <Mic className="w-5 h-5"/>
                 </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Medicamentos</h3>
                  <button onClick={() => setRecipe({...recipe, medicamentos: [...recipe.medicamentos, {nombre: '', dosis: '', frecuencia: '', duracion: ''}]})} className="text-medical-600 text-[10px] font-black uppercase flex items-center gap-1">
                    <Plus className="w-3 h-3"/> Agregar
                  </button>
                </div>
                
                {recipe?.medicamentos?.map((m, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 pb-4 border-b border-slate-50 items-center">
                    <input 
                      placeholder="Medicamento" 
                      className="col-span-6 bg-slate-50 p-2 rounded-lg outline-none text-sm font-bold" 
                      value={m.nombre} 
                      onChange={e => {
                        const next = [...recipe.medicamentos]
                        next[i].nombre = e.target.value
                        setRecipe({...recipe, medicamentos: next})
                      }}
                    />
                    <input 
                      placeholder="Dosis/Frec" 
                      className="col-span-5 bg-slate-50 p-2 rounded-lg outline-none text-xs" 
                      value={m.dosis} 
                      onChange={e => {
                        const next = [...recipe.medicamentos]
                        next[i].dosis = e.target.value
                        setRecipe({...recipe, medicamentos: next})
                      }}
                    />
                    <button onClick={() => setRecipe({...recipe, medicamentos: (recipe.medicamentos || []).filter((_, idx)=>idx!==i)})} className="col-span-1 text-red-300">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Indicaciones Generales (Voz habilitada)</label>
                <textarea 
                  value={recipe.indicaciones} 
                  onChange={e => setRecipe({...recipe, indicaciones: e.target.value})} 
                  className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-medical-300 text-sm h-32" 
                  placeholder="Ej: Reposo por 3 días, abundante líquido..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Próxima Cita / Seguimiento</label>
                <input 
                  type="date" 
                  value={recipe.proxima_cita} 
                  onChange={e => setRecipe({...recipe, proxima_cita: e.target.value})} 
                  className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-medical-300 font-bold text-slate-600" 
                />
              </div>

              {!finalizado ? (
                <button 
                  onClick={() => setShowPreview(true)} 
                  className="w-full py-5 bg-medical-600 text-white rounded-[24px] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <FileText className="w-6 h-6"/> VISTA PREVIA Y FINALIZAR
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="bg-green-50 p-6 rounded-[32px] border-2 border-green-200 text-center">
                    <div className="bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="font-black text-green-800 uppercase text-lg">Consulta Guardada</p>
                  </div>
                  <button onClick={descargarPDF} className="w-full py-4 bg-medical-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2">
                    <Download className="w-6 h-6" /> DESCARGAR PDF
                  </button>
                  <button onClick={enviarWhatsAppPaciente} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2">
                    <Share className="w-6 h-6" /> ENVIAR POR WHATSAPP
                  </button>
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
                  <button key={i} onClick={() => cargarEvolucion(c)} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between text-left hover:border-medical-300 active:scale-95 transition-all">
                     <div className="space-y-1">
                       <p className="font-black text-slate-900 leading-none">{c.pacientes?.nombre} <span className="text-[10px] text-medical-600 ml-2">Abrir Evolución</span></p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase">
                         {new Date(c.hora_inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                         {c.hora_fin && ` - ${new Date(c.hora_fin).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                       </p>
                       <p className="text-xs text-slate-600 line-clamp-1">{c.diagnostico}</p>
                     </div>
                     {c.recipe?.medicamentos?.length > 0 ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-1 rounded-full uppercase">Con Récipe</span>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                        </div>
                     ) : (
                        <ArrowRight className="w-4 h-4 text-slate-200" />
                     )}
                  </button>
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

      {/* MODAL: VISTA PREVIA CARTA PROFESIONAL */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md p-4 flex items-center justify-center overflow-y-auto">
          <div className="max-w-[800px] w-full bg-slate-100 rounded-[40px] shadow-2xl relative flex flex-col h-screen max-h-[95vh]">
            {/* Header del Visor */}
            <div className="p-6 flex justify-between items-center border-b border-slate-200 bg-white rounded-t-[40px]">
              <div className="flex items-center gap-3">
                 <div className="bg-medical-100 p-2 rounded-xl text-medical-600"><FileText className="w-6 h-6"/></div>
                 <h3 className="font-black text-slate-900 uppercase tracking-tighter text-xl leading-none">Visor de Documento Clinico <br/><span className="text-[10px] text-slate-400">Verifica antes de firmar y guardar</span></h3>
              </div>
              <button 
                onClick={() => setShowPreview(false)}
                className="p-3 bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Area del "Papel Tamaño Carta" */}
            <div className="flex-1 overflow-y-auto p-4 md:p-12 scrollbar-hide bg-slate-200/50">
              <div className="bg-white shadow-2xl mx-auto w-full max-w-[612px] aspect-[1/1.41] p-12 flex flex-col gap-8 text-[12px] leading-relaxed relative border border-slate-100 font-serif">
                {/* Header Institucional */}
                <div className="flex justify-between items-start border-b-4 border-medical-600 pb-6 font-sans">
                  <div className="space-y-1">
                    <h1 className="text-3xl font-black text-medical-600 tracking-tighter leading-none italic">VOLUNTARIADO MÉDICO</h1>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Atención Médica en Contingencia</p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="bg-slate-900 text-white px-3 py-1 rounded-sm text-[10px] font-black uppercase">Ficha #2024-{Math.floor(Math.random()*9000)+1000}</div>
                    <p className="text-slate-500 font-bold">{new Date().toLocaleDateString('es-VE', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8 font-sans">
                  {/* Datos del Paciente */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-b border-slate-100 pb-4">
                    <p><span className="text-medical-600 font-black uppercase text-[10px] block">Paciente:</span> <span className="font-bold text-slate-900 text-lg uppercase">{paciente.nombre}</span></p>
                    <p><span className="text-medical-600 font-black uppercase text-[10px] block">Cédula / ID:</span> <span className="font-bold text-slate-900">{paciente.cedula || 'N/A'}</span></p>
                    <p><span className="text-medical-600 font-black uppercase text-[10px] block">Edad / Sexo:</span> <span className="font-bold text-slate-900">{paciente.edad} años / {paciente.sexo}</span></p>
                    <p><span className="text-medical-600 font-black uppercase text-[10px] block">Ubicación:</span> <span className="font-bold text-slate-800">{paciente.ubicacion}</span></p>
                  </div>

                  {/* Hallazgos y Diagnóstico */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-6 rounded-2xl border-l-8 border-medical-600">
                       <p className="text-[10px] font-black text-medical-600 uppercase tracking-widest mb-2">Diagnóstico Presuntivo:</p>
                       <p className="text-xl font-black text-slate-900 uppercase leading-snug">{historia.diagnostico || 'Evaluación Médica Estándar'}</p>
                       <p className="text-xs text-slate-500 font-bold mt-2 uppercase tracking-tighter">Nivel de Gravedad: {historia.nivel_gravedad}</p>
                       {historia.diagnostico_otros && <p className="text-xs text-slate-600 mt-2 italic">Otros: {historia.diagnostico_otros}</p>}
                    </div>

                    {recipe.medicamentos?.length > 0 && (
                      <div className="space-y-4 mt-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Tratamiento Sugerido:</p>
                        <div className="space-y-4 pl-4">
                          {recipe.medicamentos?.map((m, i) => (
                            <div key={i} className="flex flex-col">
                              <p className="text-lg font-black text-slate-900 uppercase">{i+1}. {m.nombre}</p>
                              <p className="text-sm text-slate-600 italic font-medium">{m.dosis}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Indicaciones y Recomendaciones:</p>
                       <p className="text-sm text-slate-800 leading-relaxed italic pr-10">{recipe.indicaciones || 'Seguir tratamiento indicado y observar signos de alarma.'}</p>
                    </div>
                  </div>
                </div>

                {/* Footer Firma */}
                <div className="mt-auto pt-10 flex justify-between items-end border-t border-slate-100 font-sans">
                  <div className="space-y-1">
                    <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
                    <p className="font-black text-slate-900 text-sm uppercase">Dr. {medicoActivo?.nombre} {medicoActivo?.apellido}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase">Médico Voluntario Registrado</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-medical-600 uppercase mb-2">Sello Digital Valido</p>
                    <div className="inline-block p-2 bg-slate-50 border border-slate-200 rounded-lg">
                       <CheckCircle2 className="w-10 h-10 text-medical-600 opacity-20" />
                    </div>
                  </div>
                </div>

                {/* Marca de agua */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 opacity-[0.03] select-none pointer-events-none">
                  <h1 className="text-9xl font-black">VOLUNTARIADO</h1>
                </div>
              </div>
            </div>

            {/* Footer del Modal con Acciones */}
            <div className="p-8 grid grid-cols-2 gap-4 bg-white rounded-b-[40px] shadow-inner">
              <button 
                onClick={() => setShowPreview(false)}
                className="py-5 border-2 border-slate-200 text-slate-500 rounded-3xl font-black uppercase text-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-5 h-5 rotate-180" /> Corregir Datos
              </button>
              <button 
                onClick={() => {
                  setShowPreview(false)
                  finalizarYGuardar()
                }}
                disabled={loading}
                className="py-5 bg-medical-600 text-white rounded-3xl font-black uppercase text-sm shadow-2xl flex items-center justify-center gap-3 hover:bg-medical-700 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} 
                Confirmar y Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navegación Inferior (Barra de Progreso Dinámica) */}
      <nav className="bg-white border-t p-2 flex justify-between items-center w-full sticky bottom-0 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] relative">
        {/* Línea de progreso de fondo */}
        <div className="absolute top-[35%] left-[10%] right-[10%] h-[2px] bg-slate-100 -z-10"></div>
        
        <button onClick={() => setActiveTab('search')} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-all relative ${activeTab === 'search' ? 'text-medical-600 scale-110' : 'text-slate-400 opacity-50'}`}>
          <div className={`w-3 h-3 rounded-full mb-2 border-2 ${activeTab === 'search' ? 'bg-medical-600 border-medical-200 ring-4 ring-medical-50' : 'bg-white border-slate-200'}`}></div>
          <span className="text-[9px] font-black uppercase">Inicio</span>
        </button>

        <button onClick={() => setActiveTab('patient')} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-all relative ${activeTab === 'patient' ? 'text-medical-600 scale-110' : 'text-slate-400 opacity-50'}`}>
          <div className={`w-3 h-3 rounded-full mb-2 border-2 ${activeTab === 'patient' ? 'bg-medical-600 border-medical-200 ring-4 ring-medical-50' : 'bg-white border-slate-200'}`}></div>
          <span className="text-[9px] font-black uppercase tracking-tighter">Paciente</span>
        </button>

        <button onClick={() => setActiveTab('clinic')} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-all relative ${activeTab === 'clinic' ? 'text-medical-600 scale-110' : 'text-slate-400 opacity-50'}`}>
          <div className={`w-3 h-3 rounded-full mb-2 border-2 ${activeTab === 'clinic' ? 'bg-medical-600 border-medical-200 ring-4 ring-medical-50' : 'bg-white border-slate-200'}`}></div>
          <span className="text-[9px] font-black uppercase tracking-tighter">Evaluación</span>
        </button>

        <button onClick={() => setActiveTab('recipe')} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-all relative ${activeTab === 'recipe' ? 'text-medical-600 scale-110' : 'text-slate-400 opacity-50'}`}>
          <div className={`w-3 h-3 rounded-full mb-2 border-2 ${activeTab === 'recipe' ? 'bg-medical-600 border-medical-200 ring-4 ring-medical-50' : 'bg-white border-slate-200'}`}></div>
          <span className="text-[9px] font-black uppercase tracking-tighter">Récipe</span>
        </button>

        <button onClick={() => router.push('/jornada')} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-all relative text-slate-400 opacity-50`}>
          <Calendar className="w-5 h-5 mb-1" />
          <span className="text-[8px] font-black uppercase">Jornada</span>
        </button>

        <button onClick={() => router.push('/perfil')} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-all relative text-slate-400 opacity-50`}>
          <UserCircle className="w-5 h-5 mb-1" />
          <span className="text-[8px] font-black uppercase">Perfil</span>
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
