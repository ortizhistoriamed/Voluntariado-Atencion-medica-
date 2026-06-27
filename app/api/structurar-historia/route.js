import { Groq } from 'groq-sdk'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req) {
  try {
    const { rawText } = await req.json()

    const systemPrompt = `Eres un asistente médico experto en transcripción clínica. Recibirás un relato hablado de un médico y debes estructurarlo en JSON. 
    Responde SOLO el JSON, sin texto extra.
    Campos: { "anamnesis": "", "examen_fisico": "", "diagnostico": "" }`
    
    const userPrompt = `Estructura este relato clínico: "${rawText}"`

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
    })

    const content = chatCompletion.choices[0]?.message?.content
    let result
    try {
      result = JSON.parse(content)
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/)
      result = match ? JSON.parse(match[0]) : { anamnesis: rawText, examen_fisico: "", diagnostico: "" }
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Fallo al estructurar' }, { status: 500 })
  }
}
