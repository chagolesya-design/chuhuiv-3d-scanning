(() => {
  // Add results here; navigation and the counter derive from this collection.
  const results = [
    { id: 'documentation', type: '3d', title: 'DIGITAL DOCUMENTATION',
      description: 'Point cloud · 3D model · Orthophotos', placeholder: '3D / POINT CLOUD' },
    { id: 'roundtable', type: 'pdf', title: 'ROUNDTABLE MATERIALS',
      description: 'Delayed Re-creation of Architectural Heritage', placeholder: 'ROUNDTABLE MATERIALS / PDF' },
    { id: 'declaration', type: 'pdf', title: 'CHUHUIV DECLARATION',
      description: 'Chuhuiv Declaration of Delayed Re-creation', placeholder: 'CHUHUIV DECLARATION / PDF' },
    { id: 'gallery', type: 'gallery', title: 'PROJECT GALLERY',
      description: 'Fieldwork · 3D scanning · Documentation', placeholder: 'PROJECT GALLERY',
      get preview() { return projectGalleryPhotos[0]; } },
  ];
  const viewer = document.querySelector('#results .results-content');
  if (!viewer) return;
  const title = viewer.querySelector('#result-title');
  const description = viewer.querySelector('#result-description');
  const summary = viewer.querySelector('.result-summary');
  const stage = viewer.querySelector('.result-preview');
  const counter = viewer.querySelector('.result-counter');
  const gallery = createProjectGallery();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pdfModuleUrl = new URL('./pdf-results.mjs?v=20261025-reading1', document.baseURI).href;
  async function mountCover(host, small = false) {
    try {
      const { createRoundtableCover } = await import(pdfModuleUrl);
      const canvas = await createRoundtableCover(small ? 280 : 560);
      // A result may have changed while PDF.js was rendering.
      if (host.isConnected) host.replaceChildren(canvas);
    } catch (error) {
      console.error('Roundtable PDF cover render failed:', error);
    }
  }
  let index = 0;
  let dispose = () => {};
  const upcoming = viewer.querySelector('.results-secondary');
  // Keep these controls mounted so keyboard focus survives slide changes.
  const previews = [1, 2].map(offset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-teaser';
    button.innerHTML = '<span class="result-teaser-media" aria-hidden="true"></span><span class="result-teaser-title"></span><span class="result-teaser-description"></span>';
    button.addEventListener('click', () => show(index + offset));
    upcoming.append(button);
    return { button, offset };
  });

  function placeholder(result, target) {
    const label = document.createElement('span');
    label.className = 'result-preview-label';
    label.textContent = result.placeholder;
    const status = document.createElement('span');
    status.className = 'result-preview-status';
    status.textContent = 'PREVIEW TO FOLLOW';
    target.replaceChildren(label, status);
    return () => {};
  }
  // Future renderers mount within the same stage and return a cleanup function.
  function galleryPreview(result, target) {
    placeholder(result, target);
    target.querySelector('.result-preview-status').textContent = 'OPEN GALLERY';
    if (result.preview?.src) {
      const image = document.createElement('img');
      image.className = 'result-gallery-cover';
      image.src = result.preview.src;
      image.alt = result.preview.alt || '';
      image.draggable = false;
      target.querySelector('.result-preview-label').replaceWith(image);
    }
    const open = () => gallery.open(target);
    const activate = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    };
    target.setAttribute('role', 'button');
    target.removeAttribute('aria-roledescription');
    target.setAttribute('aria-haspopup', 'dialog');
    target.setAttribute('aria-label', 'Open project gallery');
    target.classList.add('gallery-trigger');
    target.addEventListener('click', open);
    target.addEventListener('keydown', activate);
    return () => {
      target.removeEventListener('click', open);
      target.removeEventListener('keydown', activate);
      target.classList.remove('gallery-trigger');
      target.setAttribute('role', 'group');
      target.setAttribute('aria-roledescription', 'slide');
      target.removeAttribute('aria-haspopup');
    };
  }
  function pdfPreview(result, target) {
    if (result.id !== 'roundtable') return placeholder(result, target);
    placeholder(result, target);
    const status = target.querySelector('.result-preview-status');
    status.textContent = 'OPEN PDF';
    const cover = document.createElement('span');
    cover.className = 'result-pdf-cover';
    target.querySelector('.result-preview-label').replaceWith(cover);
    mountCover(cover);
    let loading = false, disposed = false;
    const open = async () => {
      if (loading) return;
      loading = true;
      let phase = 'import viewer module';
      try {
        delete target.dataset.pdfError;
        // Embedded browsers may give classic scripts an about:blank import base.
        // Resolve against the page explicitly before handing the URL to import().
        const { openRoundtablePdf } = await import(pdfModuleUrl);
        phase = 'initialize and open viewer';
        if (!disposed) await openRoundtablePdf();
      } catch (error) {
        console.error(`Roundtable PDF: ${phase}`, error);
        console.error(error?.stack || error);
        target.dataset.pdfError = `${phase}: ${error?.name}: ${error?.message}`;
        status.textContent = 'UNABLE TO OPEN PDF · TRY AGAIN';
      }
      finally { loading = false; }
    };
    const activate = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    };
    target.setAttribute('role', 'button');
    target.removeAttribute('aria-roledescription');
    target.setAttribute('aria-haspopup', 'dialog');
    target.setAttribute('aria-label', 'Open roundtable PDF');
    target.classList.add('gallery-trigger');
    target.addEventListener('click', open);
    target.addEventListener('keydown', activate);
    return () => {
      disposed = true;
      target.removeEventListener('click', open);
      target.removeEventListener('keydown', activate);
      target.classList.remove('gallery-trigger');
      target.setAttribute('role', 'group');
      target.setAttribute('aria-roledescription', 'slide');
      target.removeAttribute('aria-haspopup');
    };
  }
  const renderers = { '3d': placeholder, pdf: pdfPreview, gallery: galleryPreview };

  // Optional preview: { src, alt } supports future covers, photos and model stills.
  function renderPreview(result, target) {
    target.dataset.previewType = result.type;
    if (result.id === 'roundtable') {
      const cover = document.createElement('span');
      cover.className = 'result-pdf-cover';
      target.replaceChildren(cover);
      mountCover(cover, true);
    } else if (result.preview?.src) {
      const image = document.createElement('img');
      image.src = result.preview.src;
      image.alt = result.preview.alt || '';
      image.loading = 'lazy';
      target.replaceChildren(image);
    } else {
      const label = document.createElement('span');
      label.textContent = { pdf: 'PDF / COVER', gallery: 'GALLERY / PHOTO', '3d': '3D / POINT CLOUD' }[result.type] || 'IMAGE / PREVIEW';
      target.replaceChildren(label);
    }
  }

  function show(next, animate = true) {
    index = (next + results.length) % results.length;
    const result = results[index];
    dispose();
    title.textContent = result.title;
    description.textContent = result.description;
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(results.length).padStart(2, '0')}`;
    counter.setAttribute('aria-label', `Result ${index + 1} of ${results.length}`);
    stage.setAttribute('aria-label', `${index + 1} of ${results.length} — ${result.title}`);
    stage.dataset.resultId = result.id;
    stage.dataset.resultType = result.type;
    dispose = (renderers[result.type] || placeholder)(result, stage);
    previews.forEach(({ button, offset }) => {
      const nextResult = results[(index + offset) % results.length];
      renderPreview(nextResult, button.querySelector('.result-teaser-media'));
      button.querySelector('.result-teaser-title').textContent = nextResult.title;
      button.querySelector('.result-teaser-description').textContent = nextResult.description;
      button.setAttribute('aria-label', `View ${nextResult.title}`);
      button.dataset.resultId = nextResult.id;
    });
    [summary, stage, upcoming].forEach(element => {
      element.getAnimations().forEach(animation => animation.cancel());
      if (animate && !reducedMotion.matches) {
        element.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      }
    });
  }
  viewer.querySelectorAll('[data-result-step]').forEach(button => {
    button.addEventListener('click', () => show(index + Number(button.dataset.resultStep)));
  });
  // Arrow keys only operate while focus is inside this viewer.
  viewer.addEventListener('keydown', event => {
    if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  show(0, false);
})();
