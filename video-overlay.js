import { getSpaceBackground } from './space-background.js';

// A magnetic Play blob opens a native modal above every site layer.
export function createVideoPlayers(root) {
  const events = new AbortController();
  const players = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastTime = null;
  for (const host of root.querySelectorAll('[data-video-player]')) {
    const windowLayer = document.createElement('div');
    windowLayer.className = 'video-window-layer';
    const canvas = document.createElement('canvas');
    canvas.className = 'video-background'; canvas.setAttribute('aria-hidden', 'true');
    windowLayer.append(canvas); host.prepend(windowLayer);
    const context = canvas.getContext('2d');
    const play = host.querySelector('[data-video-play]');
    const insidePlay = document.createElement('div');
    insidePlay.className = 'video-play-blob video-play-blob--inside';
    insidePlay.setAttribute('aria-hidden', 'true');
    insidePlay.innerHTML = '<span>▶</span>';
    windowLayer.append(insidePlay);
    const setPosition = (x, y) => {
      for (const button of [play, insidePlay]) {
        button.style.setProperty('--play-x', `${x}px`);
        button.style.setProperty('--play-y', `${y}px`);
      }
    };
    const motion = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const dialog = document.createElement('dialog');
    dialog.className = 'video-modal';
    dialog.setAttribute('aria-label', 'Project video');
    const panel = document.createElement('div');
    panel.className = 'video-modal-panel';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'video-modal-close';
    close.setAttribute('aria-label', 'Close video');
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" /></svg>';
    dialog.append(panel, close);
    document.body.append(dialog);
    let iframe = null, closing = false, closeTimer, openingFrame;
    function finishClose() {
      clearTimeout(closeTimer);
      cancelAnimationFrame(openingFrame);
      iframe?.remove(); iframe = null;
      if (dialog.open) dialog.close();
      document.documentElement.classList.remove('video-overlay-open');
      closing = false;
      if (play.isConnected) play.focus({ preventScroll: true });
    }
    function closeVideo() {
      if (!dialog.open || closing) return;
      closing = true;
      cancelAnimationFrame(openingFrame);
      iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube.com');
      dialog.classList.remove('is-visible');
      if (reduced.matches) finishClose();
      else closeTimer = setTimeout(finishClose, 300);
    }
    play.addEventListener('click', () => {
      if (dialog.open) return;
      closing = false;
      iframe = document.createElement('iframe');
      iframe.title = host.getAttribute('aria-label') || 'Project video';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      const url = new URL(`/embed/${encodeURIComponent(host.dataset.videoId)}`, 'https://www.youtube.com');
      url.search = new URLSearchParams({ autoplay: '1', playsinline: '1', enablejsapi: '1', controls: '1', fs: '1', origin: location.origin });
      iframe.src = url.href;
      panel.append(iframe);
      document.documentElement.classList.add('video-overlay-open');
      dialog.showModal();
      // Establish the collapsed state before transitioning from the centre.
      void panel.offsetWidth;
      openingFrame = requestAnimationFrame(() => dialog.classList.add('is-visible'));
      close.focus({ preventScroll: true });
    }, { signal: events.signal });
    close.addEventListener('click', closeVideo, { signal: events.signal });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeVideo();
    }, { signal: events.signal });
    dialog.addEventListener('cancel', event => {
      event.preventDefault(); closeVideo();
    }, { signal: events.signal });
    dialog.addEventListener('wheel', event => event.stopPropagation(), { signal: events.signal, passive: true });
    host.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const bounds = host.getBoundingClientRect();
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      document.body.classList.toggle('video-pointer-active', inside);
      if (!inside) { motion.targetX = motion.targetY = 0; return; }
      motion.targetX = event.clientX + 7 - bounds.left - host.clientWidth / 2;
      motion.targetY = event.clientY + 10 - bounds.top - host.clientHeight / 2;
    }, { signal: events.signal });
    host.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') document.body.classList.add('video-pointer-active');
    }, { signal: events.signal });
    host.addEventListener('pointerleave', () => {
      motion.targetX = motion.targetY = 0;
      document.body.classList.remove('video-pointer-active');
    }, { signal: events.signal });
    players.push({ host, play, insidePlay, motion, context, canvas, setPosition, destroy() {
      clearTimeout(closeTimer); cancelAnimationFrame(openingFrame);
      if (dialog.open) dialog.close();
      dialog.remove(); iframe?.remove(); windowLayer.remove();
    } });
  }
  return {
    update(time) {
      const delta = Math.min(lastTime === null ? 0 : (time - lastTime) / 1000, .05);
      lastTime = time;
      const follow = 1 - Math.exp(-18 * delta);
      for (const { host, play, insidePlay, motion, canvas, context, setPosition } of players) {
        const bounds = host.getBoundingClientRect();
        if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
          const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          const width = Math.round(bounds.width * ratio), height = Math.round(bounds.height * ratio);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width; canvas.height = height; context.setTransform(ratio, 0, 0, ratio, 0, 0);
          }
          getSpaceBackground()?.drawRegion(context, bounds, time);
        }
        motion.x += (motion.targetX - motion.x) * follow;
        motion.y += (motion.targetY - motion.y) * follow;
        setPosition(motion.x, motion.y);
        // Both sides use the same silhouette, clipped by the rounded window.
        const phase = reduced.matches ? 0 : time * .001;
        const radii = [0, 1, 2, 3, 4, 5, 6, 7].map(index => 50 + Math.sin(phase + index * 1.7) * 10);
        const shape = `${radii.slice(0, 4).map(value => `${value}%`).join(' ')} / ${radii.slice(4).map(value => `${value}%`).join(' ')}`;
        play.style.borderRadius = insidePlay.style.borderRadius = shape;
        insidePlay.style.scale = play.matches(':active') ? '.92' : '1';
      }
    },
    destroy() {
      events.abort(); players.forEach(player => player.destroy()); players.length = 0;
      document.documentElement.classList.remove('video-overlay-open');
      document.body.classList.remove('video-pointer-active');
    },
  };
}
