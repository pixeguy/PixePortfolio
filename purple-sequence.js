import * as THREE from 'three';

// Scroll distances in viewport heights; each clip gets a share based on its duration.
export const PURPLE_SEQUENCE = { entrySpace: 4, exitSpace: .7, poseBlend: .65, typeInterval: .08, eraseInterval: .045 };

export function createPurpleSequence(fbx, mixer, section) {
  const actions = {};
  for (const name of ['Floor', 'Floor To Stand', 'Stand To Sit', 'Sit To Type', 'Typing', 'Type To Sit', 'Sit To Stand', 'Standing']) {
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
  const hideProgress = (actions['Type To Sit'].getClip().duration + PURPLE_SEQUENCE.poseBlend) / sequenceDuration(exiting);
  const stage = section.querySelector('.section-gallery-stage');
  stage.style.paddingTop = `${(.5 + (PURPLE_SEQUENCE.entrySpace - .5) * revealProgress) * 100}svh`;
  stage.style.paddingBottom = `${PURPLE_SEQUENCE.exitSpace * 100}svh`;
  const gallery = section.querySelector('#photo-gallery');
  const heading = section.querySelector('#section-scroll-title');
  const headingText = heading.firstElementChild;
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
      const exit = THREE.MathUtils.clamp((height * .85 - galleryBounds.bottom) / (PURPLE_SEQUENCE.exitSpace * height), 0, 1);
      let phase;
      if (bounds.top > height * .5) {
        phase = 'floor'; liftFactor = 1; current = null;
        // The hero controller owns the three original clips above this section.
        for (const name of ['Stand To Sit', 'Sit To Type', 'Typing', 'Type To Sit', 'Sit To Stand']) {
          actions[name].setEffectiveWeight(0);
        }
        mixer.update(0);

      }
      else if (entry < 1) { phase = 'enter'; scrub(entering, entry, 'Floor', 'Typing'); }
      else if (exit > 0 && exit < 1) { phase = 'exit'; scrub(exiting, exit, 'Typing', 'Standing'); }
      else {
        phase = exit >= 1 ? 'standing' : 'typing';
        liftFactor = 0;
        select(phase === 'standing' ? 'Standing' : 'Typing', true);
        mixer.update(delta);
      }
      const contentVisible = entry >= revealProgress && exit < hideProgress;
      stage.classList.toggle('is-visible', contentVisible);
      desiredTitle = contentVisible
        ? (galleryBounds.top <= height * .65 ? 'Gallery' : 'Achievements') : '';
      updateHeading(delta);
      if (bounds.bottom < 0 || bounds.top > height) heading.hidden = true;
    },
  };
}

