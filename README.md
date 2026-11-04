# Vexion

Source for [vex1on.github.io](https://vex1on.github.io/). It's a static site on GitHub Pages with no build step: push to `main` and it's live.

## Layout

```
index.html              Home
404.html                Not-found page; also forwards links to the old site's pages
projects/               Project pages
posts/                  Post list (index.html) and single post page (post.html)
admin/                  Sign-in, post dashboard and editor
content/
  posts.json            Every post's title, date, summary and cover
  posts/<slug>.md       Each post's text, in Markdown
assets/
  css/                  base (design tokens) · components · pages · admin
  js/
    config.js           Which repo and branch the admin area writes to
    layout.js           Shared header and footer (edit navigation links here)
    motion.js           Scroll reveals and pointer effects
    waveform.js         The animated waveform on the home page
    lib/                Markdown, GitHub API and post helpers
    pages/              One script per page that needs its own
  images/               brand · backgrounds · projects · posts
scripts/serve.mjs       Local preview server
tests/                  Unit tests
```

## Writing posts

1. Go to `/admin/` (there's a **Sign in** link in the footer).
2. Sign in with a GitHub token. The sign-in page links to GitHub's token page and lists the settings to use:
   - **Repository access:** only `Vex1on.github.io`
   - **Permissions:** Contents, read and write
3. Write your post and press **Publish**.

Each publish, edit or delete is one commit to `main`. GitHub Pages then rebuilds, which usually takes about a minute. The admin area reads directly from the repo, so it shows changes straight away.

Your token stays in your browser and is only sent to GitHub. It's forgotten when the tab closes, unless you tick **Stay signed in on this device**. Anyone with the token can change the repo, so treat it like a password. If it leaks, revoke it in GitHub's settings.

Because the repo is public, everything published is public, including deleted posts, which stay in the commit history.

After using the admin area, run `git pull` before changing anything locally, because it commits directly to GitHub.

## Working locally

```bash
npm run dev
```

Then open http://localhost:4173/. No install is needed, just Node. Open pages through this server, because root-relative links don't work when opening files directly.

```bash
npm test
```
