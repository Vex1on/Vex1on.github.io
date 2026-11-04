import { renderPostGrid } from '../lib/posts.js';
import { observeReveals } from '../motion.js';
import { startWaveform } from '../waveform.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

startWaveform(document.querySelector('[data-waveform]'));

const grid = document.querySelector('[data-latest-posts]');
renderPostGrid(grid, { limit: 3 }).then(() => observeReveals(grid.parentElement));

// FIRTACH's conversation types itself out the first time it scrolls into view.
const chat = document.querySelector('[data-chat]');

function typeLine(line) {
  return new Promise((resolve) => {
    const full = line.querySelector('[data-text]');
    const typed = document.createElement('span');
    typed.className = 'chat__typed is-typing';
    typed.setAttribute('aria-hidden', 'true');
    line.append(typed);

    const text = full.textContent;
    const isUser = line.classList.contains('chat__line--user');
    const speed = isUser ? 52 : 26;
    let count = 0;

    const tick = () => {
      count += 1;
      typed.textContent = text.slice(0, count);
      if (count < text.length) {
        setTimeout(tick, speed + Math.random() * speed);
      } else {
        typed.classList.remove('is-typing');
        resolve();
      }
    };
    tick();
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function playChat() {
  const lines = [...chat.querySelectorAll('[data-line]')];

  for (const line of lines) {
    const isUser = line.classList.contains('chat__line--user');
    chat.classList.toggle('is-speaking', !isUser);
    await typeLine(line);
    chat.classList.remove('is-speaking');
    await wait(420);
  }
}

if (!reducedMotion) {
  // Hide the text but keep its space, so the page doesn't jump while it types.
  for (const text of chat.querySelectorAll('[data-text]')) text.classList.add('is-ghost');
  new IntersectionObserver(
    ([entry], observer) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      playChat();
    },
    { threshold: 0.45 },
  ).observe(chat);
}
