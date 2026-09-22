import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      /** Áreas do painel liberadas — foto do momento do login */
      permissoes: string[]
    }
  }
  interface User {
    role: string
    permissoes?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    permissoes?: string[]
  }
}
