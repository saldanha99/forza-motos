/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build autocontido p/ rodar em Docker na VPS (node .next/standalone/server.js)
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.vercel-storage.com' },
      { protocol: 'https', hostname: '**.blob.vercel-storage.com' },
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
        'forza-motos-app.vercel.app',
        '*.vercel.app',
      ],
    },
  },
}

export default nextConfig
