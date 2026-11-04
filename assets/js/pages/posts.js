import { renderPostGrid } from '../lib/posts.js';
import { observeReveals } from '../motion.js';

const grid = document.querySelector('[data-post-grid]');
renderPostGrid(grid).then(() => observeReveals(grid.parentElement));
