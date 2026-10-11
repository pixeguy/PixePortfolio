import { createProjectModels } from './project-models.js';
import { createBannerMasks } from './blob-mask.js';

// Change page content without replacing the canvases or their animation state.
export function createProjectNavigation(reducedMotion) {
  const homeElements = ['canvas-host', 'name-backdrop', 'portfolio'].map(id => document.getElementById(id));
  const homeTitle = document.title;
  const homeURL = location.href;
  let projectContent = null;
  let bannerMasks = null;
  let projectModels = null;
  let busy = false;
  let pending = null;
  const pages = new Map();
  history.scrollRestoration = 'manual';
  history.replaceState({ ...history.state, portfolioView: 'home' }, '', homeURL);
  const fade = () => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : 450));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  async function getPage(url) {
    if (!pages.has(url)) {
      pages.set(url, fetch(url).then(response => {
        if (!response.ok) throw new Error('Could not load project page');
        return response.text();
      }).then(html => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        const content = document.querySelector('[data-project-content]');
        if (!content) throw new Error('Project page has no content region');
        return { content, title: document.title };
      }).catch(error => { pages.delete(url); throw error; }));
    }
    return pages.get(url);
  }

  async function navigate(url, push) {
    if (busy) { pending = { url, push }; return; }
    busy = true;
    try {
      if (url) {
        // Fetch first so a failed request cannot leave the portfolio invisible.
        const page = await getPage(url);
        if (push) history.pushState({ portfolioView: 'project', href: url }, '', url);
        if (projectContent) {
          projectContent.classList.remove('is-visible');
        } else {
          homeElements.forEach(element => { element.inert = true; });
          document.body.classList.add('page-content-hidden');
        }
        await fade();
        projectModels?.destroy();
        projectModels = null;
        bannerMasks?.destroy();
        projectContent?.remove();
        document.body.classList.add('is-project-view');
        document.documentElement.classList.add('project-view-open');
        projectContent = document.importNode(page.content, true);
        projectContent.classList.add('page-content-entering');
        projectContent.querySelector('[data-back]').addEventListener('click', event => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          history.back();
        });
        document.querySelector('#viewer').append(projectContent);
        bannerMasks = createBannerMasks(projectContent);
        projectModels = createProjectModels();
        projectContent.querySelectorAll('[data-project-model]').forEach(host => {
          projectModels.add(host, host.dataset.projectModel, host.dataset.animation || 'idle');
        });
        document.title = page.title;
        await nextFrame();
        projectContent.classList.add('is-visible');
        await fade();
        projectContent.querySelector('[data-back]').focus({ preventScroll: true });
      } else if (projectContent) {
        projectContent.classList.remove('is-visible');
        await fade();
        projectModels?.destroy();
        projectModels = null;
        bannerMasks?.destroy();
        bannerMasks = null;
        projectContent.remove();
        projectContent = null;
        document.body.classList.remove('is-project-view');
        document.documentElement.classList.remove('project-view-open');
        document.title = homeTitle;
        await nextFrame();
        document.body.classList.remove('page-content-hidden');
        homeElements.forEach(element => { element.inert = false; });
        await fade();
        document.querySelector('.project-link')?.focus({ preventScroll: true });
      }
    } catch (error) {
      console.error(error);
      if (url) location.assign(url);
    } finally {
      busy = false;
      if (pending) {
        const request = pending;
        pending = null;
        navigate(request.url, request.push);
      }
    }
  }
  window.addEventListener('popstate', event => {
    navigate(event.state?.portfolioView === 'project' ? event.state.href : null, false);
  });
  return { open: url => navigate(url, true), update: time => { bannerMasks?.update(time); projectModels?.update(time); } };
}
