// Each page is rendered independently; layout never modifies the source PDF.
export function pageGroups(total, singlePage) {
  if (total < 1) return [];
  const groups = [[1]];
  for (let page = 2; page <= total; page += singlePage ? 1 : 2) {
    groups.push(!singlePage && page < total ? [page, page + 1] : [page]);
  }
  return groups;
}

export function mountPdfViewer({ triggers = [], url, loadDocument }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'project-gallery pdf-viewer';
  dialog.setAttribute('aria-labelledby', 'pdf-viewer-title');
  dialog.innerHTML = `
    <header class="gallery-header">
      <h2 id="pdf-viewer-title">ROUNDTABLE MATERIALS</h2>
      <button class="pdf-viewer-close" type="button" aria-label="Close PDF viewer">×</button>
    </header>
    <div class="pdf-viewer-stage" aria-busy="false">
      <div class="pdf-viewer-pages"></div>
      <p class="pdf-viewer-message" role="status" hidden></p>
    </div>
    <footer class="gallery-details">
      <div class="gallery-navigation">
        <button type="button" data-edge="first" aria-label="First page">|←</button>
        <button type="button" data-step="-1" aria-label="Previous page or spread">←</button>
        <span class="pdf-viewer-count gallery-count" aria-live="polite"></span>
        <button type="button" data-step="1" aria-label="Next page or spread">→</button>
        <button type="button" data-edge="last" aria-label="Last page">→|</button>
      </div>
      <div class="pdf-zoom" aria-label="Document zoom">
        <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
        <span class="pdf-zoom-value" aria-live="polite" title="Scale relative to Fit to viewer">100%</span>
        <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-zoom="fit" aria-label="Fit to viewer">FIT</button>
      </div>
      <a class="pdf-viewer-download" download target="_blank" rel="noopener noreferrer">DOWNLOAD PDF</a>
    </footer>
    <nav class="gallery-thumbnails pdf-thumbnails" aria-label="PDF pages"></nav>`;
  document.body.append(dialog);
  dialog.querySelector('.pdf-viewer-download').href = url;
  const stage = dialog.querySelector('.pdf-viewer-stage');
  const pages = dialog.querySelector('.pdf-viewer-pages');
  const message = dialog.querySelector('.pdf-viewer-message');
  const count = dialog.querySelector('.pdf-viewer-count');
  const previous = dialog.querySelector('[data-step="-1"]');
  const next = dialog.querySelector('[data-step="1"]');
  const first = dialog.querySelector('[data-edge="first"]');
  const last = dialog.querySelector('[data-edge="last"]');
  const zoomValue = dialog.querySelector('.pdf-zoom-value');
  const zoomOut = dialog.querySelector('[data-zoom="out"]');
  const zoomIn = dialog.querySelector('[data-zoom="in"]');
  let zoom = 1, zoomTimer;
  const touches = new Map();
  let pinch;
  const strip = dialog.querySelector('.pdf-thumbnails');
  const thumbs = [];
  let thumbnailsPromise;
  const pad = n => String(n).padStart(2, '0');
  const mobile = matchMedia('(max-width: 700px)');
  let pdf = null, groups = [], index = 0, version = 0, tasks = [], resizeFrame = 0;
  let returnFocus = null, oldOverflow = '';

  function cancelRender() {
    version++;
    tasks.forEach(task => task.cancel());
    tasks = [];
  }
  function controls() {
    const group = groups[index];
    previous.disabled = !pdf || !group || index === 0;
    next.disabled = !pdf || !group || index >= groups.length - 1;
    first.disabled = previous.disabled;
    last.disabled = next.disabled;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = !pdf || zoom <= .5;
    zoomIn.disabled = !pdf || zoom >= 4;
    count.textContent = pdf && group ? `${group.map(pad).join('–')} / ${pad(pdf.numPages)}` : '';
  }
  async function buildThumbnails() {
    for (let number = 1; number <= pdf.numPages; number++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Open PDF page ${number}`);
      button.textContent = pad(number);
      button.addEventListener('click', () => {
        goTo(groups.findIndex(group => group.includes(number)));
      });
      strip.append(button);
      thumbs.push(button);
    }
    updateThumbnails();
    for (let number = 1; number <= pdf.numPages; number++) {
      try {
        const page = await pdf.getPage(number);
        const box = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 144 / box.height });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute('aria-hidden', 'true');
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        thumbs[number - 1].replaceChildren(canvas);
      } catch { /* A numbered button remains usable if its thumbnail fails. */ }
    }
  }
  function updateThumbnails() {
    thumbs.forEach((button, i) => button.setAttribute('aria-current', String(groups[index]?.includes(i + 1) || false)));
    const selected = thumbs[(groups[index]?.[0] || 1) - 1];
    if (selected && dialog.open) strip.scrollTo({ left: selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2, behavior: 'instant' });
  }
  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }
  async function render(resetScroll = false) {
    if (!pdf || !dialog.open) return;
    cancelRender();
    const current = version;
    stage.setAttribute('aria-busy', 'true');
    const centerX = (stage.scrollLeft + stage.clientWidth / 2) / Math.max(1, stage.scrollWidth);
    const centerY = (stage.scrollTop + stage.clientHeight / 2) / Math.max(1, stage.scrollHeight);
    controls();
    updateThumbnails();
    showMessage('Loading pages…');
    try {
      const documents = await Promise.all(groups[index].map(number => pdf.getPage(number)));
      if (current !== version || !dialog.open) return;
      const boxes = documents.map(page => page.getViewport({ scale: 1 }));
      const gap = 16 * (boxes.length - 1);
      const pageHeight = Math.min(
        Math.max(1, stage.clientWidth - gap) / boxes.reduce((sum, box) => sum + box.width / box.height, 0),
        Math.max(1, stage.clientHeight)
      );
      // Keep canvas memory bounded even at high zoom; CSS dimensions remain full size.
      const ratio = Math.min(devicePixelRatio || 1, 2, 4096 / (pageHeight * zoom));
      const canvases = documents.map((page, i) => {
        const viewport = page.getViewport({ scale: pageHeight * zoom / boxes[i].height });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `PDF page ${groups[index][i]}`);
        canvas.textContent = `PDF page ${groups[index][i]}. Download the original PDF to access its text.`;
        tasks.push(page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }));
        return canvas;
      });
      await Promise.all(tasks.map(task => task.promise));
      if (current !== version || !dialog.open) return;
      pages.replaceChildren(...canvases);
      stage.scrollTo({ left: resetScroll ? 0 : centerX * stage.scrollWidth - stage.clientWidth / 2,
        top: resetScroll ? 0 : centerY * stage.scrollHeight - stage.clientHeight / 2, behavior: 'instant' });
      showMessage('');
    } catch (error) {
      if (current === version && error.name !== 'RenderingCancelledException') {
        console.error('PDF page render failed:', { url, pages: groups[index] }, error);
        showMessage('This page could not be displayed. You can download the original PDF below.');
      }
    } finally {
      if (current === version) stage.setAttribute('aria-busy', 'false');
    }
  }
  function navigate(step) {
    if (!pdf) return;
    const target = Math.max(0, Math.min(groups.length - 1, index + step));
    if (target !== index) goTo(target);
  }
  function goTo(target) {
    if (!pdf || target < 0 || target >= groups.length) return;
    clearTimeout(zoomTimer);
    index = target;
    render(true);
  }
  function setZoom(value, delayed = false) {
    if (!pdf || !dialog.open) return;
    zoom = Math.max(.5, Math.min(4, value));
    controls();
    clearTimeout(zoomTimer);
    cancelRender();
    if (delayed) zoomTimer = setTimeout(() => render(), 100);
    else render();
  }
  async function open() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('.pdf-viewer-close').focus({ preventScroll: true });
    index = 0;
    zoom = 1;
    controls();
    showMessage('Loading document…');
    try {
      pdf ||= await loadDocument(url);
      if (!dialog.open) return;
      groups = pageGroups(pdf.numPages, mobile.matches);
      render(true);
      thumbnailsPromise ||= buildThumbnails();
    } catch (error) {
      console.error('PDF document load failed:', { url }, error);
      showMessage('The PDF is not available yet. Please try again after the document has been added.');
      controls();
    }
  }
  triggers.forEach(trigger => trigger.addEventListener('click', open));
  previous.addEventListener('click', () => navigate(-1));
  next.addEventListener('click', () => navigate(1));
  first.addEventListener('click', () => goTo(0));
  last.addEventListener('click', () => goTo(groups.length - 1));
  zoomOut.addEventListener('click', () => setZoom(zoom - .25));
  zoomIn.addEventListener('click', () => setZoom(zoom + .25));
  dialog.querySelector('[data-zoom="fit"]').addEventListener('click', () => setZoom(1));
  stage.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setZoom(zoom * Math.exp(-event.deltaY * .002), true);
  }, { passive: false });
  // Touch panning and two-finger zoom stay inside the document, not the whole site.
  const distance = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    if (touches.size === 2) pinch = { distance: distance(), zoom };
  });
  stage.addEventListener('pointermove', event => {
    const previousPoint = touches.get(event.pointerId);
    if (!previousPoint) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2 && pinch?.distance > 0) setZoom(pinch.zoom * distance() / pinch.distance, true);
    else if (touches.size === 1) {
      stage.scrollLeft += previousPoint.x - event.clientX;
      stage.scrollTop += previousPoint.y - event.clientY;
    }
  });
  const endTouch = event => {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
  };
  stage.addEventListener('pointerup', endTouch);
  stage.addEventListener('pointercancel', endTouch);
  dialog.querySelector('.pdf-viewer-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      navigate(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  dialog.addEventListener('close', () => {
    clearTimeout(zoomTimer);
    touches.clear(); pinch = null;
    cancelRender();
    pages.replaceChildren();
    document.documentElement.style.overflow = oldOverflow;
    returnFocus?.focus({ preventScroll: true });
  });
  mobile.addEventListener('change', () => {
    if (!pdf) return;
    const currentPage = groups[index]?.[0] || 1;
    groups = pageGroups(pdf.numPages, mobile.matches);
    index = groups.findIndex(group => group.includes(currentPage));
    render();
  });
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => render());
  }).observe(stage);
  return { open };
}
