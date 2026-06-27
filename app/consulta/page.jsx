'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMedico } from '@/lib/session'
import MicButton from '@/components/MicButton'
import { 
  Phone, 
  MessageCircle, 
  Video, 
  Laptop, 
  User, 
  Clock, 
  Activity, 
  Stethoscope, 
  FileText, 
  Save, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  Download, 
  Send, 
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Thermometer,
  Wind,
  Heart,
  Droplets,
  AlertCircle
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function FichaClinicaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finalizado, setFinalizado] = useState(false)
  const [generatingIA, setGeneratingIA] = useState(false)
  const [expandedSection, setExpandedSection] = useState(1)
  const [medico, setMedico] = useState(null)

  // --- ESTADO DEL FORMULARIO ---
  const [canalContacto, setCanalContacto] = useState('')
  
  // SECCIÓN 1: Anamnesis y Datos Paciente
  const [pacienteData, setPacienteData] = useState({
    nombre: '',
    edad: '',
    sexo: '',
    ubicacion: '',
    motivo: '',
    inicioSintomas: '',
    caracteristicasSintoma: '',
    antecedentes: '',
    alergias: '',
    medicamentosHabituales: '',
    zonaDesastre: false,
    accesoAgua: true,
    accesoAlimentos: true,
    refugioSeguro: true
  })

  // SECCIÓN 2: Examen Físico
  const [examenFisico, setExamenFisico] = useState({
    estadoGeneral: '',
    glasgow: 'Alerta',
    coloracionPiel: [],
    fc: '',
    fr: '',
    pa: '',
    temperatura: '',
    sato2: '',
    inspeccionCabeza: '',
    inspeccionTorax: '',
    inspeccionAbdomen: '',
    inspeccionExtremidades: ''
  })

  // SECCIÓN 3: Diagnóstico y Plan
  const [diagnosticoPlan, setDiagnosticoPlan] = useState({
    diagnosticoPresuntivo: '',
    nivelGravedad: 'Leve',
    planAccion: '',
    criterioDerivacion: false,
    banderas_rojas: [],
    otraBanderaRoja: ''
  })

  // SECCIÓN 4: Récipe e Indicaciones
  const [recipe, setRecipe] = useState({
    diagnostico_confirmado: '',
    medicamentos: [],
    indicaciones: '',
    proxima_cita: ''
  })

  // --- RECONOCIMIENTO DE VOZ ---
  const [activeMic, setActiveMic] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const medicoData = getMedico()
    if (!medicoData) {
      router.push('/login')
    } else {
      setMedico(medicoData)
    }

    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'es-VE'
      }
    }
  }, [])

  const toggleMic = (field, setFunction) => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz.")
      return
    }

    if (activeMic === field) {
      recognitionRef.current.stop()
      setActiveMic(null)
    } else {
      if (activeMic) recognitionRef.current.stop()
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript
        setFunction(prev => {
          if (typeof prev === 'object') {
            return { ...prev, [field]: (prev[field] ? prev[field] + ' ' : '') + transcript }
          }
          return (prev ? prev + ' ' : '') + transcript
        })
      }

      recognitionRef.current.onerror = () => setActiveMic(null)
      recognitionRef.current.onend = () => setActiveMic(null)

      recognitionRef.current.start()
      setActiveMic(field)
    }
  }

  // --- ACCIONES MEDICAMENTOS ---
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

  // --- GENERAR RÉCIPE CON IA ---
  const generarRecipeIA = async () => {
    setGeneratingIA(true)
    try {
      const res = await fetch('/api/generar-recipe', {
        method: 'POST',
        body: JSON.stringify({
          paciente: {
            ...pacienteData,
            ...examenFisico,
            ...diagnosticoPlan,
            canalContacto
          }
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setRecipe({
        diagnostico_confirmado: data.diagnostico_confirmado || diagnosticoPlan.diagnosticoPresuntivo,
        medicamentos: data.medicamentos || [],
        indicaciones: data.indicaciones || '',
        proxima_cita: data.proxima_cita || ''
      })
      setExpandedSection(4)
    } catch (err) {
      alert("Error al generar récipe con IA. Por favor intenta de nuevo.")
    } finally {
      setGeneratingIA(false)
    }
  }

  // --- GUARDAR FICHA ---
  const handleGuardar = async () => {
    if (!pacienteData.nombre) {
      alert("Por favor ingresa al menos el nombre del paciente.")
      setExpandedSection(1)
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('consultas')
        .insert({
          medico_id: medico.id,
          medico_nombre: medico.nombre,
          paciente_nombre: pacienteData.nombre,
          paciente_edad: pacienteData.edad,
          paciente_sexo: pacienteData.sexo,
          paciente_ubicacion: pacienteData.ubicacion,
          canal_contacto: canalContacto,
          motivo: pacienteData.motivo,
          inicio_sintomas: pacienteData.inicioSintomas,
          caracteristicas_sintoma: pacienteData.caracteristicasSintoma,
          antecedentes: pacienteData.antecedentes,
          alergias: pacienteData.alergias,
          medicamentos_habituales: pacienteData.medicamentosHabituales,
          zona_desastre: pacienteData.zonaDesastre,
          acceso_agua: pacienteData.accesoAgua,
          acceso_alimentos: pacienteData.accesoAlimentos,
          refugio_seguro: pacienteData.refugioSeguro,
          estado_general: examenFisico.estadoGeneral,
          glasgow: examenFisico.glasgow,
          coloracion_piel: examenFisico.coloracionPiel.join(','),
          fc: examenFisico.fc,
          fr: examenFisico.fr,
          pa: examenFisico.pa,
          temperatura: examenFisico.temperatura,
          sato2: examenFisico.sato2,
          inspeccion_cabeza: examenFisico.inspeccionCabeza,
          inspeccion_torax: examenFisico.inspeccionTorax,
          inspeccion_abdomen: examenFisico.inspeccionAbdomen,
          inspeccion_extremidades: examenFisico.inspeccionExtremidades,
          diagnostico_presuntivo: diagnosticoPlan.diagnosticoPresuntivo,
          nivel_gravedad: diagnosticoPlan.nivelGravedad,
          plan_accion: diagnosticoPlan.planAccion,
          criterio_derivacion: diagnosticoPlan.criterioDerivacion,
          banderas_rojas: diagnosticoPlan.banderas_rojas,
          recipe: recipe
        })
        .select()
        .single()

      if (error) throw error
      setFinalizado(true)
      alert("¡Ficha Clínica guardada con éxito!")
    } catch (err) {
      console.error(err)
      alert("Error al guardar la ficha.")
    } finally {
      setSaving(false)
    }
  }

  // --- DESCARGAR PDF ---
  const descargarPDF = () => {
    const doc = new jsPDF()
    const fecha = new Date().toLocaleString()

    // Estilos y Header
    doc.setFillColor(14, 165, 233)
    doc.rect(0, 0, 210, 40, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.text("FICHA CLÍNICA DE TELEMEDICINA", 105, 25, { align: 'center' })
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.text(`Médico: ${medico.nombre}`, 20, 50)
    doc.text(`Fecha: ${fecha}`, 190, 50, { align: 'right' })
    doc.text(`Canal: ${canalContacto || 'No especificado'}`, 20, 55)

    // Sección 1: Datos del Paciente
    doc.setFontSize(14)
    doc.setTextColor(14, 165, 233)
    doc.text("ANAMNESIS Y DATOS DEL PACIENTE", 20, 70)
    doc.line(20, 72, 190, 72)
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    let y = 80
    doc.text(`Paciente: ${pacienteData.nombre}`, 20, y); y += 6
    doc.text(`Edad: ${pacienteData.edad} años`, 20, y); y += 6
    doc.text(`Sexo: ${pacienteData.sexo}`, 20, y); y += 6
    doc.text(`Ubicación: ${pacienteData.ubicacion}`, 20, y); y += 10
    
    doc.setFont("helvetica", "bold")
    doc.text("Motivo de consulta:", 20, y); y += 5
    doc.setFont("helvetica", "normal")
    const motivoText = doc.splitTextToSize(pacienteData.motivo || 'N/A', 170)
    doc.text(motivoText, 20, y); y += motivoText.length * 5 + 5

    // Sección 2: Examen Físico
    doc.setFontSize(14)
    doc.setTextColor(14, 165, 233)
    doc.text("EXAMEN FÍSICO", 20, y); y += 2
    doc.line(20, y, 190, y); y += 8
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.text(`Glasgow: ${examenFisico.glasgow}`, 20, y)
    doc.text(`Piel: ${examenFisico.coloracionPiel.join(', ') || 'Normal'}`, 100, y); y += 8
    
    doc.autoTable({
      startY: y,
      head: [['FC', 'FR', 'PA', 'Temp', 'SatO2']],
      body: [[examenFisico.fc || '-', examenFisico.fr || '-', examenFisico.pa || '-', examenFisico.temperatura || '-', examenFisico.sato2 || '-']],
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233] },
      margin: { left: 20, right: 20 }
    })
    y = doc.lastAutoTable.finalY + 10

    // Sección 3: Diagnóstico y Récipe
    doc.setFontSize(14)
    doc.setTextColor(14, 165, 233)
    doc.text("DIAGNÓSTICO Y RÉCIPE", 20, y); y += 2
    doc.line(20, y, 190, y); y += 8
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text(`Gravedad: ${diagnosticoPlan.nivelGravedad}`, 20, y); y += 8
    doc.text("Diagnóstico:", 20, y); y += 5
    doc.setFont("helvetica", "normal")
    const dxText = doc.splitTextToSize(recipe.diagnostico_confirmado || diagnosticoPlan.diagnosticoPresuntivo || 'N/A', 170)
    doc.text(dxText, 20, y); y += dxText.length * 5 + 8

    if (recipe.medicamentos.length > 0) {
      doc.autoTable({
        startY: y,
        head: [['Medicamento', 'Dosis', 'Frecuencia', 'Días']],
        body: recipe.medicamentos.map(m => [m.nombre, m.dosis, m.frecuencia, m.duracion]),
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138] }
      })
      y = doc.lastAutoTable.finalY + 10
    }

    doc.setFont("helvetica", "bold")
    doc.text("Indicaciones:", 20, y); y += 5
    doc.setFont("helvetica", "normal")
    const indText = doc.splitTextToSize(recipe.indicaciones || 'N/A', 170)
    doc.text(indText, 20, y); y += indText.length * 5 + 10

    doc.save(`Ficha_Clinica_${pacienteData.nombre.replace(/\s+/g, '_')}.pdf`)
  }

  // --- ENVIAR WHATSAPP ---
  const enviarWhatsApp = () => {
    const texto =
      `Hola ${pacienteData.nombre}, le saluda el equipo de *Voluntariado Médico*.\n\n` +
      `A continuación le enviamos el resumen completo de su consulta médica de hoy:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *HISTORIA CLÍNICA*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Paciente: ${pacienteData.nombre}, ${pacienteData.edad} años, ${pacienteData.sexo}\n` +
      `📍 Ubicación: ${pacienteData.ubicacion || 'No especificada'}\n` +
      `📞 Canal de atención: ${canalContacto}\n` +
      `📅 Fecha: ${new Date().toLocaleDateString('es-VE')}\n` +
      `👨‍⚕️ Médico: Dr(a). ${medico.nombre} ${medico.apellido || ''} — ${medico.especialidad || 'General'}\n\n` +
      `🔍 *MOTIVO DE CONSULTA*\n${pacienteData.motivo}\n\n` +
      (pacienteData.inicioSintomas ? `⏱ Inicio de síntomas: ${new Date(pacienteData.inicioSintomas).toLocaleString('es-VE')}\n` : '') +
      (pacienteData.caracteristicasSintoma ? `📝 Características: ${pacienteData.caracteristicasSintoma}\n` : '') +
      (pacienteData.antecedentes ? `\n🏥 *ANTECEDENTES*\n${pacienteData.antecedentes}\n` : '') +
      (pacienteData.alergias ? `⚠️ Alergias: ${pacienteData.alergias}\n` : '') +
      (pacienteData.medicamentosHabituales ? `💊 Medicamentos habituales: ${pacienteData.medicamentosHabituales}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🩺 *EXAMEN FÍSICO*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (examenFisico.estadoGeneral ? `Estado general: ${examenFisico.estadoGeneral}\n` : '') +
      (examenFisico.glasgow ? `Glasgow: ${examenFisico.glasgow}\n` : '') +
      (examenFisico.coloracionPiel?.length ? `Coloración: ${examenFisico.coloracionPiel.join(', ')}\n` : '') +
      ((examenFisico.fc || examenFisico.fr || examenFisico.pa || examenFisico.temperatura || examenFisico.sato2) ?
        `\n📊 *Signos Vitales*\n` +
        (examenFisico.fc ? `FC: ${examenFisico.fc} lpm\n` : '') +
        (examenFisico.fr ? `FR: ${examenFisico.fr} rpm\n` : '') +
        (examenFisico.pa ? `PA: ${examenFisico.pa} mmHg\n` : '') +
        (examenFisico.temperatura ? `Temp: ${examenFisico.temperatura}°C\n` : '') +
        (examenFisico.sato2 ? `SatO2: ${examenFisico.sato2}%\n` : '')
      : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🔬 *DIAGNÓSTICO Y PLAN*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Diagnóstico: ${recipe.diagnostico_confirmado || diagnosticoPlan.diagnosticoPresuntivo}\n` +
      `Gravedad: ${diagnosticoPlan.nivelGravedad}\n` +
      (diagnosticoPlan.planAccion ? `Plan: ${diagnosticoPlan.planAccion}\n` : '') +
      (diagnosticoPlan.criterioDerivacion ? `⚠️ Se recomienda acudir a un centro hospitalario.\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `💊 *RÉCIPE MÉDICO*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (recipe.medicamentos?.length > 0
        ? recipe.medicamentos.map(m => `• ${m.nombre} ${m.dosis} — ${m.frecuencia} por ${m.duracion}`).join('\n')
        : 'Sin medicamentos indicados') +
      `\n\n📌 *Indicaciones:*\n${recipe.indicaciones || 'Ver con su médico'}\n` +
      (recipe.proxima_cita ? `\n🗓 *Próxima cita:* ${recipe.proxima_cita}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `_Este resumen fue generado por el sistema de Voluntariado Médico de Atención en Emergencias._\n` +
      `_Guarde este mensaje como respaldo de su consulta._`

    const tel = (pacienteData.telefono || '').replace(/\D/g, '')
    const numero = tel.startsWith('58') ? tel : `58${tel}`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  // Ayudantes de UI
  const isEmergency = diagnosticoPlan.nivelGravedad === 'Emergencia' || (diagnosticoPlan.banderas_rojas && diagnosticoPlan.banderas_rojas.length > 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* BANNER DE EMERGENCIA */}
      {isEmergency && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-3 z-50 font-bold animate-pulse shadow-xl flex items-center justify-center gap-2">
          <AlertTriangle className="w-6 h-6" />
          ⚠️ PACIENTE REQUIERE ATENCIÓN PRESENCIAL INMEDIATA
        </div>
      )}

      {/* BARRA SUPERIOR FIJA: CANAL DE CONTACTO */}
      <header className="sticky top-0 bg-white border-b shadow-sm p-4 z-40">
        <div className="max-w-xl mx-auto flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Canal de Atención</p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'Llamada', icon: Phone, label: 'Llamada' },
              { id: 'WhatsApp', icon: MessageCircle, label: 'WhatsApp' },
              { id: 'Video', icon: Video, label: 'Video' },
              { id: 'SMS', icon: MessageCircle, label: 'SMS' },
              { id: 'Otro', icon: Laptop, label: 'Otro' }
            ].map(canal => (
              <button
                key={canal.id}
                onClick={() => setCanalContacto(canal.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all border-2 
                  ${canalContacto === canal.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}
              >
                <canal.icon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold uppercase">{canal.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-8 space-y-4">
        
        {/* SECCIÓN 1: ANAMNESIS */}
        <section className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 transition-all">
          <button 
            onClick={() => setExpandedSection(expandedSection === 1 ? 0 : 1)}
            className={`w-full p-6 flex justify-between items-center ${expandedSection === 1 ? 'bg-blue-600 text-white' : 'text-slate-800'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${expandedSection === 1 ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-600'}`}>1</div>
              <span className="text-lg font-bold">Anamnesis y Datos</span>
            </div>
            {expandedSection === 1 ? <ChevronUp /> : <ChevronDown />}
          </button>
          
          {expandedSection === 1 && (
            <div className="p-6 space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Nombre del Paciente" placeholder="Nombre completo" value={pacienteData.nombre} onChange={val => setPacienteData({...pacienteData, nombre: val})} />
                <InputGroup label="Edad" type="number" placeholder="0" value={pacienteData.edad} onChange={val => setPacienteData({...pacienteData, edad: val})} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Sexo</label>
                <div className="flex gap-2">
                  {['Masculino', 'Femenino', 'Otro'].map(s => (
                    <button
                      key={s}
                      onClick={() => setPacienteData({...pacienteData, sexo: s})}
                      className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${pacienteData.sexo === s ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <InputGroup 
                label="Ubicación Actual" 
                icon={<MapPin className="w-4 h-4" />} 
                placeholder="Ciudad, estado o sector" 
                value={pacienteData.ubicacion} 
                onChange={val => setPacienteData({...pacienteData, ubicacion: val})} 
              />

              <TextAreaMic 
                label="Motivo de Consulta" 
                value={pacienteData.motivo} 
                onChange={val => setPacienteData({...pacienteData, motivo: val})} 
                activeMic={activeMic === 'motivo'} 
                onToggleMic={() => toggleMic('motivo', setPacienteData)}
              />

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Inicio de Síntomas</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                  value={pacienteData.inicioSintomas}
                  onChange={e => setPacienteData({...pacienteData, inicioSintomas: e.target.value})}
                />
              </div>

              <TextAreaMic 
                label="Características del Síntoma" 
                placeholder="Tipo, intensidad, qué lo agrava o alivia..."
                value={pacienteData.caracteristicasSintoma} 
                onChange={val => setPacienteData({...pacienteData, caracteristicasSintoma: val})} 
                activeMic={activeMic === 'caracteristicasSintoma'} 
                onToggleMic={() => toggleMic('caracteristicasSintoma', setPacienteData)}
              />

              <TextAreaMic 
                label="Antecedentes Mórbidos" 
                placeholder="HTA, Diabetes, cirugías previas..."
                value={pacienteData.antecedentes} 
                onChange={val => setPacienteData({...pacienteData, antecedentes: val})} 
                showMic={false}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Alergias Medicamentosas" placeholder="Penicilina, etc." value={pacienteData.alergias} onChange={val => setPacienteData({...pacienteData, alergias: val})} />
                <InputGroup label="Medicamentos Habituales" placeholder="Metformina 500mg/día" value={pacienteData.medicamentosHabituales} onChange={val => setPacienteData({...pacienteData, medicamentosHabituales: val})} />
              </div>

              {/* CONTEXTO DE CONTINGENCIA */}
              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-3">
                <p className="text-xs font-bold text-orange-800 uppercase flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Contexto de Contingencia
                </p>
                <div className="space-y-4">
                  <Toggle active={pacienteData.zonaDesastre} label="¿Está en zona de desastre?" onChange={val => setPacienteData({...pacienteData, zonaDesastre: val})} />
                  <Toggle active={pacienteData.accesoAgua} label="¿Tiene acceso a agua potable?" onChange={val => setPacienteData({...pacienteData, accesoAgua: val})} />
                  <Toggle active={pacienteData.accesoAlimentos} label="¿Tiene acceso a alimentos?" onChange={val => setPacienteData({...pacienteData, accesoAlimentos: val})} />
                  <Toggle active={pacienteData.refugioSeguro} label="¿Está en refugio seguro?" onChange={val => setPacienteData({...pacienteData, refugioSeguro: val})} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECCIÓN 2: EXAMEN FÍSICO */}
        <section className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 transition-all">
          <button 
            onClick={() => setExpandedSection(expandedSection === 2 ? 0 : 2)}
            className={`w-full p-6 flex justify-between items-center ${expandedSection === 2 ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${expandedSection === 2 ? 'bg-white text-slate-700' : 'bg-slate-200 text-slate-600'}`}>2</div>
              <div className="text-left">
                <span className="text-lg font-bold block">Examen Físico</span>
                <span className="text-[10px] uppercase opacity-60">Dirigido por {canalContacto || 'canal médico'}</span>
              </div>
            </div>
            {expandedSection === 2 ? <ChevronUp /> : <ChevronDown />}
          </button>

          {expandedSection === 2 && (
            <div className="p-6 space-y-6">
              <TextAreaMic 
                label="Estado General" 
                placeholder="Facies, nivel de conciencia, aspecto general"
                value={examenFisico.estadoGeneral} 
                onChange={val => setExamenFisico({...examenFisico, estadoGeneral: val})} 
                activeMic={activeMic === 'estadoGeneral'} 
                onToggleMic={() => toggleMic('estadoGeneral', setExamenFisico)}
              />

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Escala de Glasgow (Simplificada)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Alerta', 'Confuso', 'Somnoliento', 'Inconsciente'].map(g => (
                    <button
                      key={g}
                      onClick={() => setExamenFisico({...examenFisico, glasgow: g})}
                      className={`py-3 rounded-xl font-bold border-2 transition-all ${examenFisico.glasgow === g ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-transparent text-slate-500'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Coloración de Piel</label>
                <div className="flex flex-wrap gap-2">
                  {['Normal', 'Pálido', 'Cianótico', 'Ictérico', 'Rubicundo'].map(c => {
                    const active = examenFisico.coloracionPiel.includes(c)
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          const newColors = active 
                            ? examenFisico.coloracionPiel.filter(item => item !== c)
                            : [...examenFisico.coloracionPiel, c]
                          setExamenFisico({...examenFisico, coloracionPiel: newColors})
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-transparent text-slate-500'}`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* SIGNOS VITALES */}
              <div className="bg-slate-100 p-4 rounded-3xl">
                <p className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest">Signos Vitales</p>
                <div className="grid grid-cols-2 gap-4">
                  <VitalInput label="FC" unit="lpm" icon={<Heart className="text-red-500 w-4 h-4"/>} value={examenFisico.fc} onChange={val => setExamenFisico({...examenFisico, fc: val})} />
                  <VitalInput label="FR" unit="rpm" icon={<Wind className="text-blue-500 w-4 h-4"/>} value={examenFisico.fr} onChange={val => setExamenFisico({...examenFisico, fr: val})} />
                  <VitalInput label="PA" unit="mmHg" icon={<Activity className="text-emerald-500 w-4 h-4"/>} value={examenFisico.pa} onChange={val => setExamenFisico({...examenFisico, pa: val})} />
                  <VitalInput label="Temp" unit="°C" icon={<Thermometer className="text-orange-500 w-4 h-4"/>} value={examenFisico.temperatura} onChange={val => setExamenFisico({...examenFisico, temperatura: val})} />
                  <VitalInput label="SatO2" unit="%" icon={<Droplets className="text-cyan-500 w-4 h-4"/>} value={examenFisico.sato2} onChange={val => setExamenFisico({...examenFisico, sato2: val})} className="col-span-2" />
                </div>
              </div>

              {/* INSPECCIÓN POR SEGMENTOS */}
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inspección por Segmentos</p>
                <TextAreaMic label="Cabeza/Cuello" value={examenFisico.inspeccionCabeza} onChange={val => setExamenFisico({...examenFisico, inspeccionCabeza: val})} activeMic={activeMic === 'inspeccionCabeza'} onToggleMic={() => toggleMic('inspeccionCabeza', setExamenFisico)} />
                <TextAreaMic label="Tórax" value={examenFisico.inspeccionTorax} onChange={val => setExamenFisico({...examenFisico, inspeccionTorax: val})} activeMic={activeMic === 'inspeccionTorax'} onToggleMic={() => toggleMic('inspeccionTorax', setExamenFisico)} />
                <TextAreaMic label="Abdomen" value={examenFisico.inspeccionAbdomen} onChange={val => setExamenFisico({...examenFisico, inspeccionAbdomen: val})} activeMic={activeMic === 'inspeccionAbdomen'} onToggleMic={() => toggleMic('inspeccionAbdomen', setExamenFisico)} />
                <TextAreaMic label="Extremidades" value={examenFisico.inspeccionExtremidades} onChange={val => setExamenFisico({...examenFisico, inspeccionExtremidades: val})} activeMic={activeMic === 'inspeccionExtremidades'} onToggleMic={() => toggleMic('inspeccionExtremidades', setExamenFisico)} />
              </div>
            </div>
          )}
        </section>

        {/* SECCIÓN 3: DIAGNÓSTICO Y PLAN */}
        <section className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 transition-all">
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
              <TextAreaMic 
                label="Diagnóstico Presuntivo" 
                value={diagnosticoPlan.diagnosticoPresuntivo} 
                onChange={val => setDiagnosticoPlan({...diagnosticoPlan, diagnosticoPresuntivo: val})} 
                activeMic={activeMic === 'diagnosticoPresuntivo'} 
                onToggleMic={() => toggleMic('diagnosticoPresuntivo', setDiagnosticoPlan)}
              />

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Nivel de Gravedad</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Leve', color: 'bg-green-500', text: 'text-green-500', bg: 'bg-green-50' },
                    { id: 'Moderado', color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50' },
                    { id: 'Severo', color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' },
                    { id: 'Emergencia', color: 'bg-red-600', text: 'text-red-700', bg: 'bg-red-50', pulse: true }
                  ].map(nivel => (
                    <button
                      key={nivel.id}
                      onClick={() => setDiagnosticoPlan({...diagnosticoPlan, nivelGravedad: nivel.id})}
                      className={`p-4 rounded-2xl flex flex-col items-center border-2 transition-all 
                        ${diagnosticoPlan.nivelGravedad === nivel.id 
                          ? `${nivel.color} border-transparent text-white shadow-lg ${nivel.pulse ? 'animate-pulse' : ''}` 
                          : `${nivel.bg} border-transparent ${nivel.text}`}`}
                    >
                      <div className={`w-3 h-3 rounded-full mb-1 ${diagnosticoPlan.nivelGravedad === nivel.id ? 'bg-white' : nivel.color}`} />
                      <span className="font-black uppercase text-sm">{nivel.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <TextAreaMic 
                label="Plan de Acción" 
                placeholder="Recomendaciones inmediatas, tratamiento inicial..."
                value={diagnosticoPlan.planAccion} 
                onChange={val => setDiagnosticoPlan({...diagnosticoPlan, planAccion: val})} 
                activeMic={activeMic === 'planAccion'} 
                onToggleMic={() => toggleMic('planAccion', setDiagnosticoPlan)}
              />

              <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
                <Toggle 
                  active={diagnosticoPlan.criterioDerivacion} 
                  label="¿Requiere derivación hospitalaria?" 
                  onChange={val => setDiagnosticoPlan({...diagnosticoPlan, criterioDerivacion: val})} 
                  className="text-lg font-black text-slate-800"
                />
              </div>

              {/* BANDERAS ROJAS */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-3 block flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" /> Banderas Rojas
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Dificultad respiratoria',
                    'Sangrado profuso',
                    'Alteración mental',
                    'Dolor torácico'
                  ].map(bandera => {
                    const active = (diagnosticoPlan.banderas_rojas || []).includes(bandera)
                    return (
                      <button
                        key={bandera}
                        onClick={() => {
                          const currentBanderas = diagnosticoPlan.banderas_rojas || []
                          const newBanderas = active 
                            ? currentBanderas.filter(b => b !== bandera)
                            : [...currentBanderas, bandera]
                          setDiagnosticoPlan({...diagnosticoPlan, banderas_rojas: newBanderas})
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all 
                          ${active ? 'bg-red-600 border-red-600 text-white shadow-inner animate-pulse' : 'bg-white border-slate-200 text-slate-600'}`}
                      >
                        {bandera}
                      </button>
                    )
                  })}
                </div>
                <input 
                  type="text" 
                  placeholder="Otra bandera roja..."
                  className="w-full mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm"
                  value={diagnosticoPlan.otraBanderaRoja}
                  onChange={e => setDiagnosticoPlan({...diagnosticoPlan, otraBanderaRoja: e.target.value})}
                />
              </div>
            </div>
          )}
        </section>

        {/* SECCIÓN 4: RÉCIPE E INDICACIONES */}
        <section className="bg-blue-50 rounded-3xl overflow-hidden shadow-sm border border-blue-200 transition-all">
          <button 
            onClick={() => setExpandedSection(expandedSection === 4 ? 0 : 4)}
            className={`w-full p-6 flex justify-between items-center ${expandedSection === 4 ? 'bg-blue-800 text-white' : 'text-blue-900'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${expandedSection === 4 ? 'bg-white text-blue-800' : 'bg-blue-200 text-blue-700'}`}>4</div>
              <span className="text-lg font-bold">Récipe e Indicaciones</span>
            </div>
            {expandedSection === 4 ? <ChevronUp /> : <ChevronDown />}
          </button>

          {expandedSection === 4 && (
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <button
                  onClick={generarRecipeIA}
                  disabled={generatingIA || !diagnosticoPlan.diagnosticoPresuntivo}
                  className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl transform active:scale-95
                    ${generatingIA || !diagnosticoPlan.diagnosticoPresuntivo 
                      ? 'bg-slate-200 text-slate-400' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-2xl'}`}
                >
                  {generatingIA ? <Loader2 className="animate-spin" /> : '✨ GENERAR RÉCIPE CON IA'}
                </button>
              </div>

              {(recipe.medicamentos.length > 0 || recipe.diagnostico_confirmado) && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <InputGroup 
                    label="Diagnóstico Confirmado (Récipe)" 
                    value={recipe.diagnostico_confirmado} 
                    onChange={val => setRecipe({...recipe, diagnostico_confirmado: val})} 
                    className="bg-white border-blue-100"
                  />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-blue-700 uppercase">Medicamentos</p>
                      <button onClick={handleAddMed} className="text-[10px] bg-blue-700 text-white px-3 py-1 rounded-full flex items-center gap-1 font-black">
                        <Plus className="w-3 h-3" /> AGREGAR
                      </button>
                    </div>
                    {recipe.medicamentos.map((med, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 grid grid-cols-12 gap-3 relative overflow-hidden">
                        <div className="col-span-12">
                          <input 
                            placeholder="Nombre del medicamento" 
                            className="w-full font-bold text-blue-900 border-b border-slate-50 outline-none" 
                            value={med.nombre} 
                            onChange={e => handleMedChange(idx, 'nombre', e.target.value)}
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="text-[10px] text-slate-400 uppercase block">Dosis</label>
                          <input className="w-full text-sm outline-none" value={med.dosis} onChange={e => handleMedChange(idx, 'dosis', e.target.value)} />
                        </div>
                        <div className="col-span-4">
                          <label className="text-[10px] text-slate-400 uppercase block">Frecuencia</label>
                          <input className="w-full text-sm outline-none" value={med.frecuencia} onChange={e => handleMedChange(idx, 'frecuencia', e.target.value)} />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-400 uppercase block">Días</label>
                          <input className="w-full text-sm outline-none" value={med.duracion} onChange={e => handleMedChange(idx, 'duracion', e.target.value)} />
                        </div>
                        <button onClick={() => handleRemoveMed(idx)} className="col-span-1 text-red-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <TextAreaMic 
                    label="Indicaciones para el Paciente" 
                    value={recipe.indicaciones} 
                    onChange={val => setRecipe({...recipe, indicaciones: val})} 
                    showMic={false}
                    className="bg-white"
                  />

                  <InputGroup 
                    label="Próxima Cita o Seguimiento" 
                    value={recipe.proxima_cita} 
                    onChange={val => setRecipe({...recipe, proxima_cita: val})} 
                    className="bg-white"
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* BOTÓN FINAL FIJO */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pt-10 z-50">
        {!finalizado ? (
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="w-full max-w-xl mx-auto block bg-blue-600 text-white font-black py-5 rounded-2xl text-xl shadow-2xl transition-all active:scale-95 disabled:bg-slate-400 flex items-center justify-center gap-3"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save className="w-6 h-6" />}
            GUARDAR FICHA COMPLETA
          </button>
        ) : (
          <div className="max-w-xl mx-auto grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <button
              onClick={enviarWhatsApp}
              className="flex items-center justify-center gap-3 py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg"
            >
              <Send className="w-5 h-5" /> WHATSAPP
            </button>
            <button
              onClick={descargarPDF}
              className="flex items-center justify-center gap-3 py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg"
            >
              <Download className="w-5 h-5" /> PDF
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// COMPONENTES ÚTILES
function InputGroup({ label, type = "text", placeholder, value, onChange, icon, className }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-1">
        {icon} {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function TextAreaMic({ label, placeholder, value, onChange, activeMic, onToggleMic, showMic = true, className }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
        {showMic && <MicButton active={activeMic} onToggle={onToggleMic} />}
      </div>
      <textarea
        placeholder={placeholder}
        className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function Toggle({ active, label, onChange, className }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onChange(!active);
      }}
      className={`w-full flex items-center justify-between p-1 rounded-2xl transition-all ${className}`}
    >
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <div className={`w-14 h-8 rounded-full relative transition-all ${active ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${active ? 'left-7' : 'left-1'}`} />
      </div>
    </button>
  )
}

function VitalInput({ label, unit, icon, value, onChange, className }) {
  return (
    <div className={`bg-white p-3 rounded-2xl shadow-sm space-y-1 ${className}`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <input
          type="text"
          placeholder="--"
          className="w-full text-lg font-black text-slate-800 outline-none placeholder:text-slate-200"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-[10px] font-bold text-slate-300 uppercase">{unit}</span>
      </div>
    </div>
  )
}
