const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_U9XBlqJo1pac@ep-rapid-unit-ac1bt18y.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
})

async function main() {
  const email = 'adm.ml@forzamotos.com.br'
  const password = 'admin123'
  const hashedPassword = await bcrypt.hash(password, 12)

  console.log(`Resetting admin password for ${email}...`)

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { senha: hashedPassword }
  })

  console.log('Admin password updated successfully!')
  console.log(`Email: ${updatedUser.email}`)
  console.log(`New password: ${password}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
