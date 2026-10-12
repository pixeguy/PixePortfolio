import { nebulaNoise, NEBULA_MOTION } from './space-background.js';

// Same deformation as the project outline, without hover or ripple movement.
export function createBannerMasks(root, motionMultiplier = 4.4) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const masks = [...root.querySelectorAll('[data-blob-mask]')].map((path, index) => {
    const tokens = path.getAttribute('d').match(/[MCZ]|-?[0-9.]+/g);
    const commands = [], points = [];
    for (let i = 0; i < tokens.length;) {
      const command = tokens[i++];
      commands.push(command);
      const count = command === 'M' ? 1 : command === 'C' ? 3 : 0;
      for (let j = 0; j < count; j += 1) points.push({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
    }
    return { path, commands, points, phase: index * 13.7, tick: -Infinity,
      speed: NEBULA_MOTION.minimumSpeed + Math.random() * NEBULA_MOTION.speedVariation };
  });
  function sample(mask, time) {
    const flow = time * NEBULA_MOTION.flowRate * mask.speed * motionMultiplier + mask.phase;
    const offsets = mask.points.map(point => ({
      x: (nebulaNoise(point.x * .003 + flow, point.y * .004 - flow * .53) - .5) * 32,
      y: (nebulaNoise(point.x * .004 - flow * .8 + 17, point.y * .003 + flow * .67) - .5) * 24,
    }));
    const meanX = offsets.reduce((sum, point) => sum + point.x, 0) / offsets.length;
    const meanY = offsets.reduce((sum, point) => sum + point.y, 0) / offsets.length;
    offsets.forEach(point => { point.x -= meanX; point.y -= meanY; });
    return offsets;
  }
  return {
    update(time) {
      if (reducedMotion.matches) return;
      for (const mask of masks) {
        const tick = Math.floor(time / 100);
        if (tick !== mask.tick) {
          mask.start = mask.tick === tick - 1 ? mask.end : sample(mask, tick * 100);
          mask.end = sample(mask, (tick + 1) * 100);
          mask.tick = tick;
        }
        const fraction = (time - tick * 100) / 100;
        let index = 0;
        mask.path.setAttribute('d', mask.commands.map(command => {
          if (command === 'Z') return command;
          const coordinates = [];
          for (let i = 0; i < (command === 'M' ? 1 : 3); i += 1) {
            const point = mask.points[index], start = mask.start[index], end = mask.end[index];
            coordinates.push((point.x + start.x + (end.x - start.x) * fraction).toFixed(2),
              (point.y + start.y + (end.y - start.y) * fraction).toFixed(2));
            index += 1;
          }
          return command + ' ' + coordinates.join(' ');
        }).join(' '));
      }
    },
    destroy() { masks.length = 0; },
  };
}
