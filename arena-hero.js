import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const CHARACTER_HEIGHT = 1.8;
const FLOOR_Y = .058;
const CHARACTER_Z = .170972;
// Scroll distances are viewport heights. The paragraph starts after arrival.
export const ARENA_JOURNEY = { start: .15, aligned: 1.15, firstRing: 2, secondRing: 4.25, end: 5.5, fadeStart: 7.35, fadeEnd: 8.1 };
const MOTION_DEFAULTS = { rockAmount: 2.2, rockSpeed: 1.8, rockSpin: 2, grassAmount: 2.5, grassSpeed: 1.35 };

function runeLightControls() {
  const defaults={rings:2,railings:3,cracks:1,reach:1,fogStart:7,fogRange:24};
  const values={...defaults};
  const panel=document.createElement('details');panel.className='lettering-controls arena-light-controls';panel.hidden=true;
  const summary=document.createElement('summary');summary.textContent='Rune lighting';panel.append(summary);
  const rows=[];
  for(const [key,title,min,max,step] of [['rings','Ring light',0,4,.05],['railings','Railing light',0,4,.05],['cracks','Crack light',0,4,.05],['reach','Light reach',.5,2.5,.05],['fogStart','Fog start',0,30,.5],['fogRange','Fog distance',5,100,1]]) {
    const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=title;
    const input=document.createElement('input');input.type='range';input.id=`rune-light-${key}`;
    input.min=min;input.max=max;input.step=step;input.value=values[key];label.htmlFor=input.id;
    const output=document.createElement('output');output.htmlFor=input.id;
    const update=()=>{values[key]=Number(input.value);output.textContent=key.startsWith('fog')?values[key].toFixed(1):`${values[key].toFixed(2)}×`;};
    input.addEventListener('input',update);update();label.append(caption,input,output);panel.append(label);rows.push({key,input,update});
  }
  const footer=document.createElement('div');footer.className='lettering-controls-footer';
  const note=document.createElement('small');note.textContent='Fog distance: lower means thicker haze. Light sliders affect nearby surfaces. Reload restores these defaults.';
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset lights';
  reset.addEventListener('click',()=>rows.forEach(({key,input,update})=>{input.value=defaults[key];update();}));
  footer.append(note,reset);panel.append(footer);panel.addEventListener('wheel',event=>event.stopPropagation());
  document.querySelector('#viewer').append(panel);return {values,panel};
}

function corners(box) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
    for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}
function projectedBounds(points, camera) {
  camera.updateMatrixWorld();
  const p = points.map(point => point.clone().project(camera));
  return {
    x: (Math.min(...p.map(v => v.x)) + Math.max(...p.map(v => v.x))) / 4 + .5,
    y: (Math.min(...p.map(v => v.y)) + Math.max(...p.map(v => v.y))) / 4 + .5,
    height: (Math.max(...p.map(v => v.y)) - Math.min(...p.map(v => v.y))) / 2,
  };
}

// The existing Canvas backgrounds remain visible through this scene's sky.
export function createArenaHero(renderer, outlines, onProgress) {
  const scene = new THREE.Scene();
  // Preserve nearby silhouettes; progressively wash distant detail into the sky.
  scene.fog = new THREE.Fog(0x100e20, 7, 31);
  const camera = new THREE.PerspectiveCamera(38, 1, .025, 180);
  camera.layers.enable(1);
  const characterRoot = new THREE.Group();
  characterRoot.rotation.y = THREE.MathUtils.degToRad(-10);
  scene.add(characterRoot);
  // A +0.30 environment lift keeps shaded ruins readable without increasing
  // the warm magical sources. Cool rear illumination reaches distant towers.
  scene.add(new THREE.HemisphereLight(0x8b85d0, 0x30223f, .38));
  const blueSky = new THREE.DirectionalLight(0x8498ff, .48);
  blueSky.position.set(-4,7,5);scene.add(blueSky);
  const pinkSky = new THREE.DirectionalLight(0xaaa0d9, .12);
  pinkSky.position.set(5,5,-5);scene.add(pinkSky);
  // Local warmth reaches the main platform/columns without recolouring the
  // distant towers, whose cool sky illumination remains unchanged.
  const warmFront = new THREE.PointLight(0xffcf92, 1.7, 7, 2);
  warmFront.position.set(-2,2.6,1.5);scene.add(warmFront);
  const roseBounce = new THREE.PointLight(0xffd19a, .65, 6, 2);
  roseBounce.position.set(1.5,1.8,1);scene.add(roseBounce);
  const lighting=runeLightControls(), runeLights=[];
  const ringBounce={value:1};
  function trackLight(light,group) {
    runeLights.push({light,group,intensity:light.intensity,distance:light.distance});
  }
  trackLight(warmFront,'rings');trackLight(roseBounce,'rings');
  let placement, motion, localBounds, legacyCamera, width = 1, height = 1, loaded = false;
  let environment;
  const openingPosition = new THREE.Vector3(), openingRotation = new THREE.Quaternion();
  const travelRotation = new THREE.Quaternion(), lookCamera = new THREE.PerspectiveCamera();
  let openingOffset = { x: 0, y: 0 };
  const floatingRocks = [];
  const grassTime = { value: 0 }, grassMotion = { value: 1 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionSettings = { ...MOTION_DEFAULTS };
  let lastEnvironmentTime = null, rockTime = 0, windTime = 0, rotationTime = 0;
  const spin = new THREE.Euler(), spinQuaternion = new THREE.Quaternion();

  function animateEnvironment(time) {
    const enabled = !reducedMotion.matches;
    const delta = lastEnvironmentTime === null ? 0 : Math.min(.1, Math.max(0,time-lastEnvironmentTime));
    lastEnvironmentTime = time;
    if (enabled) {
      rockTime += delta * motionSettings.rockSpeed;
      windTime += delta * motionSettings.grassSpeed;
      rotationTime += delta * motionSettings.rockSpin;
    }
    grassTime.value = windTime;
    grassMotion.value = enabled ? motionSettings.grassAmount : 0;
    for (const rock of floatingRocks) {
      rock.object.position.copy(rock.position);
      rock.object.quaternion.copy(rock.rotation);
      if (!enabled) continue;
      const phase = rock.phase;
      const amount = rock.drift * motionSettings.rockAmount;
      rock.object.position.x += Math.sin(rockTime * .105 + phase) * amount;
      rock.object.position.y += Math.sin(rockTime * .13 + phase * 1.3) * amount * .8;
      rock.object.position.z += Math.cos(rockTime * .085 + phase) * amount * .65;
      spin.set(Math.sin(rotationTime * .08 + phase) * .035,
        rotationTime * (.007 + (phase % 3) * .002), Math.sin(rotationTime * .07 + phase) * .025);
      spinQuaternion.setFromEuler(spin);
      rock.object.quaternion.multiply(spinQuaternion);
    }
  }

  const base = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  base.samples = Math.min(4, renderer.capabilities.maxSamples);
  const glow = base.clone();
  glow.samples = 0;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .14, .45, 1.5);
  const copy = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: base.texture, depthTest: false, depthWrite: false, toneMapped: false }));
  const combine = new FullScreenQuad(new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { base: { value: base.texture }, glow: { value: glow.texture }, opacity: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D base; uniform sampler2D glow; uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec4 surface = texture2D(base, vUv);
        vec3 light = texture2D(glow, vUv).rgb;
        vec3 halo = max(light - surface.rgb, vec3(0.));
        float alpha = clamp(max(surface.a, max(halo.r, max(halo.g, halo.b)) * .65), 0., 1.);
        gl_FragColor = vec4(light / max(alpha, .001), alpha * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));

  const ready = new GLTFLoader().loadAsync('./assets/poseidon-space-arena/arena.glb?v=20261026-depth-debris-purple', event => {
    if (event.total) onProgress?.(event.loaded / event.total);
  }).then(gltf => {
    environment = gltf.scene;
    environment.traverse(object => {
      // Blender's exporter converts watt-authored lights to photometric glTF
      // intensities. Calibrate that conversion for this RGB preview renderer.
      if (object.isLight) {
        // GLTFLoader converts authored spaces to underscores in node names.
        const source = `${object.name} ${object.parent?.name || ''}`.replaceAll('_',' ');
        const local = /character/i.test(source) ? .2 : /ring.*gold/i.test(source) ? 1
          : /pink.*ambience|rose.*reflected/i.test(source) ? .25
          : /fissure|second.*pillar|tower.*crack|rear tower rune spill/i.test(source) ? .65 : 1;
        object.intensity *= .0013 * local;
        if (/rear towers.*blue|distant blue ruin|rear towers.*lavender/i.test(source)) {
          object.intensity*=.92;
          // Reuse the broad rear sources for the violet midtone, avoiding an
          // additional LTC area-light evaluation on every stone fragment.
          object.color.lerp(new THREE.Color(0x8c80ce),.18);
        }
        if (/ring.*gold|walkway rune|rear magic|soft rune spill/i.test(source)) {
          object.color.setRGB(1,.84,.23);
        } else if (/pink.*ambience|rose.*reflected/i.test(source)) {
          object.color.setRGB(1,.72,.48);
        } else if (/fissure|second.*pillar|tower.*crack|rear tower rune spill/i.test(source)) {
          object.color.setRGB(1,.64,.36);
          object.position.z+=.65;object.position.y+=.4;
        }
        if (/walkway rune/i.test(source)) trackLight(object,'railings');
        else if (/fissure|second.*pillar|tower.*crack|soft rune spill rear pillar|rear tower rune spill/i.test(source)) trackLight(object,'cracks');
        else if (/ring.*gold|soft rune spill|character/i.test(source)) trackLight(object,'rings');
      }
      if (object.isMesh) {
        object.receiveShadow = true; object.castShadow = true;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if(material.emissiveMap) material.emissiveMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
          if (material.emissive && !material.userData.arenaEmissionCalibrated) {
            material.emissiveIntensity *= .45;
            if (/ring.*gradient|secondring.*gradient|floor.*gradient/i.test(material.name)) {
              material.emissive.setRGB(1,.78,.32);
            }
            // The original violet pigment absorbed almost all green light,
            // turning amber sources pink. Neutralize that response locally.
            if (/floor.*gradient/i.test(material.name)) material.color.setRGB(.46,.80,.34);
            else if (/ring.*gradient|secondring.*gradient/i.test(material.name)) {
              material.color.setRGB(.9,1.1,.85);
              // Rune light spills onto the surroundings; its own stone receives
              // soft ambient illumination without punctual-light hotspots.
              material.onBeforeCompile=shader=>{
                shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
                  '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= 0.0; reflectedLight.directSpecular *= 0.0;');
              };
              material.customProgramCacheKey=()=> 'arena-ring-ambient-v1';
              material.emissiveIntensity*=1.2;
            }
            material.userData.arenaEmissionCalibrated = true;
          }
        }
      }
      // Two broad moon sources cast shadows; local magic lights stay cheap.
      if (object.isSpotLight && /soft_upper_key|rear-left|soft upper key|rear_left/.test(object.name)) {
        object.castShadow = true;
        object.shadow.mapSize.set(1024, 1024);
        object.shadow.normalBias = .025;
      }
    });
    scene.add(environment);
    scene.updateMatrixWorld(true);
    environment.traverse(object => {
      if (object.userData.arenaMotion === 'rock') {
        const extent = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
        floatingRocks.push({ object, position: object.position.clone(), rotation: object.quaternion.clone(),
          phase: Number(object.userData.motionSeed || 0), drift: THREE.MathUtils.clamp(extent.length() * .1, .035, .14) });
        object.traverse(mesh=>{
          if(!mesh.isMesh)return;
          const litRock=original=>{
            const material=original.clone();
            material.onBeforeCompile=shader=>{
              shader.uniforms.runeBounceStrength=ringBounce;
              shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rockWorld;')
                .replace('#include <project_vertex>','#include <project_vertex>\nrockWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
              shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 rockWorld; uniform float runeBounceStrength;')
                .replace('#include <opaque_fragment>',`vec3 skyNormal=inverseTransformDirection(normal,viewMatrix);
                  float nearRing=min(length(rockWorld.xz-vec2(0.,-2.07)),length(rockWorld.xz-vec2(0.,-10.84)));
                  float warmBounce=exp(-nearRing*.22)*max(0.,-skyNormal.y);
                  float stoneValue=max(.065,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
                  outgoingLight+=stoneValue*(vec3(1.,.60,.19)*warmBounce*1.5*runeBounceStrength+vec3(.45,.55,1.)*max(0.,skyNormal.y)*1.15);
                  #include <opaque_fragment>`);
            };
            material.customProgramCacheKey=()=> 'arena-rock-sky-and-bounce-v1';return material;
          };
          mesh.material=Array.isArray(mesh.material)?mesh.material.map(litRock):litRock(mesh.material);
        });
      }
      if (object.userData.arenaMotion !== 'grass') return;
      const phase = Number(object.userData.motionSeed || 0);
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox;
        const windMaterial = original => {
          const material = original.clone();
          material.onBeforeCompile = shader => {
            shader.uniforms.arenaGrassTime = grassTime;
            shader.uniforms.arenaGrassMotion = grassMotion;
            shader.uniforms.arenaGrassPhase = { value: phase };
            shader.uniforms.arenaGrassBase = { value: bounds.min.y };
            shader.uniforms.arenaGrassHeight = { value: Math.max(.1, bounds.max.y - bounds.min.y) };
            shader.vertexShader = shader.vertexShader.replace('#include <common>', `
              #include <common>
              uniform float arenaGrassTime, arenaGrassMotion, arenaGrassPhase;
              uniform float arenaGrassBase, arenaGrassHeight;
            `).replace('#include <begin_vertex>', `
              #include <begin_vertex>
              float tip = clamp((position.y - arenaGrassBase) / arenaGrassHeight, 0.0, 1.0);
              float wind = arenaGrassTime * .62 + arenaGrassPhase + position.x * 1.4;
              transformed.x += sin(wind + tip * .7) * .035 * tip * tip * arenaGrassMotion;
              transformed.z += sin(wind * .73 + 1.2) * .018 * tip * tip * arenaGrassMotion;
            `);
          };
          material.customProgramCacheKey = () => 'arena-anchored-grass-wind-v1';
          return material;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(windMaterial) : windMaterial(mesh.material);
      });
    });
    loaded = true;
    onProgress?.(1);
  });

  function layout() {
    if (!localBounds || !legacyCamera) return;
    const aspect = width / height;
    // Recreate the original site's unscrolled placement, including compact layouts.
    const viewWidth = 2 * legacyCamera.position.length()
      * Math.tan(THREE.MathUtils.degToRad(legacyCamera.fov / 2)) * aspect;
    let offset = THREE.MathUtils.clamp((aspect - .45) * 1.15, .12, 1.5);
    if (width <= 1024) offset = Math.max(offset, viewWidth * .29);
    const shift = new THREE.Vector3(1, 0, 0).applyQuaternion(legacyCamera.quaternion).multiplyScalar(offset);
    const target = projectedBounds(corners(localBounds).map(p => p.add(shift)), legacyCamera);
    // Keep the original horizontal view of the animated FBX; only lower the
    // viewpoint. Its authored forward axis differs from the static preview.
    characterRoot.rotation.y = -Math.atan2(legacyCamera.position.x, legacyCamera.position.z) - .08;
    const center = localBounds.getCenter(new THREE.Vector3());
    const scale = CHARACTER_HEIGHT / localBounds.getSize(new THREE.Vector3()).y;
    characterRoot.scale.setScalar(scale);
    characterRoot.position.set(-center.x * scale, FLOOR_Y - localBounds.min.y * scale, CHARACTER_Z - center.z * scale);
    characterRoot.updateMatrixWorld(true);
    const points = corners(localBounds).map(p => p.applyMatrix4(characterRoot.matrixWorld));
    const focus = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    camera.aspect = aspect;
    camera.clearViewOffset();
    let distance = 3.8;
    // Fit screen occupancy while preserving an eye height near the ground.
    for (let i = 0; i < 12; i++) {
      camera.position.set(-.35, .22, CHARACTER_Z + distance);
      camera.lookAt(focus);
      camera.updateProjectionMatrix();
      const current = projectedBounds(points, camera);
      distance *= THREE.MathUtils.clamp(current.height / target.height, .65, 1.5);
    }
    camera.position.set(-.35, .22, CHARACTER_Z + distance);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    const current = projectedBounds(points, camera);
    camera.setViewOffset(width, height, (current.x - target.x) * width,
      (target.y - current.y) * height, width, height);
    camera.updateMatrixWorld();
    openingPosition.copy(camera.position);openingRotation.copy(camera.quaternion);
    openingOffset = { x: camera.view.offsetX, y: camera.view.offsetY };
  }

  function updateJourney(scroll) {
    const j = ARENA_JOURNEY;
    const align = THREE.MathUtils.smoothstep(scroll, j.start, j.aligned);
    // First remove the off-axis hero framing, rising to the large aperture's
    // centre before travelling forward. No sideways drift through either ring.
    const aligned = new THREE.Vector3(0, 1.30083, .65);
    camera.position.lerpVectors(openingPosition, aligned, align);
    lookCamera.position.copy(aligned);lookCamera.lookAt(0, 1.30083, -2.07);
    travelRotation.copy(lookCamera.quaternion);
    camera.quaternion.slerpQuaternions(openingRotation, travelRotation, align);
    camera.setViewOffset(width,height,openingOffset.x*(1-align),openingOffset.y*(1-align),width,height);
    if (scroll > j.aligned) {
      const waypoints = [
        [j.aligned, .65, 1.30083], [j.firstRing, -2.07, 1.30083],
        [j.secondRing, -10.84, .467856], [j.end, -15.2, -.32],
      ];
      let index = 0;
      while (index < waypoints.length-2 && scroll > waypoints[index+1][0]) index++;
      const a=waypoints[index], b=waypoints[index+1];
      const p=THREE.MathUtils.clamp((scroll-a[0])/(b[0]-a[0]),0,1);
      const ease=p*p*(3-2*p);
      camera.position.set(0,THREE.MathUtils.lerp(a[2],b[2],ease),THREE.MathUtils.lerp(a[1],b[1],p));
      // Level at each aperture, then gently look up at the ruins beyond it.
      const arrival=THREE.MathUtils.smoothstep(scroll,j.secondRing,j.end);
      lookCamera.position.set(0,-.32,-15.2);
      lookCamera.lookAt(.8,.5,-10.84);
      camera.quaternion.slerpQuaternions(travelRotation,lookCamera.quaternion,arrival);
    }
    camera.updateMatrixWorld();
  }

  return {
    ready,
    setCharacter(object, motionGroup, originalCamera) {
      placement = object; motion = motionGroup; legacyCamera = originalCamera;
      const previous = object.position.clone();
      object.position.set(0, 0, 0);object.updateMatrixWorld(true);
      localBounds = new THREE.Box3().setFromObject(object);
      object.position.copy(previous);object.updateMatrixWorld(true);
      object.traverse(child => { if (child.isMesh) child.castShadow = false; });
      layout();
    },
    resize(w, h) {
      width = w; height = h;
      const ratio = renderer.getPixelRatio();
      base.setSize(Math.round(w * ratio), Math.round(h * ratio));
      glow.setSize(base.width, base.height);
      bloom.setSize(Math.round(base.width / 2), Math.round(base.height / 2));
      layout();
    },
    opacity(scroll) { return loaded && placement ? 1 - THREE.MathUtils.smoothstep(scroll, ARENA_JOURNEY.fadeStart, ARENA_JOURNEY.fadeEnd) : 0; },
    render(opacity, time = performance.now(), scroll = 0) {
      lighting.panel.hidden=!loaded||opacity<=.05;
      if (!loaded || !placement || opacity <= 0) { lastEnvironmentTime = null;return; }
      for(const entry of runeLights) {
        entry.light.intensity=entry.intensity*lighting.values[entry.group];
        if(entry.distance>0) entry.light.distance=entry.distance*lighting.values.reach;
      }
      ringBounce.value=lighting.values.rings;
      scene.fog.near=lighting.values.fogStart;
      scene.fog.far=lighting.values.fogStart+lighting.values.fogRange;
      animateEnvironment(time / 1000);
      updateJourney(scroll);
      const parent = placement.parent;
      const position = placement.position.clone(), rotation = placement.quaternion.clone();
      const scale = placement.scale.clone(), motionPosition = motion.position.clone(), motionRotation = motion.quaternion.clone();
      const masks = [];
      const toneMapping = renderer.toneMapping;
      const autoClear = renderer.autoClear;
      try {
        characterRoot.add(placement);
        placement.position.set(0, 0, 0);placement.quaternion.identity();placement.scale.setScalar(1);
        motion.position.set(0, 0, 0);motion.quaternion.identity();
        placement.traverse(o => { if (o.isMesh) { masks.push([o, o.layers.mask]); o.layers.set(1); } });
        scene.updateMatrixWorld(true);
        renderer.toneMapping = THREE.NoToneMapping;
        // The character is drawn only by the normal-outline pass below. It
        // contributes no lit surface, fill, or solid shadow to this colour pass.
        camera.layers.set(0);
        renderer.setRenderTarget(base);renderer.clear();renderer.render(scene, camera);
        camera.layers.enable(1);
        renderer.setRenderTarget(glow);renderer.clear();copy.render(renderer);
        bloom.render(renderer, null, glow, 0, false);
        renderer.toneMapping = THREE.AgXToneMapping;
        renderer.setRenderTarget(null);renderer.autoClear = false;
        combine.material.uniforms.opacity.value = opacity;combine.render(renderer);
        const outlineOpacity=opacity*(1-THREE.MathUtils.smoothstep(scroll,.45,1.1));
        if(outlineOpacity>.001) {
          outlines.setOpacity(outlineOpacity);
          outlines.render(scene, camera, { clear: false, occluderLayer: 0, outlineLayer: 1 });
        }
      } finally {
        for (const [object, mask] of masks) object.layers.mask = mask;
        parent.add(placement);placement.position.copy(position);placement.quaternion.copy(rotation);placement.scale.copy(scale);
        motion.position.copy(motionPosition);motion.quaternion.copy(motionRotation);placement.updateMatrixWorld(true);
        renderer.toneMapping = toneMapping;renderer.autoClear = autoClear;renderer.setRenderTarget(null);
        camera.layers.enable(0);camera.layers.enable(1);
        outlines.setOpacity(1);
      }
    },
  };
}
