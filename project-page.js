import { createProjectModels } from './project-models.js';
import { createBannerMasks } from './blob-mask.js';
import { createSpaceBackground } from './space-background.js';
import { createProjectPager } from './project-pager.js';
import { updateScrollPalette } from './scroll-palette.js';
import { createCursorBlob } from './cursor-blob.js';

const host = document.querySelector('#viewer');
const background = createSpaceBackground(host, document.querySelector('#nebula'), document.querySelector('#starfield'));
new ResizeObserver(() => background.resize()).observe(host);
background.resize();
const projectContent = document.querySelector('[data-project-content]');
const cursorBlob = createCursorBlob();
createProjectPager(projectContent, location.href);
const bannerMasks = createBannerMasks(projectContent);
const projectModels = createProjectModels();
projectContent.querySelectorAll('[data-project-model]').forEach(host => {
  projectModels.add(host, host.dataset.projectModel, host.dataset.animation || 'idle');
});
function animate(time) {
  const progress = Math.min(projectContent.scrollTop / Math.max(window.innerHeight, 1), 1);
  const paletteProgress = progress * progress * (3 - 2 * progress);
  const backgroundProgress = updateScrollPalette(paletteProgress);
  background.draw(time, backgroundProgress);
  cursorBlob.draw(time);
  bannerMasks.update(time);
  projectModels.update(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
