from pathlib import Path
from shutil import copyfile

from reportlab.lib.pagesizes import A2
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "evento-pirelli-banners"
OUTPUT = ROOT / "output" / "pdf" / "banner-principal-evento-pirelli-A2-300dpi.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "downloads" / "banner-principal-evento-pirelli-A2-300dpi.pdf"

POSTERS = (
    SOURCE / "banner-principal-evento-pirelli-A2-300dpi.jpg",
)


def main() -> None:
    missing = [str(path) for path in POSTERS if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Artes ausentes: {', '.join(missing)}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A2
    document = canvas.Canvas(str(OUTPUT), pagesize=A2, pageCompression=1)
    document.setTitle("Banner Principal Evento Pirelli - Forza Motos")
    document.setAuthor("Forza Motos")
    document.setSubject("Banner A2 com QR Code principal para o Rodeo Lucky Friends")

    for poster in POSTERS:
        document.drawImage(
            str(poster),
            0,
            0,
            width=width,
            height=height,
            preserveAspectRatio=False,
            mask="auto",
        )
        document.showPage()

    document.save()
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(OUTPUT)
    print(PUBLIC_OUTPUT)


if __name__ == "__main__":
    main()
