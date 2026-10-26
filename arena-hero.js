import { createCharacterParticles, PARTICLE_LAUNCH_SCROLL } from './character-particles.js?v=20261027-ground-project-cut';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const CHARACTER_HEIGHT = 1.8;
const FLOOR_Y = .058;
const CHARACTER_Z = .170972;
// Scroll distances are viewport heights. The paragraph starts after arrival.
export const ARENA_JOURNEY = { start: .15, aligned: PARTICLE_LAUNCH_SCROLL+.5, firstRing: 2.2, secondRing: 4.25, end: 5.5, timeline: 6.1, skills: 6.7, groundStart: 7.325, groundReach: 8.075, groundEnd: 8.675, fadeStart: 8.675, fadeEnd: 8.676 };
const MOTION_DEFAULTS = { rockAmount: 2.2, rockSpeed: 1.8, rockSpin: 2, grassAmount: 2.5, grassSpeed: 1.35 };

function hologramControls(){
  const defaults={size:.085,bands:716,detail:500,speed:18,refresh:30,brightness:1,duration:.25};
  const values={...defaults},rows=[];
  const panel=document.createElement('details');panel.className='lettering-controls hologram-controls';panel.hidden=true;
  const summary=document.createElement('summary');summary.textContent='Hologram glitch';panel.append(summary);
  for(const [key,title,min,max,step] of [
    ['size','Horizontal distortion',0,.3,.005],['bands','Band noise scale',20,1200,1],
    ['detail','Fine noise scale',10,1000,1],['speed','Flicker speed',1,60,1],
    ['refresh','Displacement refresh',1,60,1],['brightness','Noise brightness',0,3,.05],
    ['duration','Transition seconds',.15,1.5,.01]]){
    const label=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input'),output=document.createElement('output');
    caption.textContent=title;input.type='range';input.min=min;input.max=max;input.step=step;input.value=values[key];
    const update=()=>{values[key]=Number(input.value);output.textContent=values[key].toFixed(step<1?2:0);};
    input.addEventListener('input',update);update();label.append(caption,input,output);panel.append(label);rows.push({key,input,update});
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset glitch';
  reset.addEventListener('click',()=>rows.forEach(({key,input,update})=>{input.value=defaults[key];update();}));panel.append(reset);
  panel.addEventListener('wheel',event=>event.stopPropagation());document.querySelector('#viewer').append(panel);
  return {values,panel};
}

function runeLightControls() {
  const defaults={rings:2,railings:16,cracks:1,reach:1,fogStrength:.55,fogStart:7,fogRange:24};
  const values={...defaults};
  const panel=document.createElement('details');panel.className='lettering-controls arena-light-controls';panel.hidden=true;
  const summary=document.createElement('summary');summary.textContent='Rune lighting';panel.append(summary);
  const rows=[];
  const advanced=document.createElement('details'),advancedSummary=document.createElement('summary');
  advancedSummary.textContent='Fog distance settings';advanced.append(advancedSummary);
  for(const [key,title,min,max,step] of [['rings','Ring light',0,4,.05],['railings','Railing light',0,300,1],['cracks','Crack light',0,4,.05],['reach','Light reach',.5,2.5,.05],['fogStrength','Fog strength',0,1,.01],['fogStart','Clear until',0,30,.5],['fogRange','Fade over',5,100,1]]) {
    const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=title;
    const input=document.createElement('input');input.type='range';input.id=`rune-light-${key}`;
    input.min=min;input.max=max;input.step=step;input.value=values[key];label.htmlFor=input.id;
    const output=document.createElement('output');output.htmlFor=input.id;
    const update=()=>{values[key]=Number(input.value);output.textContent=key==='fogStrength'?`${Math.round(values[key]*100)}%`:key.startsWith('fog')?values[key].toFixed(1):`${values[key].toFixed(2)}×`;};
    input.addEventListener('input',update);update();label.append(caption,input,output);
    (key==='fogStart'||key==='fogRange'?advanced:panel).append(label);rows.push({key,input,update});
  }
  panel.append(advanced);
  const footer=document.createElement('div');footer.className='lettering-controls-footer';
    const note=document.createElement('small');note.textContent='Fog strength controls haze opacity. Clear until is the haze-free distance; Fade over controls how gradually haze builds (63% at that distance). Reload restores defaults.';
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

// Shader Graph translation: Simple Noise (three value-noise octaves), remap
// 0..1 to -1..1, multiply by Random Range(-size,size), add to position X.
// The second branch adds fine noise gated by Step(random, remapped sine).
const hologramGraphGLSL=`
  uniform float time,glitch,presence,glitchSize,bandScale,detailScale,flickerSpeed,refreshRate,noiseBrightness;
  float graphRandom(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  float graphValueNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(graphRandom(i),graphRandom(i+vec2(1.,0.)),f.x),
      mix(graphRandom(i+vec2(0.,1.)),graphRandom(i+vec2(1.,1.)),f.x),f.y);
  }
  float graphSimpleNoise(vec2 uv,float scale){
    return .125*graphValueNoise(uv*scale)+.25*graphValueNoise(uv*scale/2.)
      +.5*graphValueNoise(uv*scale/4.);
  }
  float graphOffset(float y){
    float signedNoise=graphSimpleNoise(vec2(y),bandScale)*2.-1.;
    float randomRange=mix(-glitchSize,glitchSize,graphRandom(vec2(floor(time*refreshRate),17.)));
    return signedNoise*randomRange*glitch;
  }
  float graphSignal(vec2 uv){
    float gate=step(graphRandom(vec2(time,3.)),sin(time*flickerSpeed)*.5+.5);
    return graphSimpleNoise(uv,detailScale)*gate*glitch*noiseBrightness;
  }
  void graphClip(float y){
    float band=graphRandom(vec2(floor(y*bandScale),floor(time*refreshRate)));
    if(presence<=0.||band>presence)discard;
  }
`;

function hologramUniforms(){
  return {glitch:{value:0},time:{value:0},presence:{value:0},glitchSize:{value:.085},
    bandScale:{value:716},detailScale:{value:500},flickerSpeed:{value:18},refreshRate:{value:30},noiseBrightness:{value:1}};
}

// Flat text on one world plane. The complete copy is rasterized once.
function createLecternContent() {
  const source=document.querySelector('.fighting-intro');
  const canvas=document.createElement('canvas');canvas.width=1536;
  const context=canvas.getContext('2d'),lines=[];let y=28;
  function paragraph(text,font,size,lineHeight,gap) {
    context.font=font;let line='';
    for(const word of text.trim().split(/\s+/)) {
      const next=line?`${line} ${word}`:word;
      if(line&&context.measureText(next).width>1460){lines.push({text:line,font,size,y});y+=lineHeight;line=word;}
      else line=next;
    }
    if(line){lines.push({text:line,font,size,y});y+=lineHeight;}y+=gap;
  }
  const heading=source.querySelector('h2');
  paragraph(heading.getAttribute('aria-label')||heading.textContent,'700 100px Arial',100,110,42);
  for(const p of source.querySelectorAll('p')) {
    const text=p.getAttribute('aria-label')||p.textContent;
    for(const part of text.split(/\n\s*\n/))paragraph(part,'400 48px Arial',48,70,36);
  }
  canvas.height=Math.ceil(y+16);
  context.textBaseline='top';context.fillStyle='#e8d78c';
  for(const line of lines){context.font=line.font;context.fillText(line.text,28,line.y);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  const material=new THREE.ShaderMaterial({transparent:false,depthWrite:true,
    toneMapped:false,side:THREE.DoubleSide,
    uniforms:{map:{value:texture},...hologramUniforms()},
    vertexShader:`${hologramGraphGLSL.replace(/  void graphClip[\s\S]*$/, '')}
      varying vec2 textUv;varying float graphY;
      void main(){textUv=uv;vec4 world=modelMatrix*vec4(position,1.);graphY=world.y;
        world.x+=graphOffset(graphY);gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`${hologramGraphGLSL}
      uniform sampler2D map;varying vec2 textUv;varying float graphY;
      void main(){
        graphClip(graphY);
        vec4 glyph=texture2D(map,textUv);if(glyph.a<.5)discard;
        gl_FragColor=vec4(glyph.rgb+vec3(graphSignal(textUv)),1.);
        #include <colorspace_fragment>
      }`});
  const panelWidth=1.35,panelHeight=panelWidth*canvas.height/canvas.width;
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(panelWidth,panelHeight,1,256),material);
  plane.name='Introduction • flat text above the book';
  plane.position.set(0,.90+panelHeight/2,-17.4);plane.visible=false;
  return plane;
}

function createLecternTimeline(content){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=content.material.uniforms.map.value.image.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle=ctx.strokeStyle='#e8d78c';ctx.textBaseline='top';
  const section=document.querySelector('.journey-timeline'),copy=element=>element.getAttribute('aria-label')||element.textContent;
  ctx.font='700 100px Arial';ctx.fillText(copy(section.querySelector('h3')),28,28);
  const entries=[...section.querySelectorAll('li')],start=245,spacing=245;
  ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(62,190);ctx.lineTo(62,start+(entries.length-1)*spacing+65);ctx.stroke();
  entries.forEach((entry,i)=>{
    const y=start+i*spacing;ctx.beginPath();ctx.arc(62,y+27,12,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(62,y+27);ctx.lineTo(160,y+27);ctx.stroke();
    ctx.font='700 64px Arial';ctx.fillText(copy(entry.querySelector('h4')),190,y);
    ctx.font='400 46px Arial';ctx.fillText(copy(entry.querySelector('p')),190,y+85);
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const plane=new THREE.Mesh(content.geometry,content.material.clone());plane.material.uniforms.map.value=texture;
  plane.position.copy(content.position);plane.renderOrder=3;plane.visible=false;plane.name='Book • world-space career timeline';return plane;
}

function createLecternSkills(content){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=content.material.uniforms.map.value.image.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e8d78c';ctx.textBaseline='top';
  const section=document.querySelector('#skills-section'),copy=element=>element.getAttribute('aria-label')||element.textContent;
  ctx.font='700 100px Arial';ctx.fillText(copy(section.querySelector('h3')),28,28);
  let y=210;
  for(const group of section.querySelectorAll('.skills-groups > div')){
    ctx.font='700 58px Arial';ctx.fillText(copy(group.querySelector('dt')),28,y);
    ctx.font='400 44px Arial';let line='',row=y+76;
    for(const item of group.querySelectorAll('li')){
      const word=copy(item).replace(/[,·]\s*$/,'').trim(),next=line?`${line}  ·  ${word}`:word;
      if(ctx.measureText(next).width>1450){ctx.fillText(line,28,row);row+=58;line=word;}else line=next;
    }
    ctx.fillText(line,28,row);y=row+110;
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const plane=new THREE.Mesh(content.geometry,content.material.clone());plane.material.uniforms.map.value=texture;
  plane.position.copy(content.position);plane.renderOrder=3;plane.visible=false;plane.name='Book • world-space skills';return plane;
}

function createBookHologram(content) {
  const {width,height}=content.geometry.parameters;
  // The projection stops below the content, leaving the text above the V.
  const top=content.position.y-height/2-.015,half=width/2+.025;
  // A padded quad lets the soft sides and displaced scan bands extend beyond
  // the nominal V rather than being clipped by a hard triangle boundary.
  const geometry=new THREE.PlaneGeometry(half*2.3,top-.58,1,192);
  const vertices=geometry.attributes.position,uvs=geometry.attributes.uv;
  for(let i=0;i<vertices.count;i++){
    const h=uvs.getY(i);
    vertices.setY(i,.58+h*(top-.58));vertices.setZ(i,THREE.MathUtils.lerp(-17.39,-17.435,h));
    uvs.setX(i,uvs.getX(i)*1.15-.075);
  }
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    side:THREE.DoubleSide,toneMapped:false,uniforms:{opacity:{value:1},...hologramUniforms()},
    vertexShader:`${hologramGraphGLSL.replace(/  void graphClip[\s\S]*$/, '')}
      varying vec2 beamUv;varying float graphY;
      void main(){beamUv=uv;vec4 world=modelMatrix*vec4(position,1.);graphY=world.y;
        world.x+=graphOffset(graphY);gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`${hologramGraphGLSL}
      uniform float opacity;varying vec2 beamUv;varying float graphY;
      void main(){
        graphClip(graphY);
        float h=beamUv.y,x=abs(beamUv.x*2.-1.);
        float distance=h-x;
        float inside=smoothstep(-.055,.09,distance);
        float centre=pow(clamp(1.-x/max(h,.001),0.,1.),.7);
        float fill=.42*exp(-h*2.7)*(.25+.75*centre)*inside;
        float edge=exp(-pow(distance/.045,2.));
        float rim=.22*exp(-h*2.)*edge;
        float fade=1.-smoothstep(.55,1.,h);
        float alpha=(fill+rim)*fade*opacity;
        if(alpha<.001)discard;
        vec3 yellow=vec3(1.,.78,.12)*(1.15+.25*edge+.65*exp(-h*12.));
        gl_FragColor=vec4(yellow+vec3(graphSignal(beamUv)),alpha);
        #include <colorspace_fragment>
      }`});
  const beam=new THREE.Mesh(geometry,material);
  beam.name='Book • fading golden hologram with distinct V edges';beam.visible=false;
  beam.renderOrder=2;content.renderOrder=3;
  return beam;
}

function createLecternRunes() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');ctx.strokeStyle='#ffe0a0';ctx.lineWidth=7;
  ctx.lineCap='round';ctx.lineJoin='round';
  const glyphs=[[[0,-18],[0,19],[-13,-4],[0,4],[13,-10]],
    [[-11,18],[0,-18],[12,18],[-7,5],[8,5]],
    [[-11,-18],[12,-10],[-7,4],[10,18]],
    [[0,18],[0,-18],[13,-5],[0,3]],
    [[0,-18],[13,0],[0,18],[-13,0],[0,-18]]];
  for(let i=0;i<16;i++) {
    const angle=i*Math.PI/8;ctx.save();ctx.translate(512+350*Math.cos(angle),512+350*Math.sin(angle));
    ctx.rotate(angle+Math.PI/2);ctx.beginPath();
    glyphs[i%glyphs.length].forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const material=new THREE.MeshBasicMaterial({map:texture,color:new THREE.Color(1,.64,.25).multiplyScalar(4.2),
    transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const circle=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.9),material);
  circle.name='Lectern • painted circular floor runes';circle.rotation.x=-Math.PI/2;
  circle.position.set(0,-.494,-17.4);return circle;
}

// The existing Canvas backgrounds remain visible through this scene's sky.
export function createArenaHero(renderer, outlines, onProgress) {
  const scene = new THREE.Scene();
  // Preserve nearby silhouettes; progressively wash distant detail into the sky.
  scene.fog = new THREE.Fog(0x24263f, 7, 31);
  const fogStrength={value:.55},fogMaterials=new WeakSet();
  const hazeNear={value:new THREE.Color(0x30243e)},hazeFar={value:new THREE.Color(0x535471)};
  function applyFog(material) {
    if(fogMaterials.has(material))return;fogMaterials.add(material);
    const compile=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
    const cacheKey=cache();
    material.onBeforeCompile=function(shader,...args) {
      compile.call(this,shader,...args);shader.uniforms.arenaFogStrength=fogStrength;
      shader.uniforms.arenaHazeNear=hazeNear;shader.uniforms.arenaHazeFar=hazeFar;
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float arenaFogStrength; uniform vec3 arenaHazeNear; uniform vec3 arenaHazeFar;')
        .replace('#include <fog_fragment>',THREE.ShaderChunk.fog_fragment
          .replace('smoothstep( fogNear, fogFar, vFogDepth )','1.0 - exp(-max(0.0, vFogDepth - fogNear) / max(0.001, fogFar - fogNear))')
          .replace('gl_FragColor.rgb = mix',`float hazeDistance=max(0.0,vFogDepth-fogNear)/max(.001,fogFar-fogNear);
            vec3 hazeColour=mix(arenaHazeNear,fogColor,smoothstep(0.0,1.0,hazeDistance));
            hazeColour=mix(hazeColour,arenaHazeFar,1.0-exp(-max(0.0,hazeDistance-.65)*.7));
            gl_FragColor.rgb = mix`)
          .replace('mix( gl_FragColor.rgb, fogColor,','mix( gl_FragColor.rgb, hazeColour,')
          .replace(/\bfogFactor\b(?=\s*\))/g,'clamp(fogFactor * arenaFogStrength,0.0,1.0)'));
    };
      material.customProgramCacheKey=()=>cacheKey+'-coloured-fog-v3';material.needsUpdate=true;
  }
  const camera = new THREE.PerspectiveCamera(38, 1, .025, 180);
  const letteringCamera=new THREE.PerspectiveCamera();
  camera.layers.enable(1);
  const characterRoot = new THREE.Group();
  characterRoot.rotation.y = THREE.MathUtils.degToRad(-10);
  scene.add(characterRoot);
  const arrivalCharacter=new THREE.Group();arrivalCharacter.name='Temporary courtyard character';
  arrivalCharacter.visible=false;scene.add(arrivalCharacter);
  const arrivalCamera=new THREE.PerspectiveCamera();
  const characterParticles=createCharacterParticles(scene);
  let arrivalMixer=null,arrivalTime=null,arrivalStanding=null,arrivalFighting=null;
  const contentPlane=createLecternContent();scene.add(contentPlane);
  const timelinePlane=createLecternTimeline(contentPlane);scene.add(timelinePlane);
  const skillsPlane=createLecternSkills(contentPlane);scene.add(skillsPlane);
  const bookHologram=createBookHologram(contentPlane);scene.add(bookHologram);
  const glitchControls=hologramControls();
  const pagePresence=[0,0,0];let beamPresence=0,hologramLastTime=null;
  // A +0.30 environment lift keeps shaded ruins readable without increasing
  // the warm magical sources. Cool rear illumination reaches distant towers.
  scene.add(new THREE.HemisphereLight(0x8b85d0, 0x30223f, .38));
  const blueSky = new THREE.DirectionalLight(0x8498ff, .48);
  blueSky.position.set(-4,7,5);scene.add(blueSky);
  const pinkSky = new THREE.DirectionalLight(0xaaa0d9, .12);
  pinkSky.position.set(5,5,-5);scene.add(pinkSky);
  // Local warmth reaches the main platform/columns without recolouring the
  // distant towers, whose cool sky illumination remains unchanged.
    const warmFront = new THREE.PointLight(0xffcf92, 1.7, 4.5, 2);
    warmFront.position.set(-1,1.7,-1.8);scene.add(warmFront);
    const roseBounce = new THREE.PointLight(0xffd19a, .65, 3.5, 2);
    roseBounce.position.set(1.2,1.3,-2.3);scene.add(roseBounce);
  const lighting=runeLightControls(), runeLights=[];
  const ringBounce={value:1};
  function trackLight(light,group) {
    // Adjust actual spill colour independently of painted rune emission.
    if(group==='rings')light.color.lerp(new THREE.Color(0xffe1b2),.08);
    runeLights.push({light,group,intensity:light.intensity,distance:light.distance});
  }
  trackLight(warmFront,'rings');trackLight(roseBounce,'rings');
  let placement, motion, localBounds, legacyCamera, width = 1, height = 1, loaded = false;
  let environment;
  const openingPosition = new THREE.Vector3(), openingRotation = new THREE.Quaternion();
  const travelRotation = new THREE.Quaternion(), lookCamera = new THREE.PerspectiveCamera();
  let openingOffset = { x: 0, y: 0 };
  const floatingRocks = [];
    const skySilhouettes=[];
    const silhouettePoint=new THREE.Vector3();
    function skyRegions() {
      const regions=[];
      for(const {object,points} of skySilhouettes) {
        let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
        for(const point of points) {
          silhouettePoint.copy(point).applyMatrix4(object.matrixWorld).project(camera);
          if(silhouettePoint.z< -1||silhouettePoint.z>1)continue;
          left=Math.min(left,silhouettePoint.x);right=Math.max(right,silhouettePoint.x);
          top=Math.min(top,silhouettePoint.y);bottom=Math.max(bottom,silhouettePoint.y);
        }
        if(right< -1||left>1||bottom< -1||top>1||!Number.isFinite(left))continue;
        regions.push({x:(left+right+2)*width/4,y:(2-top-bottom)*height/4,
          rx:Math.min(width,(right-left)*width*.3+18),ry:Math.min(height,(bottom-top)*height*.3+18)});
      }
      return regions;
    }
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

  const ready = new GLTFLoader().loadAsync('./assets/poseidon-space-arena/arena.glb?v=20261026-reading-runes', event => {
    if (event.total) onProgress?.(event.loaded / event.total);
  }).then(async gltf => {
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
                shader.uniforms.runeBounceStrength=ringBounce;
                shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
                  '#include <common>\nuniform float runeBounceStrength;');
                shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
                  '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= 0.0; reflectedLight.directSpecular *= 0.0;\nreflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.0275,.0131,.0057) * runeBounceStrength;');
              };
              material.customProgramCacheKey=()=> 'arena-ring-soft-back-bounce-half-v3';
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
      const prop=await new GLTFLoader().loadAsync('./assets/book-lectern/book-lectern.glb?v=20261026-book-only');
    const lectern=prop.scene;lectern.name='Book on lectern • rear courtyard';
      lectern.scale.setScalar(1.05);lectern.rotation.y=0;lectern.position.set(0,-.501884,-17.4);
    // The carved slab is thinner than the arena shadow-map bias; receiving its
      // own shadow produces streaks. Keep its cast shadow for ground contact.
      lectern.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;
      const materials=Array.isArray(o.material)?o.material:[o.material];
        for(const m of materials){m.roughness=.88;m.metalness=0;if(!/Lectern/.test(m.name))m.color.multiply(new THREE.Color(0xeee0c7));}
    }});scene.add(lectern);
      const bookLight=new THREE.PointLight(0xffd399,.9,2.6,2);bookLight.position.set(0,.9,-17);scene.add(bookLight);trackLight(bookLight,'rings');
      scene.add(createLecternRunes());
      for(let i=0;i<3;i++) {
        const angle=i*Math.PI*2/3;
        const light=new THREE.PointLight(0xffbf65,1.2,2.2,2);
        light.position.set(Math.cos(angle)*.45,-.12,-17.4+Math.sin(angle)*.45);
        scene.add(light);trackLight(light,'rings');
      }
      const rearRingBounce=new THREE.PointLight(0xffc57d,.55,3.4,2);
      rearRingBounce.position.set(0,.65,-11.55);scene.add(rearRingBounce);trackLight(rearRingBounce,'rings');
      // Broad orange bounce from the small portal illuminates its courtyard,
      // book and adjacent ruins; these lights do not increase rune emission.
      for(const [x,y,z,power,reach] of [[0,1.7,-16.5,9,6.5],[-1.4,1.4,-15.8,5,5.5],[1.4,1.4,-16.3,5,5.5]]) {
        const light=new THREE.PointLight(0xffb65b,power,reach,2);
        light.position.set(x,y,z);scene.add(light);trackLight(light,'rings');
      }
      environment.traverse(object=>{
        if(!object.isMesh||!(object.userData.arenaMotion==='rock'||object.parent?.userData.arenaMotion==='rock'))return;
        object.geometry.computeBoundingBox();
        skySilhouettes.push({object,points:corners(object.geometry.boundingBox)});
      });
      // Towers share one render mesh. Authored per-tower bounds avoid treating
      // that entire mesh as one screen-sized silhouette.
      try {
        const response=await fetch('./assets/poseidon-space-arena/sky-silhouettes.json');
        if(!response.ok)throw new Error(`Sky silhouettes: ${response.status}`);
        for(const [low,high] of await response.json())skySilhouettes.push({object:scene,
          points:corners(new THREE.Box3(new THREE.Vector3(...low),new THREE.Vector3(...high)))});
      }catch(error){console.warn('Sky attenuation uses rock silhouettes only.',error);}
    scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])applyFog(m);});
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
    letteringCamera.copy(camera);
    openingOffset = { x: camera.view.offsetX, y: camera.view.offsetY };
    // A book-led close-up: the lectern fills the foreground and the guide is
    // beside it, cropped naturally by the frame rather than hidden by pillars.
    arrivalCamera.copy(camera);arrivalCamera.clearViewOffset();
    arrivalCamera.position.set(-.75,.78,-15.3);arrivalCamera.lookAt(0,.95,-17.4);
    arrivalCharacter.rotation.copy(characterRoot.rotation);
    arrivalCharacter.scale.copy(characterRoot.scale).multiplyScalar(1.12);
    const guideScale=scale*1.12;
    arrivalCharacter.position.set(1.58-center.x*guideScale,-.501884-localBounds.min.y*guideScale,-17.55-center.z*guideScale);
    arrivalCharacter.updateMatrixWorld(true);
    arrivalCamera.updateMatrixWorld(true);arrivalCamera.updateProjectionMatrix();
    const bookFocus=new THREE.Vector3(0,.64,-17.4).project(arrivalCamera);
    arrivalCamera.setViewOffset(width,height,((bookFocus.x+1)/2-.32)*width,
      ((1-bookFocus.y)/2-.8)*height,width,height);
    arrivalCamera.updateMatrixWorld(true);
  }

  function updateJourney(scroll) {
    const j = ARENA_JOURNEY;
    // Settle above the gathered ball before it launches. The short hold
    // separates the reframing from the subsequent forward journey.
    const align = THREE.MathUtils.smootherstep(scroll,j.start,PARTICLE_LAUNCH_SCROLL-.12);
    // Reach the close, centred staging view first, then hold here while
    // the ball gets its half-viewport head start before forward follow.
    const aligned = new THREE.Vector3(0,1.5,1.45);
    camera.position.lerpVectors(openingPosition, aligned, align);
    lookCamera.position.copy(aligned);
    const level=THREE.MathUtils.smoothstep(scroll,j.aligned,j.firstRing);
    lookCamera.lookAt(0,THREE.MathUtils.lerp(1.30083,aligned.y,level),-2.07);
    travelRotation.copy(lookCamera.quaternion);
    camera.quaternion.slerpQuaternions(openingRotation, travelRotation, align);
    camera.setViewOffset(width,height,openingOffset.x*(1-align),openingOffset.y*(1-align),width,height);
    if (scroll > j.aligned) {
      const waypoints = [
        [j.aligned, aligned.z, aligned.y], [j.firstRing, -2.07, 1.30083],
        [j.secondRing, -10.84, .467856], [j.end, -15.3, .78],
      ];
      let index = 0;
      while (index < waypoints.length-2 && scroll > waypoints[index+1][0]) index++;
      const a=waypoints[index], b=waypoints[index+1];
      const p=THREE.MathUtils.clamp((scroll-a[0])/(b[0]-a[0]),0,1);
      const ease=p*p*(3-2*p);
      // Catch up promptly out of the hold, then settle toward the walkway's
      // speed instead of starting slowly and accelerating after the ring.
      const forward=index===0?p+.18*p*(1-p):p;
      camera.position.set(0,THREE.MathUtils.lerp(a[2],b[2],ease),THREE.MathUtils.lerp(a[1],b[1],forward));
      if(scroll>j.secondRing)camera.position.x=arrivalCamera.position.x*ease;
      // Level at each aperture, then gently look up at the ruins beyond it.
      const arrival=THREE.MathUtils.smoothstep(scroll,j.secondRing,j.end);
      camera.quaternion.slerpQuaternions(travelRotation,arrivalCamera.quaternion,arrival);
      camera.setViewOffset(width,height,arrivalCamera.view.offsetX*arrival,
        arrivalCamera.view.offsetY*arrival,width,height);
    }
    if(scroll>j.groundStart){
      const descend=THREE.MathUtils.smootherstep(scroll,j.groundStart,j.groundReach);
      // Keep the near plane just above the surface during the cut so the
      // underside of the single-sided arena floor never becomes visible.
      camera.position.y=THREE.MathUtils.lerp(.78,-.43,descend);
      lookCamera.position.copy(camera.position);lookCamera.lookAt(0,-1.15,-17.4);
      camera.quaternion.slerp(lookCamera.quaternion,descend*.8);
      camera.setViewOffset(width,height,arrivalCamera.view.offsetX*(1-descend),arrivalCamera.view.offsetY*(1-descend),width,height);
    }
    camera.updateMatrixWorld();
  }

  return {
    ready,
    letteringWorld() {return {scene,camera,layoutCamera:letteringCamera,applyFog,
      depth:()=>Math.max(1.2,openingPosition.distanceTo(new THREE.Vector3(0,.95,CHARACTER_Z))*.78)};},
    prepareCamera(scroll) {if(loaded&&placement)updateJourney(scroll);},
    backgroundView() {return loaded&&placement?{camera,reference:openingRotation,skyRegions}:null;},
    setCharacter(object, motionGroup, originalCamera) {
      placement = object; motion = motionGroup; legacyCamera = originalCamera;
      const previous = object.position.clone();
      object.position.set(0, 0, 0);object.updateMatrixWorld(true);
      localBounds = new THREE.Box3().setFromObject(object);
      object.position.copy(previous);object.updateMatrixWorld(true);
      object.traverse(child => { if (child.isMesh) child.castShadow = false; });
      if(!arrivalCharacter.children.length) {
        const duplicate=cloneSkeleton(object);duplicate.position.set(0,0,0);
        duplicate.quaternion.identity();duplicate.scale.setScalar(1);
        duplicate.children[0]?.position.set(0,0,0);duplicate.children[0]?.quaternion.identity();
        let standing=null,fighting=null;
        duplicate.traverse(child=>{
          standing ||= child.animations?.find(clip=>clip.name.split('|').pop().toLowerCase()==='standing');
          fighting ||= child.animations?.find(clip=>clip.name.split('|').pop().toLowerCase()==='fighting idle');
          if(child.isMesh){child.layers.set(1);child.castShadow=false;child.frustumCulled=false;}
        });
        arrivalCharacter.add(duplicate);
        if(standing){
          arrivalMixer=new THREE.AnimationMixer(duplicate);arrivalStanding=arrivalMixer.clipAction(standing).play();
          if(fighting)arrivalFighting=arrivalMixer.clipAction(fighting).setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();
          arrivalMixer.update(0);
        }
      }
      layout();
      characterParticles.bind(placement,arrivalCharacter);
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
      glitchControls.panel.hidden=!loaded||opacity<=.05||scroll>=ARENA_JOURNEY.groundStart;
      if (!loaded || !placement || opacity <= 0) { lastEnvironmentTime = null;hologramLastTime=null;pagePresence.fill(0);beamPresence=0;return; }
      for(const entry of runeLights) {
        entry.light.intensity=entry.intensity*lighting.values[entry.group];
        if(entry.distance>0) entry.light.distance=entry.distance*lighting.values.reach;
      }
      ringBounce.value=lighting.values.rings;
      scene.fog.near=lighting.values.fogStart;
      scene.fog.far=lighting.values.fogStart+lighting.values.fogRange;
      fogStrength.value=lighting.values.fogStrength;
      animateEnvironment(time / 1000);
      updateJourney(scroll);
      const openingOutline=1-THREE.MathUtils.smoothstep(scroll,.15,.8);
      const arrivalOutline=THREE.MathUtils.smoothstep(scroll,ARENA_JOURNEY.secondRing,5.3);
      characterRoot.visible=openingOutline>.001;
      arrivalCharacter.visible=arrivalOutline>.001;
      const beamWanted=scroll>=ARENA_JOURNEY.end&&scroll<ARENA_JOURNEY.groundStart;
      const page=scroll>=ARENA_JOURNEY.skills?2:scroll>=ARENA_JOURNEY.timeline?1:0;
      const hologramDelta=hologramLastTime===null?0:Math.min(.05,Math.max(0,(time-hologramLastTime)/1000));
      hologramLastTime=time;
      const step=hologramDelta/glitchControls.values.duration;
      for(let i=0;i<pagePresence.length;i++)if(!beamWanted||i!==page)pagePresence[i]=Math.max(0,pagePresence[i]-step);
      if(beamWanted&&pagePresence.every((value,i)=>i===page||value===0))pagePresence[page]=Math.min(1,pagePresence[page]+step);
      beamPresence=THREE.MathUtils.clamp(beamPresence+(beamWanted?1:-1)*step,0,1);
      // Reversible band dropout, not alpha fading. Keep rendering during exit
      // so scrolling away can complete the same graph effect in reverse.
      for(const [mesh,presence] of [[contentPlane,pagePresence[0]],[timelinePlane,pagePresence[1]],[skillsPlane,pagePresence[2]],[bookHologram,beamPresence]]){
        mesh.visible=presence>0;
        const uniforms=mesh.material.uniforms,values=glitchControls.values;
        uniforms.glitch.value=presence>0&&presence<1?1-presence:0;
        uniforms.presence.value=presence;uniforms.time.value=time*.001;
        for(const [uniform,key] of [['glitchSize','size'],['bandScale','bands'],['detailScale','detail'],['flickerSpeed','speed'],['refreshRate','refresh'],['noiseBrightness','brightness']])uniforms[uniform].value=values[key];
      }
      if(arrivalFighting){const fight=THREE.MathUtils.smoothstep(scroll,5.3,5.65);arrivalStanding.setEffectiveWeight(1-fight);arrivalFighting.setEffectiveWeight(fight);}
      if(arrivalCharacter.visible&&arrivalMixer)arrivalMixer.update(arrivalTime===null?0:Math.min(.05,(time-arrivalTime)/1000));
      arrivalTime=arrivalCharacter.visible?time:null;
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
        const revealHeight=characterParticles.update(scroll,time,camera,characterRoot,arrivalCharacter,renderer.getPixelRatio());
        outlines.setRevealHeight(revealHeight);
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
        const outlineOpacity=(openingOutline>.001||arrivalOutline>.001)?opacity:0;
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
        outlines.setRevealHeight();
      }
    },
  };
}
