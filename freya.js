import { createSpaceBackground } from './space-background.js';

const host = document.querySelector('#viewer');
const background = createSpaceBackground(host, document.querySelector('#nebula'), document.querySelector('#starfield'));
new ResizeObserver(() => background.resize()).observe(host);
background.resize();
function animate(time) {
  background.draw(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
