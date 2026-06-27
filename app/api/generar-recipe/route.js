import { Groq } from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req) {
  try {
    const { paciente, historia } = await req.json()

    const systemPrompt = `Eres un asistente médico clínico. Genera récipes médicos profesionales en español. Responde SOLO con JSON válido, sin markdown, sin explicaciones.`
    
    const userPrompt = `
      Paciente: ${paciente.nombre}, ${paciente.edad} años.
      Patologías base: ${paciente.patologias}.
      Alergias: ${paciente.alergias}.
      Medicamentos actuales: ${paciente.medicamentos}.

      Historia: ${historia.anamnesis}.
      Examen físico: ${historia.examen_fisico}.
      Diagnóstico: ${historia.diagnostico}.

      Genera un récipe médico con este JSON exacto:
      {
        "diagnostico_confirmado": "",
        "medicamentos": [
          { "nombre": "", "dosis": "", "frecuencia": "", "duracion": "" }
        ],
        "indicaciones": "",
        "proxima_cita": ""
      }
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
