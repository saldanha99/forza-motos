const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_U9XBlqJo1pac@ep-rapid-unit-ac1bt18y.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
})

async function main() {
  const users = await prisma.user.findMany()
  console.log("=== USERS IN DATABASE ===")
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
