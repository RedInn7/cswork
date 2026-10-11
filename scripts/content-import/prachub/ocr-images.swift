// Prints the text macOS Vision reads in every image of a directory, one "file<TAB>text" line each.
//   swift scripts/content-import/prachub/ocr-images.swift ~/cswork-prachub/assets
// fetch-images.mjs uses it to drop images that carry the old site's logo or name.
import Foundation
import Vision

let dir = URL(fileURLWithPath: CommandLine.arguments[1])
let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
for file in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  let handler = VNImageRequestHandler(url: file, options: [:])
  try? handler.perform([request])
  let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
  print("\(file.lastPathComponent)\t\(text.replacingOccurrences(of: "\n", with: " "))")
}
