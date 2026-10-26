import * as THREE from 'three';

export const PARTICLE_LAUNCH_SCROLL=1.02;

// Shared dynamic geometry: faceted grains and a soft halo on emissive grains.
export function createCharacterParticles(scene) {
  const count=4800,positions=new Float32Array(count*3),sizes=new Float32Array(count);
  const seeds=new Float32Array(count*4),appearance=new Float32Array(count*2);
  const modelPositions=new Float32Array(count*3);
  let seed=1977;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++) {
    sizes[i]=3.8+Math.pow(random(),1.6)*6.5;
    for(let j=0;j<4;j++)seeds[i*4+j]=random();
    appearance[i*2]=random();
    appearance[i*2+1]=random()>.83?2.8+random()*2.2:.35+random()*.6;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('appearance',new THREE.BufferAttribute(appearance,2));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{pixelRatio:{value:1}},
    vertexShader:`attribute float size; attribute vec2 appearance;
      uniform float pixelRatio; varying vec2 particleAppearance;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
      gl_PointSize=clamp(size*pixelRatio*2.8/max(.8,-p.z),2.,16.*pixelRatio);
      particleAppearance=appearance;}`,
    fragmentShader:`varying vec2 particleAppearance;void main(){vec2 p=gl_PointCoord*2.-1.;
      float r=length(p);if(r>1.)discard;
      vec3 normal=normalize(vec3(floor(p*4.)/4.,sqrt(max(.01,1.-r*r))));
      float facet=.48+.52*max(0.,dot(normal,normalize(vec3(-.5,.7,1.))));
      vec3 pigment=mix(vec3(.58,.40,.008),vec3(1.,.82,.045),particleAppearance.x);
      gl_FragColor=vec4(pigment*particleAppearance.y*facet,(1.-smoothstep(.8,1.,r))*.98);}`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;
  points.name='Character â€¢ travelling dissolve particles';points.visible=false;scene.add(points);
  const haloMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,toneMapped:false,uniforms:material.uniforms,
    vertexShader:material.vertexShader.replace('2.8/max(.8,-p.z),2.,16.*pixelRatio','9.5/max(.8,-p.z),2.,48.*pixelRatio'),
    fragmentShader:`varying vec2 particleAppearance;void main(){
      if(particleAppearance.y<1.5)discard;
      float r=length(gl_PointCoord*2.-1.);if(r>1.)discard;
      float halo=exp(-r*r*5.)*pow(1.-r,1.4);
      gl_FragColor=vec4(vec3(1.,.72,.035),halo*.26);}`});
  const halos=new THREE.Points(geometry,haloMaterial);halos.frustumCulled=false;
  halos.name='Character â€¢ soft particle light halos';halos.visible=false;scene.add(halos);
  const bounds=new THREE.Box3();
  const v=new THREE.Vector3(),centre=new THREE.Vector3();
  // World-space flight through the apertures, slightly beneath the camera.
  // The rounded head leads; the thin tail extends back toward the viewer.
  const flight=[ [.15,.17,1.05], [1.02,.17,1.05], [1.65,-2.07,.96],
    [2.25,-7.2,.67], [3.4,-10.84,.34], [4.25,-13.9,.38], [4.8,-16,.38], [5.3,-17.55,.55] ];
  function routeX(z,time) {
    const p=THREE.MathUtils.clamp((-z-2.07)/8.77,0,1);
    const arch=Math.sin(Math.PI*p);
    // Sweep left on the approach and through the wide first aperture,
    // then blend into the existing rightward bend on the walkway.
    const approach=THREE.MathUtils.clamp((.17-z)/4.17,0,1);
    const leftSweep=-.48*Math.pow(Math.sin(Math.PI*approach),2);
    return leftSweep+.82*arch*arch+arch*.055*Math.sin(time*.55+p*8)
      +1.58*THREE.MathUtils.smoothstep(-z,10.84,17.55);
  }
  function bind(root) {
    const meshes=[];let total=0;
    root.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position){total+=o.geometry.attributes.position.count;meshes.push({mesh:o,end:total});}});
    return Array.from({length:count},(_,i)=>{const n=Math.floor(seeds[i*4]*total),entry=meshes.find(e=>n<e.end);
      return {mesh:entry.mesh,index:n-(entry.end-entry.mesh.geometry.attributes.position.count)};});
  }
  let start=[],end=[];
  return {
    bind(opening,arrival){start=bind(opening);end=bind(arrival);},
    update(scroll,time,camera,opening,arrival,ratio) {
      const dissolve=THREE.MathUtils.smoothstep(scroll,.15,.8);
      const launch=THREE.MathUtils.smoothstep(scroll,PARTICLE_LAUNCH_SCROLL,1.2);
      const streamline=THREE.MathUtils.smoothstep(scroll,1.2,2.25);
      const form=THREE.MathUtils.smoothstep(scroll,4.25,5.3);
      // The remaining low stream gathers back into a ball while individual
      // grains continue peeling away to rebuild the character.
      const returnToBall=THREE.MathUtils.smoothstep(scroll,4.25,5.05);
      const shape=launch*(1-returnToBall);
      points.visible=halos.visible=scroll>.15&&scroll<5.3;if(!points.visible||!start.length)return 1e6;
      material.uniforms.pixelRatio.value=ratio;
      let segment=0;
      while(segment<flight.length-2&&scroll>flight[segment+1][0])segment++;
      const from=flight[segment],to=flight[segment+1];
      const progress=THREE.MathUtils.clamp((scroll-from[0])/(to[0]-from[0]),0,1);
      const ease=progress*progress*(3-2*progress);
      const travel=from[0]===PARTICLE_LAUNCH_SCROLL?progress*progress*(2-progress):progress;
      centre.set(0,
        THREE.MathUtils.lerp(from[2],to[2],ease),THREE.MathUtils.lerp(from[1],to[1],travel));
      const source=scroll<2?start:end,root=scroll<2?opening:arrival;
      const travelling=dissolve===1&&form===0;
      if(!travelling) {
        root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});bounds.makeEmpty();
        for(let i=0;i<count;i++) {
          const sample=source[i];sample.mesh.getVertexPosition(sample.index,v);v.applyMatrix4(sample.mesh.matrixWorld);
          v.toArray(modelPositions,i*3);bounds.expandByPoint(v);
        }
      }
      const height=travelling?1:Math.max(.01,bounds.max.y-bounds.min.y);
      const feather=height*.025;
      const revealHeight=travelling?1e6:THREE.MathUtils.lerp(bounds.min.y-feather,bounds.max.y+feather,scroll<2?1-dissolve:form);
      // The outgoing dissolve gathers above the remaining outline. On arrival,
      // keep the main stream on its low flight route; individual grains are
      // attracted to the shared reveal frontier at the model's actual height.
      if(scroll<2&&!travelling)centre.y=Math.max(centre.y,revealHeight+.27);
      for(let i=0;i<count;i++) {
        const a=seeds[i*4],b=seeds[i*4+1],c=seeds[i*4+2],d=seeds[i*4+3];
        if(!travelling)v.fromArray(modelPositions,i*3);else v.copy(centre);
        // Exact same world-space frontier and noise as the normal-outline
        // shader. Only already-erased surface points may start releasing.
        const surfaceHeight=v.y+.018*Math.sin(v.x*91)*Math.sin(v.z*83);
        const distance=surfaceHeight-revealHeight;
        const release=travelling||dissolve===1?1:THREE.MathUtils.smoothstep(distance,0,feather);
        const gather=travelling?0:1-THREE.MathUtils.smoothstep(distance,0,feather);
        const blend=scroll<2?release:1-gather;
        // Dense rounded nose and a long taper. Shared, restrained curls deform
        // the tail while preserving its forward-pointing teardrop silhouette.
        const t=time*.001,u=THREE.MathUtils.clamp(b+.035*Math.sin(t*(.6+c)+a*17),0,1);
        const tail=u*THREE.MathUtils.lerp(.65,2.6,streamline);
        const phase=a*Math.PI*2+t*(d>.5?1:-1)*(.35+c*.5)+u*8;
        const envelope=u<.12?Math.sqrt(Math.max(0,1-Math.pow((u-.12)/.12,2))):Math.pow((1-u)/.88,.62);
        // Most grains occupy a tight core. A smaller surface population keeps
        // the boundary alive without turning the silhouette into loose spray.
        const radial=c<.90?Math.pow(c/.90,1.9)*.62:.65+.35*(c-.90)/.10;
        const bodyWidth=THREE.MathUtils.lerp(.21,.135,streamline);
        const streamRadius=(.012+bodyWidth*envelope)*radial*(1+.07*Math.sin(u*19-t*2));
        const curl=u*u*(1-u);
        // Sphere and stream use the same longitudinal/circular coordinates.
        // Interpolating unrelated point layouts used to collapse the middle.
        const sphereAxis=2*u-1,sphereRadius=.205*radial;
        const sphereCross=Math.sqrt(Math.max(0,1-sphereAxis*sphereAxis))*sphereRadius;
        const radius=THREE.MathUtils.lerp(sphereCross,streamRadius,shape);
        const z=centre.z+THREE.MathUtils.lerp(sphereAxis*sphereRadius,tail,shape)
          +shape*.014*Math.sin(t*(.9+d)+a*23);
        const jitter=.002+.003*u;
        const sphereX=form>0?routeX(centre.z,t):0;
        const x=Math.cos(phase)*radius+THREE.MathUtils.lerp(sphereX,routeX(z,t)+.10*curl*Math.sin(t*.8+u*6)
          +jitter*Math.sin(t*(1.1+c)+a*31),shape);
        const y=centre.y+Math.sin(phase)*radius+shape*(.09*u+.08*curl*Math.cos(t*.7+u*5)
          +jitter*Math.cos(t*(.8+d)+b*29));
        const visible=scroll<2?release>.001:gather<.999;
        positions[i*3]=visible?THREE.MathUtils.lerp(v.x,x,blend):0;
        positions[i*3+1]=visible?THREE.MathUtils.lerp(v.y,y,blend):-1000;
        positions[i*3+2]=visible?THREE.MathUtils.lerp(v.z,z,blend):0;
      }
      geometry.attributes.position.needsUpdate=true;
      return revealHeight;
    }
  };
}
