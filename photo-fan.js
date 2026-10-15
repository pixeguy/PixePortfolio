// Fixed right-pivot fan angles; hover changes translation only, never stacking.
export function createPhotoFans(root) {
  const listeners = new AbortController();
  const observers = [];
  for (const fan of root.querySelectorAll('[data-photo-fan]')) {
    const cards = [...fan.querySelectorAll('.photo-fan-card')];
    if (!cards.length) continue;
    const middle = Math.floor(cards.length / 2);
    let active = null;
    // Fixed centre-out stacking: hovering never changes depth order.
    cards.forEach((card, index) => {
      card.style.zIndex = String(cards.length - Math.abs(index - middle));
    });
    function layout() {
      const height = cards[0].clientHeight;
      const spacing = height * .38;
      // Reserve the same space for every hover state so Features never jumps.
      fan.style.height = `${Math.max(460, height * (cards.length * .38 + 1.8))}px`;
      cards.forEach((card, position) => {
        const relative = position - (active ?? middle);
        const baseRow = (position - middle) * spacing;
        const arc = cards.length > 1 ? Math.sin(position / (cards.length - 1) * Math.PI) : 1;
        // Preserve both ends' resting coordinates, protruding only the inner
        // cards leftward. Endpoints also resist vertical hover displacement.
        const mobility = .06 + .94 * arc * arc;
        let row = baseRow;
        if (active !== null && relative !== 0) {
          // Open extra space around the hovered card, compressing
          // the remaining cards on each side. Never raise a card's stacking order.
          const expandedRow = (active - middle) * spacing + Math.sign(relative)
            * (height * .78 + (Math.abs(relative) - 1) * spacing * .6);
          row = baseRow + (expandedRow - baseRow) * mobility;
        }
        // These angles never depend on selection. Upper/lower cards curve
        // rightward, away from the model column on the left.
        card.style.setProperty('--fan-angle', `${-(position - middle) * 9}deg`);
        card.style.setProperty('--fan-row', `${row}px`);
        card.style.setProperty('--fan-scale', '1');
        const restShift = -cards[0].clientWidth * .1 * arc;
        const hoverShift = position === active ? -Math.min(28, cards[0].clientWidth * .07) : 0;
        card.style.setProperty('--fan-shift', `${restShift + hoverShift}px`);
        card.setAttribute('aria-pressed', String(position === active));
      });
    }
    function select(index) {
      if (active === index) return;
      active = index;
      layout();
    }
    layout();
    const resize = new ResizeObserver(layout);
    resize.observe(cards[0]);
    observers.push(resize);
    fan.addEventListener('pointerleave', () => {
      const focused = cards.indexOf(document.activeElement);
      select(focused < 0 ? null : focused);
    }, { signal: listeners.signal });
    cards.forEach((card, index) => {
      card.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch') select(index);
      }, { signal: listeners.signal });
      card.addEventListener('focus', () => select(index), { signal: listeners.signal });
      card.addEventListener('click', () => select(index), { signal: listeners.signal });
      card.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
          : Math.max(0, Math.min(cards.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        cards[next].focus({ preventScroll: true });
      }, { signal: listeners.signal });
    });
  }
  return { destroy() { listeners.abort(); observers.forEach(observer => observer.disconnect()); } };
}
