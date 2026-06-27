import './globals.css'

export const metadata = {
  title: 'Voluntariado Médico',
  description: 'Sistema de atención médica para voluntarios',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}
