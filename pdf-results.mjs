import { mountPdfViewer } from './pdf-viewer.mjs?v=20261025-reading1';

const url = new URL('assets/documents/delayed-recreation-architectural-heritage-chuhuiv-2026.pdf', document.baseURI).href;
let documentPromise;
function loadDocument() {
  // Preview and overlay share one local renderer and one loaded document.
  return documentPromise ||= (async () => {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const resource = folder => new URL(`./vendor/pdfjs/${folder}/`, import.meta.url).href;
    return pdfjs.getDocument({ url, cMapUrl: resource('cmaps'), cMapPacked: true,
      standardFontDataUrl: resource('standard_fonts'), wasmUrl: resource('wasm'),
      isEvalSupported: false }).promise;
  })().catch(error => { documentPromise = null; throw error; });
}

let viewer;
let coverPromise;

// One low-resolution render shared by both previews; the full viewer renders separately.
export async function createRoundtableCover(maxHeight = 560) {
  coverPromise ||= (async () => {
    const pdf = await loadDocument();
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 560 / original.height });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  })().catch(error => { coverPromise = null; throw error; });
  const source = await coverPromise;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxHeight / source.height);
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Roundtable Materials — PDF page 1');
  return canvas;
}

export function openRoundtablePdf() {
  viewer ||= mountPdfViewer({ url, loadDocument });
  return viewer.open();
}
