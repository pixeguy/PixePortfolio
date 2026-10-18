import * as THREE from 'three';

// Scroll distances in viewport heights; each clip gets a share based on its duration.
export const PURPLE_SEQUENCE = { entrySpace: 4, exitLead: .85, jogTransitionSpace: .585, contactSpace: 1.2, poseBlend: .65, typeInterval: .08, eraseInterval: .045 };

export function createPurpleSequence(fbx, mixer, section) {
  const actions = {};
  for (const name of ['Floor', 'Floor To Stand', 'Stand To Sit', 'Sit To Type', 'Typing', 'Type To Sit', 'Sit To Stand', 'Standing', 'Jogging']) {
    const clip = fbx.animations.find(item => item.name.split('|').pop().toLowerCase() === name.toLowerCase());
    if (!clip) throw new Error(`Missing animation: ${name}`);
    actions[name] = mixer.clipAction(clip);
  }
  const entering = ['Floor To Stand', 'Stand To Sit', 'Sit To Type'];
  const exiting = ['Type To Sit', 'Sit To Stand'];
  const sequenceDuration = sequence => sequence.reduce((sum, name) => sum + actions[name].getClip().duration, 0)
    + (sequence.length + 1) * PURPLE_SEQUENCE.poseBlend;
  const revealProgress = (actions['Floor To Stand'].getClip().duration + actions['Stand To Sit'].getClip().duration
    + 2 * PURPLE_SEQUENCE.poseBlend) / sequenceDuration(entering);
  const typeToSitEnd = (actions['Type To Sit'].getClip().duration + PURPLE_SEQUENCE.poseBlend) / sequenceDuration(exiting);
  // Match entry's scroll distance per animation second, including pose bridges.
  const exitSpace = (PURPLE_SEQUENCE.entrySpace - .5) / sequenceDuration(entering)
    * (actions['Sit To Stand'].getClip().duration + 2 * PURPLE_SEQUENCE.poseBlend);
  const stage = section.querySelector('.section-gallery-stage');
  stage.style.paddingTop = `${(.5 + (PURPLE_SEQUENCE.entrySpace - .5) * revealProgress) * 100}svh`;
  const bottomSpace = .3;
  stage.style.paddingBottom = `${bottomSpace * 100}svh`;
  // Allow the standing and jogging transitions to finish in the next section.
  document.querySelector('#nebula-return').style.minHeight = `${(exitSpace - bottomSpace + PURPLE_SEQUENCE.jogTransitionSpace + PURPLE_SEQUENCE.contactSpace + 1) * 100}svh`;
  const contact = document.querySelector('#contact-heading');
  const contactText = contact.firstElementChild;
  const contactContent = 'Contact me';
  const gallery = section.querySelector('#photo-gallery');
  const heading = section.querySelector('#section-scroll-title');
  const headingText = heading.firstElementChild;
  const mobileLayout = window.matchMedia('(max-width: 1024px)');
  const galleryPhotos = [...stage.querySelectorAll('.section-gallery figure')];
  const quote = section.querySelector('#section-transition-quote');
  const quoteText = quote.firstElementChild;
  const quoteContent = 'Make Games,\nPlay Games,\nSleep,\nRepeat';
  let liftFactor = 1, current = null;
  let displayedTitle = '', desiredTitle = '', count = 0, titlePhase = 'idle', titleClock = 0;

  function select(name, loop) {
    const action = actions[name];
    if (current !== action || action.paused === loop) {
      const resumeTime = action.time;
      action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1).play();
      action.clampWhenFinished = true;
      if (loop) action.time = resumeTime % action.getClip().duration;
    }
    current = action;
    for (const other of Object.values(actions)) other.setEffectiveWeight(other === action ? 1 : 0);
    action.paused = !loop;
    return action;
  }

  function scrub(sequence, progress, from, to) {
    const segments = [];
    let previous = from;
    // Freeze the outgoing idle at its current pose, then interpolate every bone
    // into the next clip. These bridges are scrubbed in both scroll directions.
    let previousTime = actions[from].time;
    for (const name of sequence) {
      segments.push({ duration: PURPLE_SEQUENCE.poseBlend, from: previous, fromTime: previousTime, to: name });
      const duration = actions[name].getClip().duration;
      segments.push({ duration, clip: name });
      previous = name;
      previousTime = duration;
    }
    segments.push({ duration: PURPLE_SEQUENCE.poseBlend, from: previous, fromTime: previousTime, to });
    let time = progress * segments.reduce((sum, segment) => sum + segment.duration, 0);
    let segment = segments[segments.length - 1];
    for (const candidate of segments) {
      segment = candidate;
      if (time <= candidate.duration) break;
      time -= candidate.duration;
    }
    for (const action of Object.values(actions)) action.setEffectiveWeight(0);
    const poseLift = (name, poseTime) => name === 'Floor' ? 1
      : name === 'Floor To Stand' ? 1 - poseTime / actions[name].getClip().duration : 0;
    function sample(name, poseTime, weight) {
      const action = actions[name];
      action.enabled = true;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      action.time = poseTime;
      action.setEffectiveWeight(weight);
    }
    if (segment.clip) {
      sample(segment.clip, time, 1);
      liftFactor = poseLift(segment.clip, time);
    } else {
      const blend = THREE.MathUtils.smoothstep(time / segment.duration, 0, 1);
      sample(segment.from, segment.fromTime, 1 - blend);
      sample(segment.to, 0, blend);
      liftFactor = THREE.MathUtils.lerp(poseLift(segment.from, segment.fromTime), poseLift(segment.to, 0), blend);
    }
    current = null;
    mixer.update(0);
  }

  // Scroll chooses the next title; finish each typing/erasing pass before switching.
  function updateHeading(delta) {
    if (titlePhase === 'idle' && displayedTitle !== desiredTitle) {
      if (count) titlePhase = 'erase';
      else { displayedTitle = desiredTitle; titlePhase = displayedTitle ? 'type' : 'idle'; }
    }
    titleClock += delta;
    while (titlePhase !== 'idle') {
      const interval = titlePhase === 'type' ? PURPLE_SEQUENCE.typeInterval : PURPLE_SEQUENCE.eraseInterval;
      if (titleClock < interval) break;
      titleClock -= interval;
      if (titlePhase === 'type') {
        count++;
        if (count >= displayedTitle.length) { count = displayedTitle.length; titlePhase = 'idle'; }
      } else if (--count <= 0) {
        count = 0; displayedTitle = desiredTitle;
        titlePhase = displayedTitle ? 'type' : 'idle';
      }
    }
    if (titlePhase === 'idle') titleClock = 0;
    headingText.textContent = displayedTitle.slice(0, count);
    heading.hidden = count === 0;
  }

  return {
    get active() { return section.getBoundingClientRect().top <= window.innerHeight * .5; },
    get liftFactor() { return liftFactor; },
    update(delta) {
      const height = window.innerHeight;
      const bounds = section.getBoundingClientRect();
      const galleryBounds = gallery.getBoundingClientRect();
      const entry = THREE.MathUtils.clamp((height * .5 - bounds.top) / ((PURPLE_SEQUENCE.entrySpace - .5) * height), 0, 1);
      // Anticipate the last image leaving: Type To Sit ends at its bottom edge
      // crossing the viewport top. Sit To Stand uses the short remaining padding.
      const exit = galleryBounds.bottom > 0
        ? typeToSitEnd * THREE.MathUtils.clamp(
          (height * PURPLE_SEQUENCE.exitLead - galleryBounds.bottom) / (height * PURPLE_SEQUENCE.exitLead), 0, 1)
        : typeToSitEnd + (1 - typeToSitEnd)
          * THREE.MathUtils.clamp(-galleryBounds.bottom / (exitSpace * height), 0, 1);
      const joggingProgress = THREE.MathUtils.clamp(
        (-galleryBounds.bottom / height - exitSpace) / PURPLE_SEQUENCE.jogTransitionSpace, 0, 1);
      let phase;
      if (bounds.top > height * .5) {
        phase = 'floor'; liftFactor = 1; current = null;
        // The hero controller owns the three original clips above this section.
        for (const name of ['Stand To Sit', 'Sit To Type', 'Typing', 'Type To Sit', 'Sit To Stand', 'Jogging']) {
          actions[name].setEffectiveWeight(0);
        }
        mixer.update(0);

      }
      else if (entry < 1) { phase = 'enter'; scrub(entering, entry, 'Floor', 'Typing'); }
      else if (exit > 0 && exit < 1) { phase = 'exit'; scrub(exiting, exit, 'Typing', 'Standing'); }
      else if (exit >= 1 && joggingProgress < 1) {
        phase = 'jog-transition';
        // No separate transition FBX was supplied: scrub an interpolated pose
        // bridge from standing into the opening jogging pose.
        scrub([], joggingProgress, 'Standing', 'Jogging');
      }
      else {
        phase = exit >= 1 ? 'jogging' : 'typing';
        liftFactor = 0;
        select(phase === 'jogging' ? 'Jogging' : 'Typing', true);
        mixer.update(delta);
      }
      const contactCount = Math.floor(contactContent.length * joggingProgress);
      contactText.textContent = contactContent.slice(0, contactCount);
      contact.hidden = contactCount === 0;
      const contentReady = entry >= revealProgress;
      // Type the quote during the entrance, then backspace it before
      // the gallery appears. Scrolling backwards restores the same letters.
      const quoteProgress = Math.min(
        THREE.MathUtils.clamp((entry - .08) / .28, 0, 1),
        1 - THREE.MathUtils.clamp((entry - revealProgress * .72) / (revealProgress * .28), 0, 1));
      const quoteCount = Math.floor(quoteContent.length * quoteProgress);
      quoteText.textContent = quoteContent.slice(0, quoteCount);
      quote.hidden = quoteCount === 0 || bounds.top > height * .5 || contentReady;
      stage.classList.toggle('is-visible', contentReady);
      // Clear the heading when the last image passes its screen position,
      // rather than waiting for the image to leave the viewport entirely.
      const headingY = parseFloat(getComputedStyle(heading).top) || 0;
      desiredTitle = contentReady && galleryBounds.bottom > headingY + height * .3
        ? (galleryBounds.top <= height * .65 ? 'Gallery' : 'Achievements') : '';
      updateHeading(delta);
      if (mobileLayout.matches && contentReady) {
        // Mask only the portion approaching/passing behind the fixed heading;
        // lower parts stay visible instead of fading the entire photograph.
        const titleBottom = headingY + (heading.offsetHeight || 40);
        for (const photo of galleryPhotos) {
          const top = photo.getBoundingClientRect().top;
          photo.style.setProperty('--photo-mask-start', `${Math.max(0, titleBottom + 12 - top)}px`);
          photo.style.setProperty('--photo-mask-end', `${Math.max(0, titleBottom + 48 - top)}px`);
        }
      }
      if (bounds.bottom < 0 || bounds.top > height) heading.hidden = true;
    },
  };
}

