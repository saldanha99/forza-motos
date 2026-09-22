/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build autocontido p/ rodar em Docker na VPS (node .next/standalone/server.js)
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      // Imagens de produto servidas pela própria VPS (nginx em /imagens)
      { protocol: 'https', hostname: 'www.forzamotos.com.br' },
      { protocol: 'https', hostname: 'forzamotos.com.br' },
      { protocol: 'https', hostname: 'olist.com' },
      { protocol: 'https', hostname: '**.olist.com' },
      // Tiny ERP CDN domains
      { protocol: 'https', hostname: 'tiny.com.br' },
      { protocol: 'https', hostname: '**.tiny.com.br' },
      { protocol: 'https', hostname: 'cdn.tiny.com.br' },
      { protocol: 'https', hostname: '**.cdn.tiny.com.br' },
      // Fallback: imagens de fornecedores dropship
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'forzamotos.com.br',
        'www.forzamotos.com.br',
      ],
    },
  },
}

export default nextConfig
