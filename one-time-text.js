// One-time home-page reveals. Hidden letters keep the final layout unchanged.
export function createOneTimeText() {
  const seen = new Set();
  const entries = new Set();
  const intersecting = new Set();
  const registered = new WeakSet();
  const selector = '.portfolio-tab, .project-content h2, .project-content p, .project-pagination button, .section-gallery figcaption';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new IntersectionObserver(changes => {
    for (const change of changes) {
      if (change.isIntersecting) intersecting.add(change.target);
      else intersecting.delete(change.target);
    }
  }, { threshold: .01 });
  function register(root) {
    for (const element of root.querySelectorAll(selector)) {
      if (registered.has(element)) continue;
      registered.add(element);
      const text = element.textContent;
      if (!text.trim()) continue;
      const wrapper = document.createElement('span');
      wrapper.setAttribute('aria-hidden', 'true');
      const letters = [...text].map(character => {
        const letter = document.createElement('span');
        letter.textContent = character;
        letter.style.opacity = seen.has(text) || reduced.matches ? '1' : '0';
        wrapper.append(letter);
        return letter;
      });
      element.setAttribute('aria-label', text);
      element.replaceChildren(wrapper);
      entries.add({ element, text, wrapper, letters, start: null, count: 0 });
      observer.observe(element);
    }
  }
  function visible(element) {
    if (document.documentElement.classList.contains('is-loading') || document.body.classList.contains('is-project-view')) return false;
    const portfolio = element.closest('#portfolio');
    if (portfolio && !portfolio.classList.contains('is-ready')) return false;
    const gallery = element.closest('.section-gallery-stage');
    if (gallery && !gallery.classList.contains('is-visible')) return false;
    for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      if (ancestor.hidden) return false;
      const style = getComputedStyle(ancestor);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  return {
    register,
    update(time) {
      for (const entry of entries) {
        const { element, text, wrapper, letters } = entry;
        if (!element.isConnected) {
          observer.unobserve(element); intersecting.delete(element); entries.delete(entry); continue;
        }
        if (entry.start === null) {
          if (!intersecting.has(element) || !visible(element)) continue;
          if (seen.has(text) || reduced.matches) {
            wrapper.textContent = text;
            observer.unobserve(element); intersecting.delete(element); entries.delete(entry); continue;
          }
          seen.add(text);
          entry.start = time;
        }
        // Slightly faster than the original 14/28 ms pace; complete on a fast
        // scroll past the text. Restore a text node for continuous link underlines.
        const interval = element.matches('p') ? 11 : 22;
        const count = reduced.matches || !intersecting.has(element) ? letters.length
          : Math.min(letters.length, Math.floor((time - entry.start) / interval) + 1);
        for (let i = entry.count; i < count; i++) letters[i].style.opacity = '1';
        entry.count = count;
        if (count === letters.length) {
          wrapper.textContent = text;
          observer.unobserve(element); intersecting.delete(element); entries.delete(entry);
        }
      }
    },
  };
}
