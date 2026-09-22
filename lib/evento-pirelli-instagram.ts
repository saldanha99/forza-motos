export const INSTAGRAM_EVENTO_URL = 'https://www.instagram.com/'

export const PERFIS_INSTAGRAM_EVENTO = [
  { handle: '@forzamotos', url: 'https://www.instagram.com/forzamotos/' },
  { handle: '@pirelli', url: 'https://www.instagram.com/pirelli/' },
  { handle: '@campneus', url: 'https://www.instagram.com/campneus/' },
] as const

export const HASHTAGS_INSTAGRAM_EVENTO = [
  '#DesafioForzaNoRodeo',
  '#ForzaMotos',
  '#Pirelli',
  '#Campneus',
  '#RodeoLuckyFriends',
] as const

export const TEXTO_INSTAGRAM_EVENTO = [
  'Curtindo o Rodeo Lucky Friends com a Forza Motos! 🏍️🔥',
  '',
  PERFIS_INSTAGRAM_EVENTO.map((perfil) => perfil.handle).join(' '),
  HASHTAGS_INSTAGRAM_EVENTO.join(' '),
].join('\n')
