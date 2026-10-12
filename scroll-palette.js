import { EDGE_SETTINGS } from './edge-effect.js';

const blend = (a, b, progress) => a.map((value, index) => Math.round(value + (b[index] - value) * progress));
let previous = -1;
function smoothRange(progress, start, end) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}
export function updateScrollPalette(progress) {
  progress = Math.max(0, Math.min(1, progress));
  const leading = smoothRange(progress, 0, .55);
  const following = smoothRange(progress, .45, 1);
  const backgroundProgress = leading;
  const foregroundProgress = following;
  if (Math.abs(previous - progress) < .002) return backgroundProgress;
  previous = progress;
  const accent = blend([212, 196, 68], [47, 33, 68], foregroundProgress);
  const background = blend([3, 3, 6], [212, 196, 68], backgroundProgress);
  const text = blend([220, 232, 237], [47, 33, 68], foregroundProgress);
  const style = document.documentElement.style;
  style.setProperty('--accent-color', `rgb(${accent.join(',')})`);
  style.setProperty('--accent-rgb', accent.join(' '));
  style.setProperty('--page-color', `rgb(${background.join(',')})`);
  style.setProperty('--text-color', `rgb(${text.join(',')})`);
  EDGE_SETTINGS.color = `rgb(${accent.join(',')})`;
  return backgroundProgress;
}
