import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { permissoesEfetivas } from './admin/permissoes'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.senha) return null
        // Usuário desligado não entra, mesmo com a senha certa.
        if (!user.ativo) return null

        const senhaCorreta = await bcrypt.compare(credentials.senha, user.senha)
        if (!senhaCorreta) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nome,
          role: user.role,
          permissoes: permissoesEfetivas(user.role, user.permissoes),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.permissoes = (user as any).permissoes ?? []
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        // Cópia do momento do login — serve para desenhar o menu e para o
        // proxy. Quem decide de verdade é lib/admin/acesso.ts, que relê o
        // banco a cada requisição.
        session.user.permissoes = (token.permissoes as string[]) ?? []
      }
      return session
    },
  },
}
