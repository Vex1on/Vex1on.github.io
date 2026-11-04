import { getToken } from '../lib/github.js';
import { renderMarkdown } from '../lib/markdown.js';
import { applyCoverSize, fetchPost, formatDate, readingTime } from '../lib/posts.js';

const article = document.querySelector('[data-article]');
const missing = document.querySelector('[data-missing]');
const slug = new URLSearchParams(location.search).get('slug');

function showMissing(title, text) {
  article.hidden = true;
  missing.hidden = false;
  missing.querySelector('h1').textContent = title;
  missing.querySelector('p').textContent = text;
  document.title = `${title} · Vexion`;
}

try {
  const post = await fetchPost(slug);

  if (!post) {
    showMissing("This post doesn't exist", "It may have been removed, or if it was only just published it can take a minute or so to appear.");
  } else {
    document.title = `${post.title} · Vexion`;
    document.querySelector('meta[name="description"]').content = post.excerpt;

    article.querySelector('[data-title]').textContent = post.title;

    const date = article.querySelector('[data-date]');
    date.dateTime = post.date;
    date.textContent = formatDate(post.date);

    article.querySelector('[data-reading-time]').textContent = readingTime(post.body);

    if (post.cover) {
      const figure = article.querySelector('[data-cover]');
      const img = figure.querySelector('img');
      img.src = post.cover;
      applyCoverSize(img);
      figure.hidden = false;
    }

    article.querySelector('[data-body]').innerHTML = renderMarkdown(post.body);

    if (getToken()) {
      const edit = article.querySelector('[data-edit]');
      edit.href = `/admin/#/edit/${post.slug}`;
      edit.hidden = false;
    }

    article.hidden = false;
    window.dispatchEvent(new Event('resize'));
  }
} catch {
  showMissing("Couldn't load this post", 'Something went wrong while fetching it. Try refreshing the page.');
}
