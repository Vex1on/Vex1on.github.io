// Scroll reveals, pointer effects and scroll-linked progress used across the site.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('is-in');
      revealObserver.unobserve(el);

      // Hand the element back to its own hover transitions once it has landed.
      const delay = Number.parseFloat(el.style.getPropertyValue('--reveal-delay')) || 0;
      setTimeout(() => {
        el.classList.add('has-revealed');
        el.removeAttribute('data-reveal');
      }, delay + 900);
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
);

// Watches any new [data-reveal] elements inside `root`. Items sharing a
// [data-stagger] parent animate in one after another.
export function observeReveals(root = document) {
  for (const group of root.querySelectorAll('[data-stagger]')) {
    [...group.querySelectorAll(':scope > [data-reveal]')].forEach((el, index) => {
      el.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 90}ms`);
    });
  }
  for (const el of root.querySelectorAll('[data-reveal]')) revealObserver.observe(el);
  if (finePointer) for (const card of root.querySelectorAll('.card')) trackPointer(card);
}

function trackPointer(card) {
  if (card.dataset.pointerTracked) return;
  card.dataset.pointerTracked = 'true';

  const tilts = card.hasAttribute('data-tilt') && !reducedMotion;

  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    card.style.setProperty('--pointer-x', `${x}px`);
    card.style.setProperty('--pointer-y', `${y}px`);
    if (tilts) {
      card.style.setProperty('--tilt-y', `${(x / rect.width - 0.5) * 5}deg`);
      card.style.setProperty('--tilt-x', `${(0.5 - y / rect.height) * 5}deg`);
    }
  });

  if (tilts) {
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  }
}

// Fraction of `el` that has passed the given line in the viewport (0 to 1).
function progressThrough(el, viewportLine) {
  const rect = el.getBoundingClientRect();
  const passed = innerHeight * viewportLine - rect.top;
  return Math.min(1, Math.max(0, passed / rect.height));
}

function setupScrollEffects() {
  const timelines = [...document.querySelectorAll('[data-timeline]')];
  const parallax = reducedMotion ? [] : [...document.querySelectorAll('[data-parallax]')];
  const article = document.querySelector('[data-read-progress-target]');
  const progressBar = document.querySelector('[data-read-progress]');

  if (!timelines.length && !parallax.length && !article) return;

  let queued = false;
  const update = () => {
    queued = false;
    for (const timeline of timelines) {
      timeline.style.setProperty('--timeline-progress', progressThrough(timeline, 0.65).toFixed(4));
    }
    for (const el of parallax) {
      el.style.setProperty('--parallax', `${Math.min(scrollY, innerHeight) * 0.18}px`);
    }
    if (article && progressBar) {
      const rect = article.getBoundingClientRect();
      const distance = rect.height - innerHeight;
      const value = distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 1;
      progressBar.style.setProperty('--read-progress', value.toFixed(4));
    }
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}

observeReveals();
setupScrollEffects();
