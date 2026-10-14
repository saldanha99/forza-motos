import { IconeCategoria, type IdCategoria } from './IconeCategoria'

/**
 * Arte de fundo desenhada, para o lugar de uma foto que a loja ainda não
 * enviou em /admin/marketing.
 *
 * Existe porque as fotos de catálogo do site eram geradas por IA e saíram a
 * pedido do cliente. Em vez de deixar um buraco cinza, o bloco ganha a arte da
 * marca — grafite + vermelho, listras diagonais e o ícone da categoria em
 * marca d'água. Assim que o admin envia a foto de verdade, ela cobre isto.
 *
 * Preenche o elemento posicionado que o envolve (`position: relative`).
 */
export function ArteSlot({
  icone,
  cor = '#d42b2b',
  rotulo,
  vinheta = true,
  className = '',
}: {
  /** Ícone em marca d'água — sem ícone, fica só o fundo */
  icone?: IdCategoria
  /** Cor de acento do bloco (as categorias têm a sua) */
  cor?: string
  /** Texto discreto no canto, quando ajuda a situar o bloco */
  rotulo?: string
  /** Escurecimento de baixo para cima — desligue onde a página já tem o seu */
  vinheta?: boolean
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        background: `
          radial-gradient(125% 115% at 14% 0%, ${cor}33 0%, transparent 58%),
          linear-gradient(158deg, #1b1b20 0%, #101014 55%, #050506 100%)`,
      }}
    >
      {/* Listras diagonais — a textura de velocidade da marca */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.1,
          backgroundImage: `repeating-linear-gradient(118deg, ${cor} 0 2px, transparent 2px 15px)`,
        }}
      />

      {/* Marca d'água */}
      {icone && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ opacity: 0.22, transform: 'scale(1)' }}>
            <IconeCategoria id={icone} cor="#ffffff" tamanho={132} />
          </div>
        </div>
      )}

      {rotulo && (
        <span
          className="absolute top-3 left-3 font-barlow font-bold uppercase"
          style={{ fontSize: 10, letterSpacing: 1.6, color: 'rgba(255,255,255,0.4)' }}
        >
          {rotulo}
        </span>
      )}

      {/* Vinheta: segura o texto branco que entra por cima */}
      {vinheta && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 55%, transparent 100%)' }}
        />
      )}
    </div>
  )
}
