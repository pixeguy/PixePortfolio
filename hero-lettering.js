import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { createLetterHover } from './letter-hover.js';

function letteringControls() {
  const values = { yaw:34, pitch:-4, roll:0, depth:1, nameSize:1, nameX:50, nameY:0, tilt:1, speed:3,
    buttonYaw:34, buttonPitch:-4, buttonRoll:0, buttonDepth:1, buttonSize:1, buttonGap:1, buttonX:50, buttonY:0 };
  const defaults={...values};
  const panel=document.createElement('details');panel.className='lettering-controls';panel.open=true;panel.hidden=true;
  const summary=document.createElement('summary');summary.textContent='3D name & buttons';panel.append(summary);
  const rows=[
    ['yaw','Name Y rotation',-180,180,1,'°'],['pitch','Name X rotation',-180,180,1,'°'],
    ['roll','Name Z rotation',-180,180,1,'°'],['depth','Name depth',0,3,.05,'×'],
    ['nameSize','Name size',.6,1.5,.01,'×'],['nameX','Name X',-150,150,1,'px'],['nameY','Name Y',-150,150,1,'px'],
    ['tilt','Sway amount',0,4,.05,'×'],['speed','Sway speed',0,10,.05,'×'],
    ['buttonYaw','Button Y rotation',-180,180,1,'°'],
    ['buttonPitch','Button X rotation',-180,180,1,'°'],['buttonRoll','Button Z rotation',-180,180,1,'°'],['buttonDepth','Button depth',.1,3,.05,'×'],
    ['buttonSize','Button size',.6,1.8,.05,'×'],['buttonGap','Button gap',.3,3,.05,'×'],
    ['buttonX','Buttons X',-150,150,1,'px'],['buttonY','Buttons Y',-100,100,1,'px'],
  ];
  const inputs=[];
  for(const [key,title,min,max,step,unit] of rows) {
    const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=title;
    const input=document.createElement('input');input.type='range';input.id=`lettering-${key}`;
    input.min=min;input.max=max;input.step=step;input.value=values[key];label.htmlFor=input.id;
    const output=document.createElement('output');output.htmlFor=input.id;
    const update=()=>{values[key]=Number(input.value);output.textContent=`${values[key].toFixed(unit==='×'?2:1)}${unit}`;};
    input.addEventListener('input',update);update();label.append(caption,input,output);panel.append(label);inputs.push({key,input,update});
  }
  const footer=document.createElement('div');footer.className='lettering-controls-footer';
  const note=document.createElement('small');note.textContent='Reload resets adjustments.';
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';
  reset.addEventListener('click',()=>{for(const row of inputs){row.input.value=defaults[row.key];row.update();}});
  footer.append(note,reset);panel.append(footer);panel.addEventListener('wheel',event=>event.stopPropagation());
  document.querySelector('#viewer').append(panel);
  return {values,panel};
}

// Extruded meshes attached to the arena. The original DOM supplies responsive
// opening placement, typing and accessible links; their hit boxes are projected.
export function createHeroLettering(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,2000);
  camera.position.z = 1000;
  // Front faces remain parallel to the screen. Only the extrusion recedes
  // diagonally, like the straight-on lettering in the Messenger opening.
  const depthShear = new THREE.Matrix4().set(1,0,-.32,0, 0,1,.38,0, 0,0,1,0, 0,0,0,1);
  const anchor = new THREE.Group(), floating = new THREE.Group();
  anchor.name='World title and social buttons';
  anchor.add(floating);scene.add(anchor);
  const extrusion=new THREE.Group();extrusion.matrix.copy(depthShear);extrusion.matrixAutoUpdate=false;floating.add(extrusion);
  scene.add(new THREE.HemisphereLight(0xffefc5,0x49334e,1.5));
  const key = new THREE.DirectionalLight(0xffe3ad,2.3);key.position.set(-3,4,6);scene.add(key);
  const rim = new THREE.DirectionalLight(0xa594df,.7);rim.position.set(4,2,-3);scene.add(rim);
  const name = document.querySelector('#name-backdrop');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const letterHover=createLetterHover(renderer,reducedMotion);
  const glyphs = [], buttons = [];
  let world=null;
  let layoutCache=null;
  const {values: settings,panel}=letteringControls();
  const gold = new THREE.MeshStandardMaterial({color:0xd4c444,emissive:0xd4c444,emissiveIntensity:.22,roughness:.75,metalness:.12});
  // Flat gold faces and lit cut sides keep the graphic look of the reference.
  const front = new THREE.MeshBasicMaterial({color:0xd4c444,toneMapped:false});
  const side = new THREE.MeshStandardMaterial({color:0x837448,roughness:.9});
  const plate = new THREE.MeshStandardMaterial({color:0x23182f,roughness:.85});
  const ink = new THREE.LineBasicMaterial({color:0x20151f,transparent:true,opacity:.8});

  function makeButton(link) {
    const group = new THREE.Group(), visual = new THREE.Group();group.add(visual);
    const bodyGeometry = new THREE.CylinderGeometry(.5,.5,.14,48);
    bodyGeometry.rotateX(Math.PI/2);
    bodyGeometry.translate(0,0,-.07);
    const body = new THREE.Mesh(bodyGeometry,[side,plate,side]);body.matrixAutoUpdate=false;body.matrix.copy(depthShear);visual.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.478,.019,6,64),gold);
    ring.position.z=.012;visual.add(ring);
    const svg = link.querySelector('svg');
    const paths = new SVGLoader().parse(svg.outerHTML).paths;
    for (const path of paths) for (const subPath of path.subPaths) {
      const points = subPath.getPoints(18);
      if (points.length<2) continue;
      const curve = new THREE.CurvePath();
      for (let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i];
        const from=new THREE.Vector3((a.x-12)/24*.55,(12-a.y)/24*.55,.045);
        const to=new THREE.Vector3((b.x-12)/24*.55,(12-b.y)/24*.55,.045);
        if (from.distanceToSquared(to)>.0000001) curve.add(new THREE.LineCurve3(from,to));
      }
      if (!curve.curves.length) continue;
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*3),.018,6,false),gold);
      visual.add(tube);
    }
    // Keep button centres registered to their real link hit boxes while the
    // title floats independently. Each button still has its own 3D tilt.
    group.rotation.set(0,0,0);
    const button={group,visual,link,body,progress:0,from:0,to:0,started:0};
    const setHover=()=>{
      const next=link.matches(':hover')||document.activeElement===link?1:0;
      if(next===button.to)return;
      button.from=button.progress;button.to=next;button.started=performance.now();
    };
    for(const event of ['pointerenter','pointerleave','focus','blur'])link.addEventListener(event,setHover);
    anchor.add(group);buttons.push(button);
  }

  let ready = false;
  const loaded = new GLTFLoader().loadAsync('./assets/hero-lettering.glb').then(gltf => {
    const meshes=[];gltf.scene.traverse(o=>{if(o.userData.heroGlyphWord)meshes.push(o);});
    if(meshes.length!==8)throw new Error('The hero lettering asset needs eight glyph meshes.');
    for(const mesh of meshes) {
      const word=mesh.userData.heroGlyphWord,index=Number(mesh.userData.heroGlyphIndex);
      mesh.removeFromParent();mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.setScalar(1);
      const surfaces=[];mesh.traverse(child=>{if(child.isMesh)surfaces.push(child);});
      for(const surface of surfaces) {
        surface.material=/face/i.test(surface.material.name)?front:side;
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(surface.geometry,40),ink);surface.add(edges);
      }
      const bounds=new THREE.Box3().setFromObject(mesh),center=bounds.getCenter(new THREE.Vector3());
      const pivot=new THREE.Group(),visual=new THREE.Group();mesh.position.sub(center);
      visual.add(mesh);pivot.add(visual);extrusion.add(pivot);
      letterHover.add(pivot,visual,bounds.getSize(new THREE.Vector3()));
      glyphs.push({mesh:pivot,center,word,index,phase:glyphs.length*1.618});
    }
    document.querySelectorAll('#hero-social-links a').forEach(makeButton);
    ready=true;document.documentElement.classList.add('hero-lettering-ready');
  });
  // A failed lettering download leaves the existing visible DOM title intact.
  loaded.catch(error=>console.error('Could not load 3D hero lettering.',error));

  return {
    attachWorld(context) {
      world=context;world.scene.add(anchor);extrusion.matrix.identity();
      for(const material of [gold,front,side,plate])world.applyFog(material);
    },
    render(time,width,height) {
      const visible=ready&&name.classList.contains('is-ready')&&!document.documentElement.classList.contains('is-loading')
        &&Number(name.dataset.heroOpacity??1)>.001;
      // Keep all title/button surfaces opaque while the camera passes them.
      panel.hidden=!visible;
      anchor.visible=visible;
      if(!visible)return;
      const links=document.querySelector('#hero-social-links');
      const layoutKey=[width,height,links.hidden,settings.buttonGap,settings.buttonSize,settings.buttonX,settings.buttonY].join(':');
      if(layoutCache?.key!==layoutKey) {
      links.style.gap=`${1.25*settings.buttonGap}rem`;
      links.style.transform=`translate(${settings.buttonX}px,${settings.buttonY}px)`;
      for(const {link} of buttons) {link.style.transform='none';link.style.width=`${44*settings.buttonSize}px`;link.style.height=`${44*settings.buttonSize}px`;}
      const words=[...name.querySelectorAll('.name-word')];
      const rectangles=words.map(word=>word.getBoundingClientRect());
      const left=Math.min(...rectangles.map(r=>r.left)),right=Math.max(...rectangles.map(r=>r.right));
      const top=Math.min(...rectangles.map(r=>r.top)),bottom=Math.max(...rectangles.map(r=>r.bottom));
      const centerX=(left+right)/2,centerY=(top+bottom)/2;
      camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
      const pixelScale=1;
      anchor.position.set((centerX-width/2)*pixelScale,(height/2-centerY)*pixelScale,0);
      anchor.scale.setScalar(pixelScale);
      if(world) {
        const ref=world.layoutCamera,depth=world.depth();
        const direction=new THREE.Vector3(centerX/width*2-1,1-centerY/height*2,.5).unproject(ref).sub(ref.position).normalize();
        const forward=new THREE.Vector3();ref.getWorldDirection(forward);
        anchor.position.copy(ref.position).addScaledVector(direction,depth/direction.dot(forward));
        anchor.quaternion.copy(ref.quaternion);
        anchor.scale.setScalar(2*depth*Math.tan(THREE.MathUtils.degToRad(ref.fov/2))/height);
      }
      const glyphLayout=new Map();
      for(const glyph of glyphs) {
        const word=words.find(w=>w.textContent.replace(/\|/g,'')===glyph.word);
        const letter=word?.querySelectorAll('.name-letter')[glyph.index];if(!letter)continue;
        const bounds=letter.getBoundingClientRect(),fontSize=parseFloat(getComputedStyle(word).fontSize);
        glyphLayout.set(glyph,{letter,x:bounds.left-centerX,y:centerY-bounds.top-fontSize*.787,scale:fontSize*1.42});
      }
      const buttonLayout=new Map();
      for(const button of buttons) {
        const bounds=button.link.getBoundingClientRect();
        buttonLayout.set(button,{bounds,x:bounds.left+bounds.width/2-centerX,y:centerY-bounds.top-bounds.height/2});
      }
      layoutCache={key:layoutKey,glyphLayout,buttonLayout};
      }
      const t=time/1000*settings.speed;
      const swayX=reducedMotion.matches?0:Math.sin(t*.105)*THREE.MathUtils.degToRad(2)*settings.tilt;
      const swayY=reducedMotion.matches?0:Math.sin(t*.08)*THREE.MathUtils.degToRad(3)*settings.tilt;
      floating.rotation.set(THREE.MathUtils.degToRad(settings.pitch),
        THREE.MathUtils.degToRad(settings.yaw),THREE.MathUtils.degToRad(settings.roll));
      floating.position.x=settings.nameX;
      floating.position.y=-settings.nameY;
      floating.scale.x=floating.scale.y=settings.nameSize;
      floating.scale.z=1;
      let anyVisible=false;
      for(const glyph of glyphs) {
        const metric=layoutCache.glyphLayout.get(glyph);
        glyph.mesh.visible=!!metric?.letter.classList.contains('is-typed');
        if(!metric)continue;
        anyVisible ||= glyph.mesh.visible;
        glyph.mesh.position.set(metric.x+glyph.center.x*metric.scale,
          metric.y+glyph.center.y*metric.scale,glyph.center.z*metric.scale*settings.depth);
        glyph.mesh.rotation.set(reducedMotion.matches?0:Math.sin(t*(.105+glyph.index*.003)+glyph.phase)*THREE.MathUtils.degToRad(2)*settings.tilt,
          reducedMotion.matches?0:Math.sin(t*(.08+glyph.index*.002)+glyph.phase*1.3)*THREE.MathUtils.degToRad(3)*settings.tilt,0);
        // Blender normalizes this font's em differently from CSS Arial.
        glyph.mesh.scale.setScalar(metric.scale);
        glyph.mesh.scale.z*=settings.depth;
      }
      for(const button of buttons) {
        const {group,visual,link,body}=button;
        const hoverTime=THREE.MathUtils.clamp((time-button.started)/(reducedMotion.matches?150:680),0,1);
        const hoverEase=reducedMotion.matches?hoverTime*hoverTime*(3-2*hoverTime):
          (1-(1+4.5*hoverTime)*Math.exp(-4.5*hoverTime))/(1-5.5*Math.exp(-4.5));
        button.progress=THREE.MathUtils.lerp(button.from,button.to,hoverEase);
        visual.rotation.x=reducedMotion.matches?0:button.progress*Math.PI*2;
        button.hoverScale=1+.12*THREE.MathUtils.smoothstep(button.progress,.75,1);
        visual.scale.setScalar(button.hoverScale);
        group.visible=!links.hidden;
        if(!group.visible)continue;
        const {bounds,x,y}=layoutCache.buttonLayout.get(button);
        group.position.set(x,y,0);
        group.scale.setScalar(bounds.width);
        body.matrix.copy(world?new THREE.Matrix4():depthShear).scale(new THREE.Vector3(1,1,settings.buttonDepth));
        group.rotation.set(THREE.MathUtils.degToRad(settings.buttonPitch)+swayX,THREE.MathUtils.degToRad(settings.buttonYaw)+swayY,THREE.MathUtils.degToRad(settings.buttonRoll));
      }
      if(!anyVisible)return;
      if(world) {
        anchor.updateMatrixWorld(true);
        letterHover.update(time,world.camera,width,height);
        for(const button of buttons) {
          const {group,link}=button;
          if(!group.visible)continue;
          const base=layoutCache.buttonLayout.get(button).bounds,p=group.getWorldPosition(new THREE.Vector3()).project(world.camera);
          const right=group.localToWorld(new THREE.Vector3(.5,0,0)).project(world.camera);
          const up=group.localToWorld(new THREE.Vector3(0,.5,0)).project(world.camera);
          const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
          const sx=Math.max(.1,Math.abs(right.x-p.x)*width/base.width),sy=Math.max(.1,Math.abs(up.y-p.y)*height/base.height);
          link.style.transition='none';link.style.transform=`translate(${x-base.left-base.width/2}px,${y-base.top-base.height/2}px) scale(${sx},${sy})`;
          link.style.pointerEvents=p.z>1||Math.abs(p.x)>1.2||Math.abs(p.y)>1.2?'none':'';
        }
        return;
      }
      anchor.updateMatrixWorld(true);letterHover.update(time,camera,width,height);
      const previousAutoClear=renderer.autoClear,previousTone=renderer.toneMapping;
      try {
        renderer.autoClear=false;renderer.toneMapping=THREE.AgXToneMapping;
        renderer.setRenderTarget(null);renderer.clearDepth();renderer.render(scene,camera);
      } finally {renderer.autoClear=previousAutoClear;renderer.toneMapping=previousTone;}
    },
  };
}
