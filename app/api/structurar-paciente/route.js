import { Groq } from 'groq-sdk'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req) {
  try {
    const { rawText } = await req.json()

    const systemPrompt = `Eres un asistente administrativo médico experto. Recibirás un relato con datos personales de un paciente y debes extraerlos en formato JSON.
    Campos obligatorios: { "nombre": "", "edad": "", "cedula": "", "telefono": "", "alergias": "" }
    Responde SOLO el JSON.`
    
    const userPrompt = `Extrae los datos de este dictado: "${rawText}"`

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
    })

    const content = chatCompletion.choices[0]?.message?.content
    let result
    try {
      result = JSON.parse(content)
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/)
      result = match ? JSON.parse(match[0]) : {}
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Fallo al extraer datos' }, { status: 500 })
  }
}
