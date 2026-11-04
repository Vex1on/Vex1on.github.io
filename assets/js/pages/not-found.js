// GitHub Pages serves 404.html for any unknown address, so links to the old
// site's pages are forwarded to where they live now.
(function () {
  const MOVED = {
    '/Home.html': '/',
    '/Latest-Projects.html': '/projects/',
    '/FIRTACH.html': '/projects/firtach.html',
    '/VEX-Browser.html': '/projects/vex-browser.html',
    '/Posts.html': '/posts/',
    '/blog/blog.html': '/posts/',
  };

  const path = location.pathname;
  const oldPost = /^\/blog\/([a-z0-9-]+)\.html$/.exec(path);
  const target = MOVED[path] || (oldPost && `/posts/post.html?slug=${oldPost[1]}`);

  if (target) location.replace(target);
})();
