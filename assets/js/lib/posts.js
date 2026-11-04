// Reading posts for the public pages, plus helpers shared with the admin editor.
//
// content/posts.json lists every post's details; each post's text is Markdown
// in content/posts/<slug>.md.

import { SITE } from '../config.js';
import { markdownToText } from './markdown.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isValidSlug = (slug) => typeof slug === 'string' && slug.length <= 100 && SLUG.test(slug);

export function slugify(title) {
  return String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function makeExcerpt(markdown, length = 160) {
  const text = markdownToText(markdown);
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, '')}…`;
}

export function readingTime(markdown) {
  const words = markdownToText(markdown).split(' ').filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

// Dates are stored as YYYY-MM-DD and shown the same way in every time zone.
export function formatDate(date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function sortPosts(posts) {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export const postUrl = (slug) => `/posts/post.html?slug=${encodeURIComponent(slug)}`;

export async function fetchPosts() {
  const response = await fetch(`/${SITE.postsIndex}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Couldn't load posts (${response.status})`);
  const { posts } = await response.json();
  return sortPosts(posts);
}

// Returns the post's details and Markdown text, or null if there's no such post.
export async function fetchPost(slug) {
  if (!isValidSlug(slug)) return null;
  const posts = await fetchPosts();
  const post = posts.find((item) => item.slug === slug);
  if (!post) return null;
  const response = await fetch(`/${SITE.postsDir}/${slug}.md`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Couldn't load this post (${response.status})`);
  return { ...post, body: await response.text() };
}

// Gives a tiny cover a class that shows it small and crisp rather than stretched.
export function applyCoverSize(img) {
  const check = () => img.classList.toggle('is-small-cover', img.naturalWidth > 0 && img.naturalWidth < 240);
  if (img.complete) check();
  else img.addEventListener('load', check, { once: true });
}

export function createPostCard(post) {
  const card = document.createElement('a');
  card.className = 'card post-card';
  card.href = postUrl(post.slug);

  const media = document.createElement('div');
  media.className = 'post-card__media';
  if (post.cover) {
    const img = document.createElement('img');
    img.src = post.cover;
    img.alt = '';
    img.loading = 'lazy';
    applyCoverSize(img);
    media.append(img);
  }

  const body = document.createElement('div');
  body.className = 'post-card__body';

  const date = document.createElement('time');
  date.className = 'post-card__date';
  date.dateTime = post.date;
  date.textContent = formatDate(post.date);

  const title = document.createElement('h3');
  title.className = 'post-card__title';
  title.textContent = post.title;

  const excerpt = document.createElement('p');
  excerpt.className = 'post-card__excerpt';
  excerpt.textContent = post.excerpt;

  const more = document.createElement('span');
  more.className = 'link-arrow';
  more.innerHTML = 'Read more <span class="link-arrow__icon" aria-hidden="true">→</span>';

  body.append(date, title, excerpt, more);
  card.append(media, body);

  const wrapper = document.createElement('div');
  wrapper.dataset.reveal = '';
  wrapper.append(card);
  return wrapper;
}

// Fills a .post-grid with cards, or a message if there are none or loading fails.
export async function renderPostGrid(grid, { limit } = {}) {
  const showNotice = (text) => {
    const notice = document.createElement('p');
    notice.className = 'notice';
    notice.textContent = text;
    grid.replaceChildren(notice);
  };

  try {
    const posts = await fetchPosts();
    if (!posts.length) {
      showNotice('Nothing posted yet. Check back soon.');
      return;
    }
    grid.replaceChildren(...posts.slice(0, limit).map(createPostCard));
    grid.setAttribute('data-stagger', '');
  } catch {
    showNotice("Couldn't load the posts just now. Try refreshing the page.");
  }
}
