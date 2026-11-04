// The animated voice waveform behind the home hero, based on the FIRTACH logo.
// It breathes on its own and swells towards the pointer.

const BAR_WIDTH = 6;
const BAR_GAP = 10;

export function startWaveform(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let gradient;
  let running = false;
  let frame = 0;
  const startTime = performance.now();

  // The pointer's position and strength are smoothed so the swell glides.
  const pointer = { x: 0.5, strength: 0, targetX: 0.5, targetStrength: 0 };

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#6a2bd9');
    gradient.addColorStop(0.5, '#b57bff');
    gradient.addColorStop(1, '#e08cff');
  }

  function draw(now) {
    const time = reducedMotion ? 2 : (now - startTime) / 1000;
    const intro = reducedMotion ? 1 : Math.min(1, time / 1.6);
    const easedIntro = 1 - (1 - intro) ** 3;

    pointer.x += (pointer.targetX - pointer.x) * 0.08;
    pointer.strength += (pointer.targetStrength - pointer.strength) * 0.06;

    context.clearRect(0, 0, width, height);
    context.fillStyle = gradient;

    const step = BAR_WIDTH + BAR_GAP;
    const count = Math.ceil(width / step) + 1;
    const middle = height * 0.62;
    const maxHeight = height * 0.9;

    for (let i = 0; i < count; i += 1) {
      const position = i / count;

      const voice =
        0.3 * Math.sin(position * 13 + time * 1.3) +
        0.24 * Math.sin(position * 29 - time * 2.1) +
        0.16 * Math.sin(position * 61 + time * 3.4);
      const syllables = 0.55 + 0.45 * Math.sin(position * 5 - time * 0.55);
      const idle = (0.14 + Math.abs(voice) * syllables) * 0.72;

      const distance = (position - pointer.x) * (width / 300);
      const swell = pointer.strength * Math.exp(-distance * distance) * 0.62;

      const amount = Math.min(1, (idle + swell) * easedIntro);
      const barHeight = Math.max(BAR_WIDTH, amount * maxHeight);

      context.globalAlpha = 0.28 + amount * 0.62;
      context.beginPath();
      context.roundRect(i * step, middle - barHeight / 2, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    frame = requestAnimationFrame(loop);
  }

  function setRunning(next) {
    if (reducedMotion || next === running) return;
    running = next;
    if (running) {
      frame = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(frame);
    }
  }

  resize();
  draw(performance.now());

  new ResizeObserver(() => {
    resize();
    draw(performance.now());
  }).observe(canvas);

  if (reducedMotion) return;

  // Only animate while the hero is on screen and the tab is visible.
  let onScreen = true;
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    setRunning(onScreen && !document.hidden);
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => setRunning(onScreen && !document.hidden));

  const host = canvas.parentElement;
  host.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.targetX = (event.clientX - rect.left) / rect.width;
    pointer.targetStrength = 1;
  });
  host.addEventListener('pointerleave', () => {
    pointer.targetStrength = 0;
  });

  setRunning(true);
}
