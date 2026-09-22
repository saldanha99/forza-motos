import Foundation
import ImageIO
import Vision

let imagePaths = CommandLine.arguments.dropFirst()

guard !imagePaths.isEmpty else {
    fputs("Informe pelo menos uma imagem.\n", stderr)
    exit(2)
}

var foundError = false

for imagePath in imagePaths {
    let url = URL(fileURLWithPath: imagePath)
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        fputs("ERRO\t\(imagePath)\timagem_invalida\n", stderr)
        foundError = true
        continue
    }

    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]

    do {
        try VNImageRequestHandler(cgImage: image, orientation: .up).perform([request])
        let payloads = request.results?.compactMap(\.payloadStringValue) ?? []
        if payloads.isEmpty {
            fputs("ERRO\t\(imagePath)\tqr_nao_detectado\n", stderr)
            foundError = true
        } else {
            for payload in payloads {
                print("OK\t\(imagePath)\t\(payload)")
            }
        }
    } catch {
        fputs("ERRO\t\(imagePath)\t\(error.localizedDescription)\n", stderr)
        foundError = true
    }
}

exit(foundError ? 1 : 0)
