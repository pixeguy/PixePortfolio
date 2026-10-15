import { createProjectModels } from './project-models.js';
import { createBannerMasks } from './blob-mask.js';
import { createProjectPager } from './project-pager.js';
import { createPhotoFans } from './photo-fan.js';
import { createVideoPlayers } from './video-overlay.js';
import { createNavigationLoader } from './navigation-loader.js';

// Used from home and direct project visits; canvases survive project changes.
export function createProjectNavigation(reducedMotion, options = {}) {
  const homeElements = ['canvas-host', 'name-backdrop', 'fighting-section', 'portfolio', 'purple-section', 'nebula-return'].map(id => document.getElementById(id)).filter(Boolean);
  const homeTitle = document.title;
  const homeURL = options.homeURL || location.href;
  const standalone = Boolean(options.initialContent);
  let projectContent = options.initialContent || null;
  let bannerMasks, projectModels, photoFans, videoPlayers;
  let busy = false, pending = null;
  const pages = new Map();
  const loader = createNavigationLoader(reducedMotion);
  history.scrollRestoration = 'manual';
  history.replaceState({ ...history.state, portfolioView: standalone ? 'project' : 'home', href: standalone ? location.href : undefined }, '', location.href);
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  function destroyContent() {
    projectModels?.destroy(); bannerMasks?.destroy(); photoFans?.destroy(); videoPlayers?.destroy();
    projectModels = bannerMasks = photoFans = videoPlayers = null;
  }
  function initialize(content, url) {
    content.querySelector('[data-back]').addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); navigate(null, true);
    });
    createProjectPager(content, url, nextURL => navigate(nextURL, true));
    bannerMasks = createBannerMasks(content); photoFans = createPhotoFans(content); videoPlayers = createVideoPlayers(content);
    projectModels = createProjectModels();
    content.querySelectorAll('[data-project-model]').forEach(host => projectModels.add(host, host.dataset.projectModel, host.dataset.animation || 'idle'));
    if (content.querySelector('iframe[src*="canva.com"]') && !document.querySelector('link[data-canva-preconnect]')) {
      const link = document.createElement('link'); link.rel = 'preconnect'; link.href = 'https://www.canva.com';
      link.dataset.canvaPreconnect = ''; document.head.append(link);
    }
  }
  async function bannerReady(content) {
    const source = content.querySelector('.project-banner image')?.getAttribute('href');
    if (!source) return;
    await new Promise(resolve => {
      const image = new Image();
      image.onload = async () => { try { await image.decode(); } catch {} resolve(); };
      image.onerror = resolve; image.src = source;
    });
  }
  async function getPage(url) {
    if (!pages.has(url)) pages.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error('Could not load project page');
      return response.text();
    }).then(html => {
      const page = new DOMParser().parseFromString(html, 'text/html');
      const content = page.querySelector('[data-project-content]');
      if (!content) throw new Error('Project page has no content region');
      return { content, title: page.title };
    }).catch(error => { pages.delete(url); throw error; }));
    return pages.get(url);
  }
  async function navigate(url, push) {
    if (busy) { pending = { url, push }; return; }
    busy = true;
    let leavingDocument = false;
    try {
      await loader.cover();
      if (!url && standalone) { leavingDocument = true; location.assign(homeURL); return; }
      if (url) {
        const page = await getPage(url);
        destroyContent(); projectContent?.remove();
        homeElements.forEach(element => { element.inert = true; });
        document.body.classList.add('page-content-hidden', 'is-project-view');
        document.documentElement.classList.add('project-view-open');
        projectContent = document.importNode(page.content, true);
        document.querySelector('#viewer').append(projectContent);
        initialize(projectContent, url);
        // Wait for local presentation assets, not remote iframe internals.
        await Promise.all([projectModels.whenReady(), bannerReady(projectContent)]);
        if (push) history.pushState({ portfolioView: 'project', href: url }, '', url);
        document.title = page.title;
        await nextFrame();
        projectContent.querySelector('[data-back]').focus({ preventScroll: true });
      } else if (projectContent) {
        destroyContent(); projectContent.remove(); projectContent = null;
        document.body.classList.remove('is-project-view', 'page-content-hidden');
        document.documentElement.classList.remove('project-view-open');
        homeElements.forEach(element => { element.inert = false; });
        document.title = homeTitle;
        if (push) history.pushState({ portfolioView: 'home' }, '', homeURL);
        await nextFrame(); document.querySelector('.project-link')?.focus({ preventScroll: true });
      }
    } catch (error) {
      console.error(error);
      if (url) { leavingDocument = true; location.assign(url); }
    } finally {
      if (!leavingDocument) await loader.reveal();
      busy = false;
      if (pending && !leavingDocument) { const request = pending; pending = null; navigate(request.url, request.push); }
    }
  }
  if (projectContent) initialize(projectContent, location.href);
  window.addEventListener('popstate', event => navigate(event.state?.portfolioView === 'project' ? event.state.href : null, false));
  return { open: url => navigate(url, true), update: time => { bannerMasks?.update(time); projectModels?.update(time); videoPlayers?.update(time); } };
}
