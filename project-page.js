import { createSpaceBackground } from './space-background.js';
import { updateScrollPalette } from './scroll-palette.js';
import { createCursorBlob } from './cursor-blob.js';
import { createProjectNavigation } from './page-navigation.js';

updateScrollPalette(1);
const host = document.querySelector('#viewer');
const background = createSpaceBackground(host, document.querySelector('#nebula'), document.querySelector('#starfield'));
new ResizeObserver(() => background.resize()).observe(host);
background.resize();
const cursorBlob = createCursorBlob();
const navigation = createProjectNavigation(window.matchMedia('(prefers-reduced-motion: reduce)'), {
  initialContent: document.querySelector('[data-project-content]'),
  homeURL: new URL('./index.html', location.href).href,
});
function animate(time) {
  background.draw(time, 1);
  cursorBlob.draw(time);
  navigation.update(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
