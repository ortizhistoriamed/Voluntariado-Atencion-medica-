import './globals.css'

export const metadata = {
  title: 'Voluntariado Médico',
  description: 'Sistema de atención médica para voluntarios',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="VoluntarioMed" />
        <link rel="apple-touch-icon" href="https://cdn-icons-png.flaticon.com/512/3774/3774299.png" />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
