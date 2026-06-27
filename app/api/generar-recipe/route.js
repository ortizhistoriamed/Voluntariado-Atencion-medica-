import { Groq } from 'groq-sdk'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req) {
  try {
    const { paciente, historia } = await req.json()

    const systemPrompt = `Eres un asistente médico clínico. Genera récipes médicos profesionales en español. Responde SOLO con JSON válido, sin markdown, sin explicaciones.`
    
    const userPrompt = `
      Paciente: ${paciente.nombre}, ${paciente.edad} años, sexo ${paciente.sexo}, ubicación: ${paciente.ubicacion}.
      Canal de atención: ${paciente.canalContacto}.
      Motivo: ${paciente.motivo}.
      Síntomas desde: ${paciente.inicioSintomas}. Características: ${paciente.caracteristicasSintoma}.
      Antecedentes: ${paciente.antecedentes}. Alergias: ${paciente.alergias}.
      Medicamentos habituales: ${paciente.medicamentosHabituales}.
      Contexto: zona desastre=${paciente.zonaDesastre}, agua=${paciente.accesoAgua}, alimentos=${paciente.accesoAlimentos}.
      Examen físico: ${paciente.estadoGeneral}. Glasgow: ${paciente.glasgow}. Piel: ${paciente.coloracionPiel}.
      Signos vitales: FC=${paciente.fc}, FR=${paciente.fr}, PA=${paciente.pa}, Temp=${paciente.temperatura}, SatO2=${paciente.sato2}.
      Inspección: cabeza=${paciente.inspeccionCabeza}, tórax=${paciente.inspeccionTorax}, abdomen=${paciente.inspeccionAbdomen}, extremidades=${paciente.inspeccionExtremidades}.
      Diagnóstico presuntivo: ${paciente.diagnosticoPresuntivo}.
      Gravedad: ${paciente.nivelGravedad}.
      Banderas rojas: ${paciente.banderasRojas ? paciente.banderasRojas.join(', ') : 'ninguna'}.

      Genera un récipe médico con este JSON exacto:
      {
        "diagnostico_confirmado": "",
        "medicamentos": [
          { "nombre": "", "dosis": "", "frecuencia": "", "duracion": "" }
        ],
        "indicaciones": "",
        "proxima_cita": ""
      }
      Solo JSON, sin markdown.
    `

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
    })

    const content = chatCompletion.choices[0]?.message?.content
    
    let recipeData
    try {
      recipeData = JSON.parse(content)
    } catch (e) {
      // Intento de rescate mediante regex si viene con texto extra
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        recipeData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No se pudo parsear el JSON de la respuesta de Groq')
      }
    }

    return NextResponse.json(recipeData)
  } catch (error) {
    console.error('Error in generar-recipe:', error)
    return NextResponse.json({ error: 'Fallo al generar el récipe' }, { status: 500 })
  }
}
