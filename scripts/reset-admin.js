// Reseta a senha do admin. Usa DATABASE_URL do ambiente (Postgres da VPS).
// Rode dentro do container do app, passando a nova senha por variável:
//   docker exec -e ADMIN_NEW_PASSWORD='senhaForte' forza-app node scripts/reset-admin.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida — rode dentro do container do app (VPS).')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'adm.ml@forzamotos.com.br'
  const password = process.env.ADMIN_NEW_PASSWORD
  if (!password) {
    console.error('Defina ADMIN_NEW_PASSWORD com a nova senha antes de rodar.')
    process.exit(1)
  }
  const hashedPassword = await bcrypt.hash(password, 12)

  console.log(`Resetting admin password for ${email}...`)

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { senha: hashedPassword }
  })

  console.log('Admin password updated successfully!')
  console.log(`Email: ${updatedUser.email}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
