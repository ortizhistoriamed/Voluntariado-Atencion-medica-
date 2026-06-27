/**
 * Gestión de Sesión del Médico
 */

export function getMedico() {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem('medico_profesional')
  return data ? JSON.parse(data) : null
}

export function iniciarSesionMedico(userData) {
  localStorage.setItem('medico_profesional', JSON.stringify(userData))
}

export function cerrarSesionMedico() {
  localStorage.removeItem('medico_profesional')
  window.location.href = '/login'
}
