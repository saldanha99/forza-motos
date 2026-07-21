// Lista os usuários do banco. Usa DATABASE_URL do ambiente (Postgres da VPS).
// Rode dentro do container do app:  docker exec forza-app node scripts/find-admin.js
const { PrismaClient } = require('@prisma/client')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida — rode dentro do container do app (VPS).')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log("=== USERS IN DATABASE ===")
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
