// Shared header and footer. This is a plain, blocking script placed first in
// <body> so the header is there on first paint, with no flash between pages.
// To change the navigation, edit NAV_LINKS or SOCIAL_LINKS here.
(function () {
  const NAV_LINKS = [
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects/' },
    { label: 'Posts', href: '/posts/' },
  ];

  const SOCIAL_LINKS = [
    { label: 'Discord', href: 'https://discordapp.com/users/791798635485986817/' },
    { label: 'YouTube', href: 'https://www.youtube.com/channel/UCIFpxx27m62b8dg-cQadzIA' },
  ];

  document.documentElement.classList.add('js');

  // Same key as TOKEN_KEY in lib/github.js.
  function isSignedIn() {
    try {
      return Boolean(sessionStorage.getItem('vex.token') || localStorage.getItem('vex.token'));
    } catch {
      return false;
    }
  }

  const signedIn = isSignedIn();
  const path = location.pathname;
  const isCurrent = (href) => (href === '/' ? path === '/' || path === '/index.html' : path.startsWith(href));

  const navLinks = NAV_LINKS.map(
    (link) =>
      `<a class="site-nav__link" href="${link.href}"${isCurrent(link.href) ? ' aria-current="page"' : ''}>${link.label}</a>`,
  ).join('');

  const writeButton = signedIn ? '<a class="btn btn--primary btn--small" href="/admin/#/new">Write a post</a>' : '';

  document.currentScript.insertAdjacentHTML(
    'afterend',
    `<header class="site-header" data-site-header>
      <div class="container site-header__inner">
        <a class="site-header__logo" href="/" aria-label="Vexion home">
          <img src="/assets/images/brand/logo.png" alt="" width="486" height="256">
        </a>
        <button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" data-menu-toggle><span></span></button>
        <nav class="site-nav" aria-label="Main">${navLinks}${writeButton}</nav>
      </div>
    </header>`,
  );

  const header = document.querySelector('[data-site-header]');
  const toggle = header.querySelector('[data-menu-toggle]');

  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.addEventListener('DOMContentLoaded', () => {
    const socials = SOCIAL_LINKS.map((link) => `<a href="${link.href}" rel="noopener">${link.label}</a>`).join('');
    document.body.insertAdjacentHTML(
      'beforeend',
      `<footer class="site-footer">
        <div class="container site-footer__inner">
          <span>Vexion &copy; ${new Date().getFullYear()}</span>
          <div class="site-footer__links">
            ${socials}
            <a href="/admin/">${signedIn ? 'Dashboard' : 'Sign in'}</a>
          </div>
        </div>
      </footer>`,
    );
  });
})();
