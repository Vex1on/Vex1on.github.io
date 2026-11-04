// The admin area: sign-in, the list of posts, and the post editor.

import { MAX_IMAGE_MB, SITE } from '../config.js';
import { clearToken, getToken, GitHubClient, GitHubError, saveToken } from '../lib/github.js';
import { renderMarkdown } from '../lib/markdown.js';
import { formatDate, isValidSlug, makeExcerpt, postUrl, slugify, sortPosts } from '../lib/posts.js';

const $ = (selector, root = document) => root.querySelector(selector);

let client = null;

// Views --------------------------------------------------------------------

function showView(name) {
  for (const view of document.querySelectorAll('[data-view]')) {
    view.hidden = view.dataset.view !== name;
  }
  scrollTo(0, 0);
}

function toast(message, duration = 7000) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  $('[data-toasts]').append(element);
  setTimeout(() => {
    element.classList.add('is-leaving');
    setTimeout(() => element.remove(), 320);
  }, duration);
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

// Sign in ------------------------------------------------------------------

const loginForm = $('[data-login-form]');
const loginError = $('[data-login-error]');

async function enter(user) {
  $('[data-login-name]').textContent = user.name || user.login;
  $('[data-avatar]').src = user.avatarUrl;
  await route();
}

function signOut(message = '') {
  clearToken();
  client = null;
  editor.dirty = false;
  // Reload so the header forgets the signed-in state. A reload would lose the
  // message, so signing out with a reason stays on this page instead.
  if (!message) {
    location.replace('/admin/');
    return;
  }
  history.replaceState(null, '', '/admin/');
  showError(loginError, message);
  showView('login');
}

// If the token stops working partway through (expired or revoked), go back to
// sign-in rather than leaving every action failing.
function handleAuthFailure(error) {
  if (error instanceof GitHubError && error.status === 401) {
    signOut('Your token has stopped working. Please sign in with a new one.');
    return true;
  }
  return false;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(loginError, '');

  const token = loginForm.elements.token.value.trim();
  if (!token) {
    showError(loginError, 'Paste your GitHub token first.');
    return;
  }

  const submit = $('button[type="submit"]', loginForm);
  submit.disabled = true;
  submit.textContent = 'Checking…';

  try {
    const candidate = new GitHubClient(token);
    await candidate.verify();
    saveToken(token, loginForm.elements.remember.checked);
    loginForm.reset();
    // The header is drawn once per page load, so reload to show "Write a post".
    location.reload();
  } catch (error) {
    showError(loginError, error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Sign in';
  }
});

$('[data-toggle-token]').addEventListener('click', (event) => {
  const input = loginForm.elements.token;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-pressed', String(reveal));
});

$('[data-sign-out]').addEventListener('click', () => signOut());

// Reading and writing posts ------------------------------------------------

async function readIndex(ref) {
  const text = await client.readFile(SITE.postsIndex, ref);
  return text ? JSON.parse(text).posts : [];
}

const indexFile = (posts) => ({
  path: SITE.postsIndex,
  text: `${JSON.stringify({ posts: sortPosts(posts) }, null, 2)}\n`,
});

const bodyPath = (slug) => `${SITE.postsDir}/${slug}.md`;

// Dashboard ----------------------------------------------------------------

async function showDashboard() {
  showView('dashboard');
  const rows = $('[data-post-rows]');
  rows.replaceChildren(message('Loading posts…'));

  try {
    const posts = sortPosts(await readIndex());
    if (!posts.length) {
      rows.replaceChildren(message('No posts yet. Write your first one!'));
      return;
    }
    rows.replaceChildren(...posts.map(createRow));
  } catch (error) {
    if (!handleAuthFailure(error)) rows.replaceChildren(message(error.message));
  }
}

function message(text) {
  const notice = document.createElement('p');
  notice.className = 'notice';
  notice.textContent = text;
  return notice;
}

function createRow(post, index) {
  const row = document.createElement('article');
  row.className = 'post-row';
  row.style.animationDelay = `${Math.min(index, 8) * 45}ms`;

  const thumb = document.createElement('img');
  thumb.className = 'post-row__thumb';
  thumb.alt = '';
  if (post.cover) thumb.src = post.cover;

  const main = document.createElement('div');
  main.className = 'post-row__main';
  const title = document.createElement('div');
  title.className = 'post-row__title';
  title.textContent = post.title;
  const date = document.createElement('time');
  date.className = 'post-row__date';
  date.dateTime = post.date;
  date.textContent = formatDate(post.date);
  main.append(title, date);

  const actions = document.createElement('div');
  actions.className = 'post-row__actions';

  const view = document.createElement('a');
  view.className = 'btn btn--ghost btn--small';
  view.href = postUrl(post.slug);
  view.textContent = 'View';

  const edit = document.createElement('a');
  edit.className = 'btn btn--ghost btn--small';
  edit.href = `#/edit/${post.slug}`;
  edit.textContent = 'Edit';

  const remove = document.createElement('button');
  remove.className = 'btn btn--danger btn--small';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deletePost(post, remove));

  actions.append(view, edit, remove);
  row.append(thumb, main, actions);
  return row;
}

function confirmDelete(title) {
  const dialog = $('[data-confirm]');
  $('[data-confirm-text]').textContent = `"${title}" will be removed from the site. Its old versions stay in your repo's commit history.`;
  dialog.showModal();
  return new Promise((resolve) => {
    const listeners = new AbortController();
    const answer = (confirmed) => {
      listeners.abort();
      resolve(confirmed);
    };
    const { signal } = listeners;
    $('form', dialog).addEventListener('submit', (event) => answer(event.submitter?.value === 'delete'), { signal });
    dialog.addEventListener('cancel', () => answer(false), { signal });
  });
}

async function deletePost(post, button) {
  if (!(await confirmDelete(post.title))) return;

  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Deleting…';

  try {
    await client.commit(`Delete post: ${post.title}`, async (headSha) => {
      const posts = await readIndex(headSha);
      return [indexFile(posts.filter((item) => item.slug !== post.slug)), { path: bodyPath(post.slug), remove: true }];
    });
    editor.dirty = false;
    toast('Post deleted. The live site updates in about a minute.');
    if (location.hash === '#/' || !location.hash) await showDashboard();
    else location.hash = '#/';
    return;
  } catch (error) {
    if (handleAuthFailure(error)) return;
    toast(error.message);
  }
  button.disabled = false;
  button.textContent = label;
}

// Editor -------------------------------------------------------------------

const form = $('[data-editor-form]');
const fields = form.elements;
const textarea = fields.body;
const preview = $('[data-preview]');
const editorError = $('[data-editor-error]');
const publishButton = $('[data-publish]');
const deleteButton = $('[data-delete]');

const IMAGE_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

const editor = {
  original: null, // The post being edited, or null when writing a new one.
  cover: '', // Site address of the cover image.
  images: new Map(), // Site address -> { file, previewUrl } for images not yet uploaded.
  slugTouched: false,
  dirty: false,
};

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function resetEditor() {
  for (const { previewUrl } of editor.images.values()) URL.revokeObjectURL(previewUrl);
  editor.images.clear();
  editor.original = null;
  editor.cover = '';
  editor.slugTouched = false;
  editor.dirty = false;
  form.reset();
  showError(editorError, '');
}

function fillEditor(post, body) {
  editor.original = post;
  editor.cover = post.cover || '';
  editor.slugTouched = true;
  fields.title.value = post.title;
  fields.slug.value = post.slug;
  fields.slug.readOnly = true;
  fields.date.value = post.date;
  fields.excerpt.value = post.excerpt || '';
  textarea.value = body;
  deleteButton.hidden = false;
  publishButton.textContent = 'Save changes';
}

function resolvePending(url) {
  return editor.images.get(url)?.previewUrl;
}

function updatePreview() {
  preview.innerHTML = renderMarkdown(textarea.value, { resolveImage: resolvePending });
}

function updateCoverPicker() {
  const image = $('[data-cover-preview]');
  image.hidden = !editor.cover;
  if (editor.cover) image.src = resolvePending(editor.cover) || editor.cover;
  $('[data-cover-remove]').hidden = !editor.cover;
  $('[data-cover-label]').textContent = editor.cover ? 'Change image' : 'Choose image';
}

async function showNewPost() {
  resetEditor();
  fields.slug.readOnly = false;
  fields.date.value = today();
  deleteButton.hidden = true;
  publishButton.textContent = 'Publish';
  updatePreview();
  updateCoverPicker();
  showView('editor');
  document.title = 'New post · Vexion';
  fields.title.focus();
}

async function showEditPost(slug) {
  resetEditor();
  showView('loading');
  try {
    const posts = await readIndex();
    const post = posts.find((item) => item.slug === slug);
    const body = post && (await client.readFile(bodyPath(slug)));
    if (!post || body === null) {
      toast("That post couldn't be found.");
      location.hash = '#/';
      return;
    }
    fillEditor(post, body);
    updatePreview();
    updateCoverPicker();
    showView('editor');
    document.title = `Editing ${post.title} · Vexion`;
  } catch (error) {
    if (handleAuthFailure(error)) return;
    toast(error.message);
    location.hash = '#/';
  }
}

form.addEventListener('input', (event) => {
  editor.dirty = true;
  if (event.target === fields.slug) editor.slugTouched = true;
  if (event.target === fields.title && !editor.slugTouched) fields.slug.value = slugify(fields.title.value);
  if (event.target === textarea) updatePreview();
});

// Images -------------------------------------------------------------------

// Queues an image to upload on publish and returns the address it will have.
// A random prefix means a changed title never affects an image's address.
function addImage(file) {
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    toast(`${file.name} isn't a supported image. Use PNG, JPG, GIF or WebP.`);
    return null;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    toast(`${file.name} is over the ${MAX_IMAGE_MB} MB limit.`);
    return null;
  }
  const name = slugify(file.name.replace(/\.[^.]*$/, '')) || 'image';
  const id = crypto.randomUUID().slice(0, 8);
  const url = `/${SITE.imagesDir}/${id}-${name}.${extension}`;
  editor.images.set(url, { file, previewUrl: URL.createObjectURL(file) });
  editor.dirty = true;
  return url;
}

function insertImages(files) {
  const snippets = [...files]
    .map((file) => {
      const url = addImage(file);
      return url && `![${file.name.replace(/\.[^.]*$/, '').replace(/[[\]]/g, '')}](${url})`;
    })
    .filter(Boolean);
  if (snippets.length) insertAtCursor(`\n\n${snippets.join('\n\n')}\n\n`);
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

$('[data-cover-input]').addEventListener('change', (event) => {
  const [file] = event.target.files;
  event.target.value = '';
  const url = file && addImage(file);
  if (url) {
    editor.cover = url;
    updateCoverPicker();
  }
});

$('[data-cover-remove]').addEventListener('click', () => {
  editor.cover = '';
  editor.dirty = true;
  updateCoverPicker();
});

$('[data-image-input]').addEventListener('change', (event) => {
  insertImages(event.target.files);
  event.target.value = '';
});

const dropZone = $('[data-drop-zone]');

for (const type of ['dragenter', 'dragover']) {
  dropZone.addEventListener(type, (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
}

dropZone.addEventListener('dragleave', (event) => {
  if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('is-dragging');
});

dropZone.addEventListener('drop', (event) => {
  dropZone.classList.remove('is-dragging');
  if (!event.dataTransfer?.files.length) return;
  event.preventDefault();
  insertImages(event.dataTransfer.files);
});

textarea.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;
  event.preventDefault();
  insertImages(files);
});

// Formatting toolbar --------------------------------------------------------

function insertAtCursor(text, selectFrom = text.length, selectTo = text.length) {
  const start = textarea.selectionStart;
  textarea.setRangeText(text, start, textarea.selectionEnd, 'end');
  textarea.setSelectionRange(start + selectFrom, start + selectTo);
  textarea.focus();
  editor.dirty = true;
  updatePreview();
}

function wrapSelection(before, after, placeholder) {
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || placeholder;
  insertAtCursor(`${before}${selected}${after}`, before.length, before.length + selected.length);
}

function prefixLines(prefix, placeholder) {
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
  textarea.setSelectionRange(lineStart, textarea.selectionEnd);
  const selected = value.slice(lineStart, textarea.selectionEnd) || placeholder;
  const text = selected
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
  insertAtCursor(text);
}

const FORMATS = {
  bold: () => wrapSelection('**', '**', 'bold text'),
  italic: () => wrapSelection('*', '*', 'italic text'),
  heading: () => prefixLines('## ', 'Heading'),
  quote: () => prefixLines('> ', 'Quote'),
  list: () => prefixLines('- ', 'List item'),
  link: () => wrapSelection('[', '](https://)', 'link text'),
  code: () => {
    const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (selected.includes('\n')) wrapSelection('```\n', '\n```', '');
    else wrapSelection('`', '`', 'code');
  },
};

$('.toolbar').addEventListener('click', (event) => {
  const button = event.target.closest('[data-format]');
  if (button) FORMATS[button.dataset.format]();
});

textarea.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();
  if (key === 'b' || key === 'i') {
    event.preventDefault();
    FORMATS[key === 'b' ? 'bold' : 'italic']();
  }
});

// Publishing ---------------------------------------------------------------

function validate() {
  const title = fields.title.value.trim();
  const slug = fields.slug.value.trim();
  if (!title) return ['Give your post a title.', fields.title];
  if (!isValidSlug(slug)) {
    return ['The web address can only use lowercase letters, numbers and single hyphens.', fields.slug];
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date.value)) return ['Choose a date for the post.', fields.date];
  if (!textarea.value.trim()) return ['Write something in the post first.', textarea];
  return null;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(editorError, '');

  const problem = validate();
  if (problem) {
    showError(editorError, problem[0]);
    problem[1].focus();
    return;
  }

  const isNew = !editor.original;
  const body = textarea.value.replace(/\r\n?/g, '\n').trimEnd();
  const post = {
    slug: fields.slug.value.trim(),
    title: fields.title.value.trim(),
    date: fields.date.value,
    excerpt: fields.excerpt.value.trim() || makeExcerpt(body),
    ...(editor.cover ? { cover: editor.cover } : {}),
  };

  const label = publishButton.textContent;
  publishButton.disabled = true;
  publishButton.textContent = isNew ? 'Publishing…' : 'Saving…';

  try {
    // Only upload images still in use, in case some were added then removed.
    const used = [...editor.images].filter(([url]) => url === post.cover || body.includes(url));
    const imageFiles = await Promise.all(
      used.map(async ([url, { file }]) => ({ path: url.slice(1), base64: await readAsBase64(file) })),
    );

    await client.commit(`${isNew ? 'Add' : 'Update'} post: ${post.title}`, async (headSha) => {
      const posts = await readIndex(headSha);
      if (isNew && posts.some((item) => item.slug === post.slug)) {
        throw new GitHubError(`There's already a post at /posts/${post.slug}. Choose a different web address.`, 409);
      }
      const others = posts.filter((item) => item.slug !== post.slug);
      return [indexFile([...others, post]), { path: bodyPath(post.slug), text: `${body}\n` }, ...imageFiles];
    });

    editor.dirty = false;
    toast(`${isNew ? 'Published' : 'Saved'}! The live site updates in about a minute.`);
    location.hash = '#/';
  } catch (error) {
    if (!handleAuthFailure(error)) {
      showError(editorError, error.message);
      scrollTo({ top: 0, behavior: 'smooth' });
    }
  } finally {
    publishButton.disabled = false;
    publishButton.textContent = label;
  }
});

deleteButton.addEventListener('click', () => deletePost(editor.original, deleteButton));

addEventListener('beforeunload', (event) => {
  if (editor.dirty) event.preventDefault();
});

// Routing ------------------------------------------------------------------

let currentHash = location.hash;

async function route() {
  document.title = 'Admin · Vexion';
  const hash = location.hash;
  currentHash = hash;
  if (hash === '#/new') await showNewPost();
  else if (hash.startsWith('#/edit/')) await showEditPost(decodeURIComponent(hash.slice(7)));
  else await showDashboard();
}

addEventListener('hashchange', async () => {
  if (!client) return;
  if (editor.dirty && !confirm('Leave without saving? Your changes to this post will be lost.')) {
    history.replaceState(null, '', currentHash || '#/');
    return;
  }
  editor.dirty = false;
  await route();
});

// Start --------------------------------------------------------------------

async function start() {
  const token = getToken();
  if (!token) {
    showView('login');
    return;
  }
  try {
    client = new GitHubClient(token);
    await enter(await client.verify());
  } catch (error) {
    client = null;
    // Only forget the token if GitHub rejected it, not on a network blip.
    if (error.status === 401) clearToken();
    showError(loginError, error.message);
    showView('login');
  }
}

start();
