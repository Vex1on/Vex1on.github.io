import assert from 'node:assert/strict';
import { test } from 'node:test';

import { markdownToText, renderMarkdown, safeUrl } from '../assets/js/lib/markdown.js';
import { isValidSlug, makeExcerpt, slugify, sortPosts } from '../assets/js/lib/posts.js';

test('renders the supported formatting', () => {
  const html = renderMarkdown(
    '# Title\n\nSome **bold**, *italic* and `code <b>`.\n\n- one\n- two\n\n> quoted\n\n```\nx < 1\n```\n\n---',
  );
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code>code &lt;b&gt;<\/code>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<blockquote><p>quoted<\/p><\/blockquote>/);
  assert.match(html, /<pre><code>x &lt; 1<\/code><\/pre>/);
  assert.match(html, /<hr>/);
});

test('underscores inside link addresses and words stay literal', () => {
  const html = renderMarkdown('[a](https://x.com/a_b_c) snake_case_word ![i](/a_b_c.png)');
  assert.ok(html.includes('href="https://x.com/a_b_c"'));
  assert.ok(html.includes('snake_case_word'));
  assert.ok(html.includes('src="/a_b_c.png"'));
});

test('raw HTML is shown as text, never as markup', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '**<svg onload=alert(1)>**',
    '[<img src=x onerror=alert(1)>](https://x.com)',
    '`</code><script>alert(1)</script>`',
    '![" onerror="alert(1)](https://x.com/a.png)',
    '[x](https://x.com/"onmouseover="alert(1))',
  ];
  for (const attack of attacks) {
    const html = renderMarkdown(attack);
    assert.doesNotMatch(html, /<(script|svg)/i, attack);
    assert.doesNotMatch(html, /<img src="?x/i, attack);
    assert.doesNotMatch(html, /\s(onerror|onload|onmouseover)="/i, attack);
  }
});

test('dangerous link and image addresses are refused', () => {
  const attacks = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    '\u0001javascript:alert(1)',
  ];
  for (const url of attacks) assert.equal(safeUrl(url), null, url);

  assert.doesNotMatch(renderMarkdown('[x](javascript:alert(1))'), /<a /);
  assert.doesNotMatch(renderMarkdown('![x](data:image/svg+xml,x)'), /<img /);
});

test('normal addresses are allowed', () => {
  for (const url of ['https://a.com', 'http://a.com/b?c=d:e', '/a/b.png', 'a/b.png', '#top', '?a=b:c']) {
    assert.equal(safeUrl(url), url);
  }
  assert.equal(safeUrl('mailto:a@b.com'), 'mailto:a@b.com');
  assert.equal(safeUrl('mailto:a@b.com', { image: true }), null);
});

test('pending images can be previewed through resolveImage', () => {
  const html = renderMarkdown('![a](/assets/new.png)', { resolveImage: () => 'blob:http://site/123' });
  assert.ok(html.includes('src="blob:http://site/123"'));
});

test('markdownToText strips formatting for excerpts', () => {
  assert.equal(markdownToText('# Hi **there**\n\n![x](/a.png)\n[link](/b)'), 'Hi there link');
});

test('slug helpers', () => {
  assert.equal(slugify('Hello, Wörld!  Again'), 'hello-world-again');
  assert.equal(slugify('!!!'), '');
  assert.ok(isValidSlug('a-post-1'));
  for (const bad of ['', 'A', 'a--b', '-a', 'a-', '../x', 'a/b', null]) assert.ok(!isValidSlug(bad), String(bad));
});

test('excerpts cut at a word boundary', () => {
  assert.equal(makeExcerpt('short'), 'short');
  const long = makeExcerpt('word '.repeat(100));
  assert.ok(long.length <= 161);
  assert.ok(long.endsWith('word…'));
});

test('posts sort newest first', () => {
  const sorted = sortPosts([
    { date: '2021-01-01', title: 'a' },
    { date: '2026-01-01', title: 'b' },
  ]);
  assert.equal(sorted[0].title, 'b');
});
