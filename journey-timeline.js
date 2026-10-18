import * as THREE from 'three';

export function createJourneyTimeline(section) {
  const letters = [...section.querySelectorAll('h3, h4, p')].flatMap(element => {
    const text = element.textContent;
    element.setAttribute('aria-label', text);
    const wrapper = document.createElement('span');
    wrapper.setAttribute('aria-hidden', 'true');
    const characters = [...text].map(character => {
      const letter = document.createElement('span');
      letter.textContent = character;
      letter.style.opacity = '0';
      wrapper.append(letter);
      return letter;
    });
    element.replaceChildren(wrapper);
    return characters;
  });
  const chart = section.querySelector('ol');
  const nodes = [...chart.children];
  let previousCount = -1;
  return {
    update(scroll, introStart, colourFade, loaded, handoff = 0) {
      const start = introStart + 1.35;
      const enter = THREE.MathUtils.clamp((scroll - start) / .4, 0, 1);
      // Clear the timeline before Skills, keeping reverse scroll reversible.
      const erase = Math.max(colourFade, handoff);
      section.hidden = !loaded || enter <= 0 || erase >= 1;
      const count = Math.floor(letters.length * Math.min(enter, 1 - erase));
      if (count !== previousCount) {
        previousCount = count;
        letters.forEach((letter, index) => {
          letter.style.opacity = index < count ? '1' : '0';
          letter.classList.toggle('fight-text-caret', count > 0 && count < letters.length && index === count - 1);
        });
      }
      chart.style.setProperty('--line-top', '0%');
      chart.style.setProperty('--line-bottom', `${Math.max(1 - enter, erase) * 100}%`);
      if (section.hidden) return;
      for (const node of nodes) {
        const position = (node.offsetTop + 6) / Math.max(chart.clientHeight, 1);
        const growing = THREE.MathUtils.clamp((enter - position) / .12, 0, 1);
        const removing = THREE.MathUtils.clamp((erase - (1 - position)) / .12, 0, 1);
        node.style.setProperty('--branch-progress', growing * (1 - removing));
      }
    },
  };
}
