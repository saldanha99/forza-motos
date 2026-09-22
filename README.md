# Forza Motos

Loja, painel administrativo e integrações da Forza Motos (Sorocaba/SP) — Next.js 16 (App Router), TypeScript, Tailwind, Prisma e PostgreSQL.

## Onde isso roda

Tudo na VPS própria (`/opt/forza`), em Docker: app Next.js em modo `standalone`, PostgreSQL (`forza-db`), worker de sincronização com o Olist, nginx das imagens (`/imagens`) e Traefik na frente. **Não há nada em Vercel, Neon ou storage gerenciado** — imagens ficam no volume `/imagens` e o banco é o PostgreSQL da própria VPS.

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:3000
```

Copie `.env.example` para `.env.local` e preencha. O banco local é um PostgreSQL local — nunca aponte a `DATABASE_URL` de desenvolvimento para a produção.

## Deploy

```bash
./deploy.sh          # app
./deploy.sh worker   # app + worker de sync
```

`git push` **não** faz deploy: ele só versiona. O `deploy.sh` faz rsync do working tree para a VPS, builda a imagem, testa as migrations contra uma cópia do banco, tira backup e só então aplica `prisma migrate deploy` e sobe o container.

## Testes

```bash
npm run test:security   # suíte de checkout, eventos, logística e Pirelli
npm run lint
npm run verificar        # fronteira server/client e tema do painel admin
```
