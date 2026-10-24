import * as THREE from 'three';

// An intentionally bare particle experiment: fixed camera, no gas or textures.
export function createParticleWorld(host, canvas, oldStars) {
  oldStars.hidden = true;
  const mobile = matchMedia('(max-width: 700px)').matches;
  const count = mobile ? 8000 : 26000;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 100);
  camera.position.z = 24;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.setClearColor(0, 0);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const anchors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let width = 0, height = 0, extentX = 30, extentY = 18, lastTime = null;
  let initialized = false;
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, time: -Infinity, active: false };
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 2 - 1;
    const y = 1 - (event.clientY - rect.top) / rect.height * 2;
    const now = performance.now();
    if (mouse.active && now - mouse.time < 150) {
      mouse.dx += x - mouse.x; mouse.dy += y - mouse.y;
    }
    mouse.x = x; mouse.y = y; mouse.time = now; mouse.active = true;
  }, { passive: true });
  window.addEventListener('blur', () => { mouse.active = false; mouse.dx = mouse.dy = 0; });
  document.addEventListener('pointerleave', () => { mouse.active = false; });

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uRatio: { value: renderer.getPixelRatio() }, uPalette: { value: 0 } },
    vertexShader: `attribute float aSeed; uniform float uRatio; varying float vAlpha; varying float vSeed;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);
        gl_PointSize=clamp((65.+aSeed*aSeed*105.)/-p.z,1.8,7.)*uRatio;
        vSeed=aSeed;
        vAlpha=(.35+aSeed*.4)*(1.-smoothstep(30.,44.,-p.z));
        gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float uPalette; varying float vAlpha; varying float vSeed;
      void main(){vec2 uv=(gl_PointCoord-.5)*2.;float r=length(uv);
        float alpha=(1.-smoothstep(.78,1.,r))*vAlpha;
        if(alpha<.01)discard;
        vec3 normal=vec3(uv,sqrt(max(0.,1.-r*r)));
        float light=.24+.76*max(0.,dot(normal,normalize(vec3(-.5,.6,1.))));
        vec3 colour=mix(vec3(.23,.20,.36),vec3(.65,.62,.78),vSeed)*light;
        gl_FragColor=vec4(mix(colour,vec3(.18,.09,.26)*light,uPalette),alpha);
        #include <colorspace_fragment>
      }`, transparent: true, depthWrite: false,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false; scene.add(particles);

  // Smooth lattice noise gives a continuous flow rather than random jitter.
  const hash = (x, y, z) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const mix = (a, b, t) => a + (b - a) * t;
  function noise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    x -= ix; y -= iy; z -= iz;
    x *= x * (3 - 2 * x); y *= y * (3 - 2 * y); z *= z * (3 - 2 * z);
    return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),x),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),x),y),
      mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),x),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),x),y),z);
  }
  function step(time) {
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .04);
    lastTime = time;
    const damping = Math.exp(-dt * 1.8), t = time * .000035;
    const push = mouse.active && performance.now() - mouse.time < 150;
    for (let i = 0; i < count; i++) {
      const k = i * 3, x = positions[k], y = positions[k+1], z = positions[k+2];
      const angle = noise(x*.095,y*.095,z*.08+t)*Math.PI*4;
      velocities[k] = velocities[k]*damping + Math.cos(angle)*dt*.9;
      velocities[k+1] = velocities[k+1]*damping + Math.sin(angle)*dt*.9;
      velocities[k+2] = velocities[k+2]*damping + (noise(x*.1+19,y*.1,z*.1+t)-.5)*dt*.5;
      // Gentle attraction preserves the dense folds while allowing mouse wakes.
      // Ambient particles remain free; clustered particles return gradually.
      if (i % 5 !== 0) {
        const drift = Math.sin(time*.00012 + anchors[k]*.15)*.7;
        velocities[k] += (anchors[k]-x)*dt*.22;
        velocities[k+1] += (anchors[k+1]+drift-y)*dt*.22;
        velocities[k+2] += (anchors[k+2]-z)*dt*.22;
      }
      if (push) {
        const halfY = Math.tan(THREE.MathUtils.degToRad(25))*(24-z), halfX = halfY*camera.aspect;
        const dx = (x/halfX-mouse.x)*width*.5, dy = (y/halfY-mouse.y)*height*.5;
        const weight = Math.exp(-(dx*dx+dy*dy)/10000);
        velocities[k] += mouse.dx*halfX*weight*8;
        velocities[k+1] += mouse.dy*halfY*weight*8;
      }
      for(let axis=0;axis<3;axis++) velocities[k+axis]=THREE.MathUtils.clamp(velocities[k+axis],-12,12);
      positions[k] += velocities[k]*dt; positions[k+1] += velocities[k+1]*dt; positions[k+2] += velocities[k+2]*dt;
      if (positions[k]>extentX) positions[k]=-extentX; else if(positions[k]<-extentX) positions[k]=extentX;
      if (positions[k+1]>extentY) positions[k+1]=-extentY; else if(positions[k+1]<-extentY) positions[k+1]=extentY;
      if (positions[k+2]>8) positions[k+2]=-12; else if(positions[k+2]<-12) positions[k+2]=8;
    }
    mouse.dx = mouse.dy = 0;
    positionAttribute.needsUpdate = true;
  }
  const api = {
    resize() {
      const w=canvas.clientWidth,h=canvas.clientHeight;
      if(!w||!h||(w===width&&h===height))return;
      const previousX=extentX,previousY=extentY;
      width=w;height=h;camera.aspect=w/h;camera.updateProjectionMatrix();
      extentY=Math.tan(THREE.MathUtils.degToRad(25))*36+2;extentX=extentY*camera.aspect+2;
      renderer.setSize(w,h,false);
      for(let i=0;i<count;i++) {
        const k=i*3;
        if(initialized){
          positions[k]*=extentX/previousX;positions[k+1]*=extentY/previousY;
          anchors[k]*=extentX/previousX;anchors[k+1]*=extentY/previousY;
        } else {
          const z=Math.random()*20-12;
          const halfY=Math.tan(THREE.MathUtils.degToRad(25))*(24-z);
          const halfX=halfY*camera.aspect;
          const u=Math.random()*2.4-1.2;
          // Three irregular folded ribbons, with sparse particles between them.
          const band=i%3;
          const ridge=(band-1)*.65+Math.sin(u*3.8+band*1.7)*.28+Math.sin(u*8+band)*.09;
          const gaussian=Math.sqrt(-2*Math.log(Math.max(.0001,Math.random())))*Math.cos(Math.random()*Math.PI*2);
          const thickness=.035+.10*(.5+.5*Math.sin(u*5.5+band*2));
          positions[k]=u*halfX;
          positions[k+1]=(i%5===0 ? Math.random()*2.4-1.2 : ridge+gaussian*thickness)*halfY;
          positions[k+2]=z;
          anchors.set(positions.subarray(k,k+3),k);
          seeds[i]=Math.random();
        }
      }
      initialized=true;positionAttribute.needsUpdate=true;geometry.attributes.aSeed.needsUpdate=true;
    },
    draw(time, palette=0) { api.resize();step(time);material.uniforms.uPalette.value=palette;renderer.render(scene,camera); },
    drawRegion(context,bounds) {
      const palette=material.uniforms.uPalette.value;
      material.uniforms.uPalette.value=0;renderer.render(scene,camera);
      const rect=canvas.getBoundingClientRect(),ratio=renderer.getPixelRatio();
      context.clearRect(0,0,bounds.width,bounds.height);context.fillStyle='#030306';context.fillRect(0,0,bounds.width,bounds.height);
      context.drawImage(canvas,(bounds.left-rect.left)*ratio,(bounds.top-rect.top)*ratio,bounds.width*ratio,bounds.height*ratio,0,0,bounds.width,bounds.height);
      material.uniforms.uPalette.value=palette;renderer.render(scene,camera);
    },
  };
  new ResizeObserver(api.resize).observe(canvas);api.resize();return api;
}
