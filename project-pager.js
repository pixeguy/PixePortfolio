import { projects } from './projects.js';

// Neighbours follow the same order as the front-page project list.
export function createProjectPager(root, url, navigate) {
  const pathname = new URL(url, location.href).pathname;
  const index = projects.findIndex(project => project.href
    && new URL(project.href, location.href).pathname === pathname);
  if (index < 0) return;
  root.querySelector('.project-pager')?.remove();
  const footer = document.createElement('nav');
  footer.className = 'project-pager';
  footer.setAttribute('aria-label', 'Previous and next projects');
  [
    { project: projects[index - 1], label: 'Previous project', direction: 'previous' },
    { project: projects[index + 1], label: 'Next project', direction: 'next' },
  ].forEach(({ project, label, direction }) => {
    const slot = document.createElement('div');
    slot.className = `project-pager-slot project-pager-slot--${direction}`;
    if (project?.href) {
      const link = document.createElement('a');
      link.className = 'project-pager-link';
      link.href = project.href;
      link.rel = direction === 'previous' ? 'prev' : 'next';
      const button = document.createElement('span');
      button.className = 'project-pager-button';
      button.textContent = direction === 'previous' ? `← ${label}` : `${label} →`;
      const thumbnail = document.createElement('img');
      thumbnail.src = project.image;
      thumbnail.alt = project.imageAlt || project.title;
      thumbnail.loading = 'lazy';
      const title = document.createElement('span');
      title.className = 'project-pager-title';
      title.textContent = project.title;
      link.append(button, thumbnail, title);
      if (navigate) link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
            || new URL(link.href).origin !== location.origin) return;
        event.preventDefault();
        navigate(link.href);
      });
      slot.append(link);
    }
    footer.append(slot);
  });
  root.append(footer);
}
