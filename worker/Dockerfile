# Forza Sync Worker — imagem mínima Node 20 + Prisma
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm install prisma --no-save

# schema.prisma é copiado do app principal no build (ver worker/build.sh)
COPY schema.prisma ./
RUN npx prisma generate

COPY worker.js ./

CMD ["node", "worker.js"]
