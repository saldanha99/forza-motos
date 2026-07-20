/**
 * Horário de funcionamento da oficina (definido na reunião de 20/07/2026):
 * seg–sex 9h às 18h · sábado 8h às 12h · domingo fechado.
 * Usado pelo formulário público de agendamento e pela validação da API.
 */

export const HORARIOS_SEMANA = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
export const HORARIOS_SABADO = ['08:00', '09:00', '10:00', '11:00']

/** Retorna os horários disponíveis para a data (YYYY-MM-DD); domingo = []. */
export function horariosParaData(data: string): string[] {
  if (!data) return []
  const dia = new Date(data + 'T00:00:00').getDay()
  if (dia === 0) return []
  if (dia === 6) return HORARIOS_SABADO
  return HORARIOS_SEMANA
}

/** Valida se a combinação data + horário está dentro do funcionamento. */
export function horarioValido(data: string, horario: string): boolean {
  return horariosParaData(data).includes(horario)
}
