import * as THREE from 'three';

export function createFightingSequence(fbx, mixer, timing) {
  const actions = Object.fromEntries(fbx.animations.map(clip => [clip.name.split('|').pop(), mixer.clipAction(clip)]));
  for (const name of ['Standing', 'Stand To Fight', 'Fighting Idle', 'Fight To Stand']) {
    if (!actions[name]) throw new Error(`Missing animation: ${name}`);
  }
  const blendDuration = .65;
  function pose(name, time, weight) {
    const action = actions[name];
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
    action.paused = true;
    action.time = time;
    action.setEffectiveWeight(weight);
  }
  function scrub(from, transition, to, progress) {
    const duration = actions[transition].getClip().duration;
    const time = progress * (duration + 2 * blendDuration);
    if (time < blendDuration) {
      const blend = THREE.MathUtils.smoothstep(time / blendDuration, 0, 1);
      pose(from, actions[from].time, 1 - blend);
      pose(transition, 0, blend);
    } else if (time <= blendDuration + duration) {
      pose(transition, time - blendDuration, 1);
    } else {
      const blend = THREE.MathUtils.smoothstep((time - blendDuration - duration) / blendDuration, 0, 1);
      pose(transition, duration, 1 - blend);
      pose(to, 0, blend);
    }
    mixer.update(0);
  }
  return {
    update(scroll, delta) {
      const enterEnd = timing.start + timing.enterDuration;
      const exitStart = enterEnd + timing.idleDuration;
      const exitEnd = exitStart + timing.exitDuration;
      if (scroll < timing.start || scroll >= exitEnd) {
        for (const name of ['Stand To Fight', 'Fighting Idle', 'Fight To Stand']) actions[name].setEffectiveWeight(0);
        return false;
      }
      for (const action of Object.values(actions)) action.setEffectiveWeight(0);
      if (scroll < enterEnd) {
        scrub('Standing', 'Stand To Fight', 'Fighting Idle', (scroll - timing.start) / timing.enterDuration);
      } else if (scroll < exitStart) {
        const action = actions['Fighting Idle'];
        action.enabled = true;
        action.clampWhenFinished = false;
        action.setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
        action.paused = false;
        mixer.update(delta);
      } else {
        scrub('Fighting Idle', 'Fight To Stand', 'Standing', (scroll - exitStart) / timing.exitDuration);
      }
      return true;
    },
  };
}
