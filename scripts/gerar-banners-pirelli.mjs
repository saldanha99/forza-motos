import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import QRCode from 'qrcode'

sharp.cache(false)
sharp.concurrency(1)

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'output/evento-pirelli-banners')
const W = 2480
const H = 3508
const PRINT_W = 4961
const PRINT_H = 7016
const AMBER = '#F6B632'
const RED = '#DC252B'
const WHITE = '#FFFFFF'
const MUTED = '#C7C7C7'

const urls = {
  principal: 'https://www.forzamotos.com.br/evento-pirelli?utm_source=qr_evento_pirelli&utm_medium=offline&utm_campaign=rodeo_lucky_friends&utm_content=principal',
}

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

async function fileData(relative, mime) {
  const buffer = await fs.readFile(path.join(ROOT, relative))
  return `data:${mime};base64,${buffer.toString('base64')}`
}

async function rasterPngData(relative) {
  const buffer = await sharp(path.join(ROOT, relative))
    .png()
    .toBuffer()
  return `data:image/png;base64,${buffer.toString('base64')}`
}

async function trimmedForzaData() {
  const buffer = await sharp(path.join(ROOT, 'public/images/logo-forza.png'))
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function textLines(lines, options) {
  const {
    x, y, size, lineHeight = size * 0.9, color = WHITE,
    family = 'DIN Condensed', weight = 700, anchor = 'start',
    letterSpacing = 0, italic = false,
  } = options
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}, Arial Narrow, Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}"${italic ? ' font-style="italic"' : ''}>${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${esc(line)}</tspan>`).join('')}</text>`
}

function bodyLines(lines, x, y, size = 48, lineHeight = 66, color = MUTED, weight = 400) {
  return textLines(lines, { x, y, size, lineHeight, color, family: 'Arial', weight })
}

function badge(text, x, y, width, color = AMBER) {
  return `<g><rect x="${x}" y="${y}" width="${width}" height="76" rx="18" fill="${color}"/><text x="${x + width / 2}" y="${y + 53}" fill="#080808" font-family="Arial, sans-serif" font-size="36" font-weight="800" text-anchor="middle" letter-spacing="2">${esc(text)}</text></g>`
}

function commonDefs(id) {
  return `<defs>
    <linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#09090A" stop-opacity="0.05"/><stop offset="0.72" stop-color="#09090A" stop-opacity="0.2"/><stop offset="1" stop-color="#09090A" stop-opacity="0.96"/></linearGradient>
    <linearGradient id="gold-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD86A"/><stop offset="1" stop-color="#E89612"/></linearGradient>
    <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity="0.7"/></filter>
    <clipPath id="hero-${id}"><rect x="120" y="790" width="2240" height="1240" rx="62"/></clipPath>
    <style>
      .heading { font-family: 'DIN Condensed', 'Arial Narrow', Arial, sans-serif; font-weight: 700; }
      .body { font-family: Arial, sans-serif; }
    </style>
  </defs>`
}

function commonBase(id, bgData, number, label) {
  return `<image href="${bgData}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${W}" height="${H}" fill="#050506" opacity="0.18"/>
  <rect x="28" y="28" width="2424" height="3452" rx="18" fill="none" stroke="${RED}" stroke-width="12"/>
  <rect x="56" y="56" width="2368" height="3396" rx="12" fill="none" stroke="#FFFFFF" stroke-opacity="0.34" stroke-width="3"/>
  <g transform="translate(130 112)">
    <rect width="88" height="62" rx="12" fill="${RED}"/>
    <text x="44" y="45" fill="#fff" class="heading" font-size="42" text-anchor="middle">0${number}</text>
    <text x="114" y="43" fill="#DADADA" class="body" font-size="30" font-weight="700" letter-spacing="4">${esc(label)}</text>
  </g>
  <text x="2350" y="150" fill="#AAAAAA" class="body" font-size="28" font-weight="700" text-anchor="end" letter-spacing="2">RODEO LUCKY FRIENDS</text>`
}

function footer(assets) {
  return `<g>
    <line x1="130" y1="3230" x2="2350" y2="3230" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="3"/>
    <g transform="translate(130 3262)">
      <rect width="330" height="130" rx="22" fill="#FFFFFF"/>
      <image href="${assets.forza}" x="47" y="13" width="236" height="104" preserveAspectRatio="xMidYMid meet"/>
    </g>
    <g transform="translate(500 3262)">
      <rect width="330" height="130" rx="22" fill="#FFD321"/>
      <image href="${assets.pirelli}" x="48" y="35" width="234" height="60" preserveAspectRatio="xMidYMid meet"/>
    </g>
    <g transform="translate(870 3262)">
      <rect width="440" height="130" rx="22" fill="#FFFFFF"/>
      <image href="${assets.metzeler}" x="36" y="24" width="368" height="82" preserveAspectRatio="xMidYMid meet"/>
    </g>
    <g transform="translate(1350 3262)">
      <rect width="360" height="130" rx="22" fill="#18181B" stroke="#FFFFFF" stroke-opacity="0.32" stroke-width="3"/>
      <text x="180" y="81" fill="#FFFFFF" class="heading" font-size="57" text-anchor="middle" letter-spacing="2">CAMPNEUS</text>
    </g>
    <text x="2350" y="3314" fill="${AMBER}" class="heading" font-size="40" text-anchor="end">5 E 6 DE SETEMBRO DE 2026</text>
    <text x="2350" y="3368" fill="#C8C8C8" class="body" font-size="27" text-anchor="end">LUCKY FRIENDS ARENA | SOROCABA/SP</text>
    <text x="2350" y="3413" fill="#8E8E8E" class="body" font-size="24" text-anchor="end">PIRELLI + METZELER + FORZA MOTOS + CAMPNEUS</text>
  </g>`
}

function qrCard({ qrData, label, shortUrl, x = 1475, y = 2190 }) {
  const cardW = 850
  const cardH = 980
  const qrSize = 750
  return `<g filter="url(#shadow-qr)">
    <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="42" fill="#FFFFFF"/>
    <rect x="${x + 28}" y="${y + 28}" width="${cardW - 56}" height="100" rx="22" fill="${AMBER}"/>
    <text x="${x + cardW / 2}" y="${y + 96}" fill="#080808" class="heading" font-size="48" text-anchor="middle">${esc(label)}</text>
    <image href="${qrData}" x="${x + 50}" y="${y + 145}" width="${qrSize}" height="${qrSize}"/>
    <text x="${x + cardW / 2}" y="${y + 950}" fill="#303030" class="body" font-size="25" font-weight="700" text-anchor="middle">${esc(shortUrl)}</text>
  </g>`
}

function qrShadowDef() {
  return `<defs><filter id="shadow-qr" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#000" flood-opacity="0.8"/></filter></defs>`
}

function poster1(assets, qrs) {
  const id = 'quiz'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${commonDefs(id)}${qrShadowDef()}${commonBase(id, assets.bg, 3, 'QUIZ CRONOMETRADO')}
    ${textLines(['ENTENDE DE PNEU?'], { x: 130, y: 350, size: 190, lineHeight: 175, color: WHITE })}
    ${textLines(['ACERTE TUDO. SEJA O MAIS RÁPIDO.'], { x: 130, y: 540, size: 145, color: AMBER })}
    ${bodyLines(['PERGUNTAS E ALTERNATIVAS EM ORDEM ALEATÓRIA.', 'O MENOR TEMPO ENTRE OS ACERTOS PERFEITOS GANHA.'], 136, 650, 42, 58, '#E8E8E8', 700)}
    <g clip-path="url(#hero-${id})">
      <image href="${assets.rodeo}" x="120" y="790" width="2240" height="1240" preserveAspectRatio="xMidYMid slice"/>
      <rect x="120" y="790" width="2240" height="1240" fill="url(#fade-${id})"/>
      <rect x="120" y="790" width="2240" height="1240" fill="#000" opacity="0.1"/>
    </g>
    <g transform="translate(180 1570)">
      ${badge('1 CADASTRO', 0, 0, 350)}
      ${badge('ORDEM ALEATÓRIA', 380, 0, 480, '#FFFFFF')}
      ${badge('MENOR TEMPO', 890, 0, 410)}
    </g>
    <g transform="translate(150 2120)">
      <rect width="1240" height="360" rx="34" fill="#111114" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/>
      <text x="48" y="75" fill="${AMBER}" class="heading" font-size="62">QUIZ PERFEITO</text>
      ${bodyLines(['Acerte todas as perguntas para entrar', 'no ranking oficial da caneca.'], 48, 140, 42, 58, WHITE, 700)}
      <text x="48" y="292" fill="${AMBER}" class="heading" font-size="56">O MENOR TEMPO VENCE</text>
    </g>
    ${bodyLines(['O cronômetro começa ao abrir as perguntas.', 'Responda com atenção: cada participante', 'tem uma única tentativa oficial.'], 160, 2585, 36, 52, '#E2E2E2', 600)}
    ${qrCard({ qrData: qrs.quiz, label: 'ESCANEIE E PARTICIPE', shortUrl: 'forzamotos.com.br/evento-pirelli' })}
    <text x="150" y="3060" fill="#B7B7B7" class="body" font-size="25"><tspan x="150">É preciso acertar todas as perguntas para concorrer.</tspan><tspan x="150" dy="38">Em empate exato, vence quem concluiu primeiro.</tspan></text>
    ${footer(assets)}
  </svg>`
}

function poster2(assets, qrs) {
  const id = 'balanceamento'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${commonDefs(id)}${qrShadowDef()}${commonBase(id, assets.bg, 4, 'BALANCEAMENTO')}
    ${textLines(['VOCÊ SABE'], { x: 130, y: 390, size: 195, color: WHITE })}
    ${textLines(['BALANCEAR UMA RODA?'], { x: 130, y: 580, size: 195, color: AMBER })}
    ${bodyLines(['VEJA NA PRÁTICA COMO IDENTIFICAR', 'E CORRIGIR O DESEQUILÍBRIO.'], 136, 690, 42, 56, '#E8E8E8', 700)}
    <g clip-path="url(#hero-${id})">
      <image href="${assets.servicos}" x="120" y="790" width="2240" height="1240" preserveAspectRatio="xMidYMid slice"/>
      <rect x="120" y="790" width="2240" height="1240" fill="url(#fade-${id})"/>
    </g>
    <g transform="translate(165 1460)">
      <rect width="1030" height="390" rx="36" fill="#0A0A0C" fill-opacity="0.9" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/>
      <text x="54" y="95" fill="${AMBER}" class="heading" font-size="76">PARTICIPE DA EXPERIÊNCIA</text>
      ${bodyLines(['Cadastre-se, escolha o melhor período', 'e acompanhe a demonstração com a equipe.'], 56, 175, 42, 62, WHITE, 600)}
    </g>
    ${textLines(['CONHECIMENTO QUE FAZ', 'DIFERENÇA NA ESTRADA.'], { x: 150, y: 2260, size: 104, lineHeight: 96, color: WHITE })}
    ${bodyLines(['Demonstração de balanceamento estático.', 'Não inclui alinhamento, montagem do pneu', 'ou balanceamento dinâmico.'], 158, 2535, 39, 56, '#D5D5D5', 500)}
    ${qrCard({ qrData: qrs.balanceamento, label: 'ESCANEIE E PARTICIPE', shortUrl: 'forzamotos.com.br/evento-pirelli' })}
    <text x="150" y="3070" fill="#AFAFAF" class="body" font-size="25">Participação organizada conforme a movimentação e capacidade do estande.</text>
    ${footer(assets)}
  </svg>`
}

function poster3(assets, qrs) {
  const id = 'caneca'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${commonDefs(id)}${qrShadowDef()}${commonBase(id, assets.bg, 1, 'CANECA PERSONALIZADA')}
    ${textLines(['COMPRE SUA CANECA'], { x: 130, y: 350, size: 195, color: WHITE })}
    ${textLines(['COM O SEU NOME'], { x: 130, y: 540, size: 195, color: AMBER })}
    <g clip-path="url(#hero-${id})">
      <image href="${assets.caneca}" x="120" y="790" width="2240" height="1240" preserveAspectRatio="xMidYMid slice"/>
      <rect x="120" y="790" width="2240" height="1240" fill="url(#fade-${id})"/>
    </g>
    <g transform="translate(150 925)">
      <rect width="1120" height="590" rx="42" fill="#09090B" fill-opacity="0.92" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="3"/>
      <text x="58" y="96" fill="#FFFFFF" class="heading" font-size="63">CANECA AVULSA PERSONALIZADA</text>
      <text x="58" y="196" fill="${AMBER}" class="heading" font-size="104">R$ 89,00</text>
      ${bodyLines(['FAÇA O CADASTRO PRIMEIRO.', 'ESCOLHA O NOME SÓ NA COMPRA.'], 60, 278, 50, 68, WHITE, 800)}
      <line x1="58" y1="430" x2="1058" y2="430" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/>
      <text x="58" y="516" fill="#FFFFFF" class="heading" font-size="54">PAGAMENTO SEGURO PELO MERCADO PAGO</text>
    </g>
    ${textLines(['COMPRE AGORA.'], { x: 150, y: 2250, size: 112, color: WHITE })}
    ${textLines(['PERSONALIZE NO EVENTO.'], { x: 150, y: 2350, size: 112, color: AMBER })}
    ${bodyLines(['Seu pedido fica vinculado ao QR individual.', 'O nome da gravação é informado somente', 'depois que o cadastro estiver concluído.'], 158, 2480, 39, 56, '#DADADA', 600)}
    ${qrCard({ qrData: qrs.caneca, label: 'ESCANEIE PARA COMPRAR', shortUrl: 'forzamotos.com.br/evento-pirelli/caneca' })}
    <text x="150" y="3000" fill="#B7B7B7" class="body" font-size="24"><tspan x="150">Compra exclusiva da caneca personalizada.</tspan><tspan x="150" dy="36">Pedido pago, vinculado ao QR e sujeito à disponibilidade. Gravação no estande.</tspan></text>
    ${footer(assets)}
  </svg>`
}

function laptopMock(assets) {
  return `<g filter="url(#shadow-ofertas)">
    <rect x="220" y="845" width="2040" height="1030" rx="58" fill="#BFC3C7"/>
    <rect x="258" y="885" width="1964" height="930" rx="32" fill="#09090B"/>
    <clipPath id="laptop-screen"><rect x="275" y="902" width="1930" height="896" rx="22"/></clipPath>
    <g clip-path="url(#laptop-screen)">
      <image href="${assets.rodeo}" x="275" y="902" width="1930" height="896" preserveAspectRatio="xMidYMid slice"/>
      <rect x="275" y="902" width="1930" height="896" fill="#000" opacity="0.48"/>
      <rect x="275" y="902" width="1930" height="115" fill="#FFFFFF"/>
      <image href="${assets.forza}" x="320" y="918" width="180" height="82" preserveAspectRatio="xMidYMid meet"/>
      <rect x="520" y="940" width="950" height="42" rx="21" fill="#EEEEEE"/>
      <text x="1240" y="1280" fill="#FFFFFF" class="heading" font-size="120" text-anchor="middle">OFERTAS PIRELLI</text>
      <text x="1240" y="1395" fill="${AMBER}" class="heading" font-size="82" text-anchor="middle">CONDIÇÕES EXCLUSIVAS</text>
      <rect x="970" y="1485" width="540" height="105" rx="28" fill="${RED}"/>
      <text x="1240" y="1559" fill="#FFFFFF" class="heading" font-size="51" text-anchor="middle">COMPRE AGORA</text>
    </g>
    <path d="M110 1875 H2370 L2220 2075 H260 Z" fill="#D8DBDE"/>
    <rect x="950" y="1895" width="580" height="42" rx="21" fill="#A3A7AB"/>
  </g>`
}

function poster4(assets, qrs) {
  const id = 'ofertas'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${commonDefs(id)}${qrShadowDef()}<defs><filter id="shadow-ofertas" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#000" flood-opacity="0.85"/></filter></defs>${commonBase(id, assets.bg, 2, 'GANHE NAS COMPRAS')}
    ${textLines(['COMPRE PNEUS'], { x: 130, y: 420, size: 205, color: WHITE })}
    ${textLines(['GANHE A CANECA'], { x: 130, y: 620, size: 210, color: AMBER })}
    ${bodyLines(['ACIMA DE R$ 899 EM PNEUS PARTICIPANTES.'], 136, 735, 48, 60, '#F0F0F0', 800)}
    ${laptopMock(assets)}
    ${textLines(['VITRINE EXCLUSIVA', 'DO EVENTO.'], { x: 150, y: 2250, size: 103, lineHeight: 94, color: WHITE })}
    ${bodyLines(['Faça o cadastro e escolha seus pneus.', 'Quando a compra qualificar, informe o nome', 'da caneca diretamente no checkout.'], 158, 2500, 40, 58, '#DADADA', 600)}
    ${qrCard({ qrData: qrs.ofertas, label: 'ESCANEIE E VEJA AS OFERTAS', shortUrl: 'forzamotos.com.br/evento-pirelli' })}
    <text x="150" y="3050" fill="#B7B7B7" class="body" font-size="24"><tspan x="150">*Subtotal de pneus superior a R$ 899. R$ 899,00 exatos não qualificam.</tspan><tspan x="150" dy="36">Produtos não são entregues no estande. Consulte prazos e condições no checkout.</tspan></text>
    ${footer(assets)}
  </svg>`
}

function posterPrincipal(assets, qrs) {
  const id = 'principal'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${commonDefs(id)}${qrShadowDef()}${commonBase(id, assets.bg, 1, 'UMA LANDING. TODAS AS EXPERIÊNCIAS')}
    ${textLines(['ESCANEIE. ESCOLHA.'], { x: 130, y: 385, size: 205, color: WHITE })}
    ${textLines(['VIVA A EXPERIÊNCIA.'], { x: 130, y: 585, size: 205, color: AMBER })}
    ${bodyLines(['UM ÚNICO QR CODE LEVA VOCÊ A TODAS AS AÇÕES', 'PIRELLI + FORZA MOTOS NO RODEO LUCKY FRIENDS.'], 136, 700, 43, 58, '#EEEEEE', 700)}
    <g clip-path="url(#hero-${id})">
      <image href="${assets.rodeo}" x="120" y="790" width="2240" height="1240" preserveAspectRatio="xMidYMid slice"/>
      <rect x="120" y="790" width="2240" height="1240" fill="url(#fade-${id})"/>
      <rect x="120" y="790" width="2240" height="1240" fill="#000" opacity="0.12"/>
    </g>
    <g transform="translate(160 1430)">
      <rect width="1290" height="510" rx="40" fill="#09090B" fill-opacity="0.92" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/>
      <text x="54" y="86" fill="${AMBER}" class="heading" font-size="62">VOCÊ DECIDE POR ONDE COMEÇAR</text>
      <g class="body" font-size="39" font-weight="700" fill="#FFFFFF">
        <text x="58" y="180"><tspan fill="${AMBER}">01</tspan><tspan dx="24">CANECA PERSONALIZADA</tspan></text>
        <text x="58" y="262"><tspan fill="${AMBER}">02</tspan><tspan dx="24">PRODUTOS E OFERTAS</tspan></text>
        <text x="58" y="344"><tspan fill="${AMBER}">03</tspan><tspan dx="24">QUIZ CRONOMETRADO</tspan></text>
        <text x="58" y="426"><tspan fill="${AMBER}">04</tspan><tspan dx="24">BALANCEAMENTO NA PRÁTICA</tspan></text>
      </g>
    </g>
    ${textLines(['UM QR CODE.', 'QUATRO CAMINHOS.'], { x: 150, y: 2250, size: 112, lineHeight: 105, color: WHITE })}
    ${bodyLines(['Abra a landing page, escolha sua ação', 'e faça um único cadastro quando necessário.'], 158, 2505, 39, 57, '#DADADA', 600)}
    ${qrCard({ qrData: qrs.principal, label: 'ESCANEIE E ESCOLHA', shortUrl: 'forzamotos.com.br/evento-pirelli' })}
    <text x="150" y="3015" fill="#B7B7B7" class="body" font-size="25"><tspan x="150">Aponte a câmera do celular para o QR Code.</tspan><tspan x="150" dy="38">Nenhum aplicativo adicional é necessário.</tspan></text>
    ${footer(assets)}
  </svg>`
}

async function qrAssets() {
  const result = {}
  const publicDownloads = path.join(ROOT, 'public/downloads')
  await fs.mkdir(publicDownloads, { recursive: true })
  for (const [key, url] of Object.entries(urls)) {
    const png = await QRCode.toBuffer(url, {
      type: 'png',
      width: 1800,
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: '#050505', light: '#FFFFFFFF' },
    })
    result[key] = `data:image/png;base64,${png.toString('base64')}`
    await fs.writeFile(path.join(OUT, `qr-${key}.png`), png)
    await fs.writeFile(path.join(publicDownloads, `qr-code-evento-pirelli-${key}.png`), png)
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: '#050505', light: '#FFFFFFFF' },
    })
    await fs.writeFile(path.join(OUT, `qr-${key}.svg`), svg)
    await fs.writeFile(path.join(publicDownloads, `qr-code-evento-pirelli-${key}.svg`), svg)
  }
  await fs.writeFile(path.join(OUT, 'destinos-qr.json'), JSON.stringify(urls, null, 2))
  return result
}

async function renderPoster(filename, svg) {
  const svgPath = path.join(OUT, `${filename}.svg`)
  const pngPath = path.join(OUT, `${filename}-A2-300dpi.png`)
  const jpegPath = path.join(OUT, `${filename}-A2-300dpi.jpg`)
  const previewPath = path.join(OUT, `${filename}-preview.jpg`)
  await fs.writeFile(svgPath, svg)
  const source = Buffer.from(svg)
  await sharp(source, { density: 96 })
    .resize(1240, 1754, { fit: 'fill' })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toFile(previewPath)
  await sharp(source, { density: 144, limitInputPixels: false })
    .resize(PRINT_W, PRINT_H, { fit: 'fill' })
    .png({ compressionLevel: 8 })
    .withMetadata({ density: 300 })
    .toFile(pngPath)
  await sharp(source, { density: 144, limitInputPixels: false })
    .resize(PRINT_W, PRINT_H, { fit: 'fill' })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true })
    .withMetadata({ density: 300 })
    .toFile(jpegPath)
  global.gc?.()
  console.log(`rendered ${filename}`)
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const assets = {
    bg: await fileData('output/evento-pirelli-banners/fundo-motorsport-gerado.png', 'image/png'),
    forza: await trimmedForzaData(),
    pirelli: await fileData('public/images/brands/pirelli.svg', 'image/svg+xml'),
    metzeler: await fileData('public/images/brands/metzeler.svg', 'image/svg+xml'),
    rodeo: await rasterPngData('public/images/evento-pirelli/rodeo-hero.webp'),
    caneca: await rasterPngData('public/images/evento-pirelli/caneca-premium.webp'),
    servicos: await fileData('public/images/hero/slide-servicos.jpg', 'image/jpeg'),
  }
  const qrs = await qrAssets()
  const definitions = [
    ['banner-principal-evento-pirelli', posterPrincipal],
  ]
  const requested = process.argv[2]
  const selected = requested
    ? definitions.filter(([filename]) => filename === requested)
    : definitions
  if (!selected.length) throw new Error(`Banner desconhecido: ${requested}`)
  for (const [filename, factory] of selected) {
    await renderPoster(filename, factory(assets, qrs))
  }
  console.log(JSON.stringify({ output: OUT, posters: selected.map(([name]) => name), urls }, null, 2))
}

await main()
