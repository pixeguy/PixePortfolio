import { createProjectModels } from './project-models.js';
import { createBannerMasks } from './blob-mask.js';
import { createSpaceBackground } from './space-background.js';

const host = document.querySelector('#viewer');
const background = createSpaceBackground(host, document.querySelector('#nebula'), document.querySelector('#starfield'));
new ResizeObserver(() => background.resize()).observe(host);
background.resize();
const projectContent = document.querySelector('[data-project-content]');
const bannerMasks = createBannerMasks(projectContent);
const projectModels = createProjectModels();
projectContent.querySelectorAll('[data-project-model]').forEach(host => {
  projectModels.add(host, host.dataset.projectModel, host.dataset.animation || 'idle');
});
function animate(time) {
  background.draw(time);
  bannerMasks.update(time);
  projectModels.update(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
