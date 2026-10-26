import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

function letteringControls() {
  const values = { yaw:0, pitch:0, roll:0, depth:1, nameSize:1, nameX:0, nameY:0, tilt:0, speed:1, bob:2.5,
    buttonYaw:0, buttonPitch:0, buttonDepth:1, buttonSize:1, buttonGap:1, buttonX:0, buttonY:0 };
  const defaults={...values};
  const panel=document.createElement('details');panel.className='lettering-controls';panel.open=true;panel.hidden=true;
  const summary=document.createElement('summary');summary.textContent='3D name & buttons';panel.append(summary);
  const rows=[
    ['yaw','Name turn',-20,20,.1,'°'],['pitch','Name tilt',-15,15,.1,'°'],
    ['roll','Name roll',-10,10,.1,'°'],['depth','Name depth',0,3,.05,'×'],
    ['nameSize','Name size',.6,1.5,.01,'×'],['nameX','Name X',-150,150,1,'px'],['nameY','Name Y',-150,150,1,'px'],
    ['tilt','Float rotation',0,4,.05,'×'],['speed','Float speed',0,3,.05,'×'],
    ['bob','Float height',0,12,.1,'px'],['buttonYaw','Button turn',-30,30,.1,'°'],
    ['buttonPitch','Button tilt',-30,30,.1,'°'],['buttonDepth','Button depth',.1,3,.05,'×'],
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

// Actual extruded meshes in a perspective-lit foreground scene. The original
// DOM remains the accessible text/link layer and supplies responsive placement.
export function createHeroLettering(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,2000);
  camera.position.z = 1000;
  // Front faces remain parallel to the screen. Only the extrusion recedes
  // diagonally, like the straight-on lettering in the Messenger opening.
  const depthShear = new THREE.Matrix4().set(1,0,-.32,0, 0,1,.38,0, 0,0,1,0, 0,0,0,1);
  const anchor = new THREE.Group(), floating = new THREE.Group();
  anchor.add(floating);scene.add(anchor);
  const extrusion=new THREE.Group();extrusion.matrix.copy(depthShear);extrusion.matrixAutoUpdate=false;floating.add(extrusion);
  scene.add(new THREE.HemisphereLight(0xffefc5,0x49334e,1.5));
  const key = new THREE.DirectionalLight(0xffe3ad,2.3);key.position.set(-3,4,6);scene.add(key);
  const rim = new THREE.DirectionalLight(0xa594df,.7);rim.position.set(4,2,-3);scene.add(rim);
  const name = document.querySelector('#name-backdrop');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const glyphs = [], buttons = [];
  const {values: settings,panel}=letteringControls();
  const gold = new THREE.MeshStandardMaterial({color:0xd4c444,roughness:.75,metalness:.12});
  // Flat gold faces and lit cut sides keep the graphic look of the reference.
  const front = new THREE.MeshBasicMaterial({color:0xd4c444,toneMapped:false});
  const side = new THREE.MeshStandardMaterial({color:0x837448,roughness:.9});
  const plate = new THREE.MeshStandardMaterial({color:0x23182f,roughness:.85});
  const ink = new THREE.LineBasicMaterial({color:0x20151f,transparent:true,opacity:.8});

  function makeButton(link) {
    const group = new THREE.Group();
    const bodyGeometry = new THREE.CylinderGeometry(.5,.5,.14,48);
    bodyGeometry.rotateX(Math.PI/2);
    bodyGeometry.translate(0,0,-.07);
    const body = new THREE.Mesh(bodyGeometry,[side,plate,side]);body.matrixAutoUpdate=false;body.matrix.copy(depthShear);group.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.478,.019,6,64),gold);
    ring.position.z=.012;group.add(ring);
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
      group.add(tube);
    }
    // Keep button centres registered to their real link hit boxes while the
    // title floats independently. Each button still has its own 3D tilt.
    group.rotation.set(0,0,0);
    anchor.add(group);buttons.push({group,link,body});
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
      extrusion.add(mesh);glyphs.push({mesh,word,index});
    }
    document.querySelectorAll('#hero-social-links a').forEach(makeButton);
    ready=true;document.documentElement.classList.add('hero-lettering-ready');
  });
  // A failed lettering download leaves the existing visible DOM title intact.
  loaded.catch(error=>console.error('Could not load 3D hero lettering.',error));

  return {
    render(time,width,height) {
      const visible=ready&&name.classList.contains('is-typing')&&!document.documentElement.classList.contains('is-loading')
        &&!!name.querySelector('.name-letter.is-typed');
      panel.hidden=!visible;
      if(!visible)return;
      const links=document.querySelector('#hero-social-links');
      links.style.gap=`${1.25*settings.buttonGap}rem`;
      links.style.transform=`translate(${settings.buttonX}px,${settings.buttonY}px)`;
      for(const {link} of buttons) {link.style.width=`${44*settings.buttonSize}px`;link.style.height=`${44*settings.buttonSize}px`;}
      const words=[...name.querySelectorAll('.name-word')];
      const rectangles=words.map(word=>word.getBoundingClientRect());
      const left=Math.min(...rectangles.map(r=>r.left)),right=Math.max(...rectangles.map(r=>r.right));
      const top=Math.min(...rectangles.map(r=>r.top)),bottom=Math.max(...rectangles.map(r=>r.bottom));
      const centerX=(left+right)/2,centerY=(top+bottom)/2;
      camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
      const pixelScale=1;
      anchor.position.set((centerX-width/2)*pixelScale,(height/2-centerY)*pixelScale,0);
      anchor.scale.setScalar(pixelScale);
      const t=time/1000*settings.speed;
      floating.rotation.set(THREE.MathUtils.degToRad(settings.pitch)+(reducedMotion.matches?0:Math.sin(t*.17)*.008*settings.tilt),
        THREE.MathUtils.degToRad(settings.yaw)+(reducedMotion.matches?0:Math.sin(t*.14)*.015*settings.tilt),
        THREE.MathUtils.degToRad(settings.roll)+(reducedMotion.matches?0:Math.sin(t*.12)*.003*settings.tilt));
      floating.position.x=settings.nameX;
      floating.position.y=-settings.nameY+(reducedMotion.matches?0:Math.sin(t*.21)*settings.bob);
      floating.scale.x=floating.scale.y=settings.nameSize;
      floating.scale.z=1;
      let anyVisible=false;
      for(const glyph of glyphs) {
        const word=words.find(w=>w.textContent.replace(/\|/g,'')===glyph.word);
        const letter=word?.querySelectorAll('.name-letter')[glyph.index];
        glyph.mesh.visible=!!letter?.classList.contains('is-typed');
        if(!letter)continue;
        anyVisible ||= glyph.mesh.visible;
        const bounds=letter.getBoundingClientRect();
        const fontSize=parseFloat(getComputedStyle(word).fontSize);
        const baseline=bounds.top+fontSize*.787;
        glyph.mesh.position.set(bounds.left-centerX,centerY-baseline,0);
        // Blender normalizes this font's em differently from CSS Arial.
        glyph.mesh.scale.setScalar(fontSize*1.42);
        glyph.mesh.scale.z*=settings.depth;
      }
      for(const {group,link,body} of buttons) {
        group.visible=!links.hidden;
        if(!group.visible)continue;
        const bounds=link.getBoundingClientRect();
        group.position.set(bounds.left+bounds.width/2-centerX,centerY-bounds.top-bounds.height/2,0);
        group.scale.setScalar(bounds.width);
        body.matrix.copy(depthShear).scale(new THREE.Vector3(1,1,settings.buttonDepth));
        group.rotation.set(THREE.MathUtils.degToRad(settings.buttonPitch),THREE.MathUtils.degToRad(settings.buttonYaw),0);
      }
      if(!anyVisible)return;
      const previousAutoClear=renderer.autoClear,previousTone=renderer.toneMapping;
      try {
        renderer.autoClear=false;renderer.toneMapping=THREE.AgXToneMapping;
        renderer.setRenderTarget(null);renderer.clearDepth();renderer.render(scene,camera);
      } finally {renderer.autoClear=previousAutoClear;renderer.toneMapping=previousTone;}
    },
  };
}
