// A small Markdown renderer. It escapes all input and builds its own tags, so
// raw HTML in a post is shown as text and can never run as code on the site.
//
// Supported: # headings, **bold**, *italic*, ~~strike~~, `code`, ``` fences,
// > quotes, - and 1. lists, --- rules, [links](url) and ![images](url).

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

// Returns a URL that is safe to place in the page, or null. Anything with a
// scheme other than http(s) (or mailto for links) is rejected, which covers
// javascript: and data: URLs, including ones disguised with spaces or tabs.
export function safeUrl(url, { image = false } = {}) {
  const cleaned = String(url).replace(/[\u0000- \u007f-\u009f]/g, '');
  if (!cleaned) return null;
  const scheme = /^([^/?#]*?):/.exec(cleaned);
  if (!scheme) return cleaned;
  const name = scheme[1].toLowerCase();
  if (name === 'http' || name === 'https') return cleaned;
  if (name === 'mailto' && !image) return cleaned;
  return null;
}

function renderInline(source, options) {
  const stash = [];
  const hold = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  // Code spans are pulled out first so nothing inside them is treated as markup.
  let text = source.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, url) => {
    const resolved = options.resolveImage?.(url);
    const safe = resolved ?? safeUrl(url, { image: true });
    if (!safe) return match;
    return hold(`<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}" loading="lazy">`);
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return match;
    const external = /^https?:/i.test(safe) ? ' rel="noopener noreferrer"' : '';
    return hold(`<a href="${escapeHtml(safe)}"${external}>${renderInline(label, options)}</a>`);
  });

  text = escapeHtml(text);
  text = text.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/g, '$1<em>$2</em>');
  text = text.replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<del>$1</del>');

  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)]);
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*```/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?/;
const UNORDERED = /^\s*[-*+]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;

function startsBlock(line) {
  return (
    HEADING.test(line) ||
    FENCE.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    UNORDERED.test(line) ||
    ORDERED.test(line)
  );
}

function renderBlocks(lines, options) {
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (FENCE.test(line)) {
      const code = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      // A post's title is the page's <h1>, so headings in the body start at <h2>.
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${renderInline(heading[2], options)}</h${level}>`);
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      html.push('<hr>');
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(lines[i].replace(QUOTE, ''));
        i += 1;
      }
      html.push(`<blockquote>${renderBlocks(quoted, options)}</blockquote>`);
      continue;
    }

    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const marker = UNORDERED.test(line) ? UNORDERED : ORDERED;
      const tag = marker === UNORDERED ? 'ul' : 'ol';
      const items = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(marker, ''), options)}</li>`);
        i += 1;
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${renderInline(paragraph.join(' '), options)}</p>`);
  }

  return html.join('\n');
}

// `options.resolveImage(url)` can swap an image address, which the editor uses
// to preview images that haven't been uploaded yet.
export function renderMarkdown(markdown, options = {}) {
  const source = String(markdown ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n');
  return renderBlocks(source.split('\n'), options);
}

// Plain text version of some Markdown, used for automatic excerpts.
export function markdownToText(markdown) {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
