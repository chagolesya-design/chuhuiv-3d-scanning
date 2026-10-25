// Manually selected project photographs; add/remove entries here.
const projectGalleryPhotos = [
  {
    src: 'assets/gallery/project/20260324_112234.webp',
    alt: 'Three people outdoors with a historic building in the background',
    caption: 'Project visit',
  },
  {
    src: 'assets/gallery/project/20260324_122444.webp',
    alt: 'Two people beside the entrance and weathered facade of a historic building',
    caption: 'Architectural heritage · Facade',
  },
  {
    src: 'assets/gallery/project/20260324_122556.webp',
    alt: 'Project visit photograph 3',
    caption: 'Project visit',
  },
  {
    src: 'assets/gallery/project/20260324_123601.webp',
    alt: 'Project visit photograph 4',
    caption: 'Project visit',
  },
  {
    src: 'assets/gallery/project/20260324_124348.webp',
    alt: 'Project visit photograph 5',
    caption: 'Project visit',
  },
  {
    src: 'assets/gallery/project/20260324_125101.webp',
    alt: 'Project visit photograph 6',
    caption: 'Project visit',
  },
  {
    src: 'assets/gallery/project/20260324_125112.webp',
    alt: 'Project visit photograph 7',
    caption: 'Project visit',
  },
  {
    src: 'assets/gallery/project/photo_2026-03-24_16-47-51.webp',
    alt: 'A group standing in front of the entrance to a historic building',
    caption: 'Project visit · Building entrance',
  },
];

function createProjectGallery(photos = projectGalleryPhotos) {
  const dialog = document.createElement('dialog');
  dialog.className = 'project-gallery';
  dialog.setAttribute('aria-labelledby', 'gallery-title');
  dialog.innerHTML = `
    <header class="gallery-header"><h2 id="gallery-title">PROJECT GALLERY</h2><button type="button" class="gallery-close" aria-label="Close gallery">×</button></header>
    <div class="gallery-stage"></div>
    <div class="gallery-details"><div class="gallery-navigation"><button type="button" class="gallery-previous" aria-label="Previous photograph">←</button><span class="gallery-count" aria-live="polite"></span><button type="button" class="gallery-next" aria-label="Next photograph">→</button></div><p class="gallery-caption"></p></div>
    <nav class="gallery-thumbnails" aria-label="Gallery photographs"></nav>`;
  document.body.append(dialog);
  const stage = dialog.querySelector('.gallery-stage');
  const strip = dialog.querySelector('.gallery-thumbnails');
  const caption = dialog.querySelector('.gallery-caption');
  const count = dialog.querySelector('.gallery-count');
  const close = dialog.querySelector('.gallery-close');
  let index = 0, returnFocus, restoreScroll, gesture;
  const pad = n => String(n).padStart(2, '0');
  const thumbs = photos.map((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Show photograph ${i + 1}`);
    if (photo.src) {
      const image = document.createElement('img');
      image.src = photo.src; image.alt = ''; image.loading = 'lazy';
      button.append(image);
    } else button.textContent = pad(i + 1);
    button.addEventListener('click', () => show(i));
    strip.append(button);
    return button;
  });
  function show(next) {
    if (!photos.length) return;
    index = (next + photos.length) % photos.length;
    const photo = photos[index];
    stage.replaceChildren();
    if (photo.src) {
      const image = document.createElement('img');
      image.alt = photo.alt; image.src = photo.src; image.draggable = false;
      image.addEventListener('error', () => {
        if (stage.contains(image)) stage.replaceChildren(placeholder('Photograph unavailable'));
      });
      stage.append(image);
    } else stage.append(placeholder(`PHOTO ${pad(index + 1)} / PREVIEW TO FOLLOW`));
    caption.textContent = photo.caption;
    count.textContent = `${pad(index + 1)} / ${pad(photos.length)}`;
    thumbs.forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
    const thumb = thumbs[index];
    strip.scrollTo({ left: thumb.offsetLeft - strip.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'instant' });
    stage.getAnimations().forEach(animation => animation.cancel());
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) stage.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 160 });
  }
  function placeholder(text) {
    const element = document.createElement('div');
    element.className = 'gallery-placeholder';
    element.textContent = text;
    return element;
  }
  dialog.querySelector('.gallery-previous').addEventListener('click', () => show(index - 1));
  dialog.querySelector('.gallery-next').addEventListener('click', () => show(index + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopPropagation();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { gesture = null; });
  dialog.addEventListener('close', () => {
    gesture = null;
    restoreScroll?.();
    returnFocus?.focus({ preventScroll: true });
  });
  return {
    open(trigger) {
      if (dialog.open || !photos.length) return;
      returnFocus = trigger;
      const root = document.documentElement, body = document.body;
      const x = scrollX, y = scrollY;
      const rootOverflow = root.style.overflow;
      const keys = ['position', 'top', 'left', 'width'];
      const saved = keys.map(key => body.style[key]);
      root.style.overflow = 'hidden';
      Object.assign(body.style, { position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%' });
      restoreScroll = () => {
        root.style.overflow = rootOverflow;
        keys.forEach((key, i) => { body.style[key] = saved[i]; });
        window.scrollTo({ left: x, top: y, behavior: 'instant' });
      };
      dialog.showModal();
      show(0);
      close.focus({ preventScroll: true });
    },
  };
}
