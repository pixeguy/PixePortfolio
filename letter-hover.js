import * as THREE from 'three';

// Static hit boxes live under each sway pivot; the animated visual sits beside
// them, so a scale bounce or flip cannot trigger its own pointer exit.
export function createLetterHover(renderer,reducedMotion) {
  const entries=[],proxies=[],ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const screen=new THREE.Vector2(),projected=new THREE.Vector3(),hits=[];
  const proxyMaterial=new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});
  let pointerActive=false,hovered=null;
  window.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const bounds=renderer.domElement.getBoundingClientRect();
    screen.set(event.clientX-bounds.left,event.clientY-bounds.top);
    pointer.set(screen.x/bounds.width*2-1,1-screen.y/bounds.height*2);
    pointerActive=screen.x>=0&&screen.x<=bounds.width&&screen.y>=0&&screen.y<=bounds.height
      &&!event.target.closest?.('a,button,input,summary,.lettering-controls');
  },{passive:true});
  for(const event of ['pointerleave','pointercancel','blur']) {
    window.addEventListener(event,()=>{pointerActive=false;});
  }
  function flipOnExit(entry,time,camera,width,height) {
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    const half=entry.half;
    for(const x of [-half.x,half.x])for(const y of [-half.y,half.y])for(const z of [-half.z,half.z]) {
      projected.set(x,y,z).applyMatrix4(entry.proxy.matrixWorld).project(camera);
      const sx=(projected.x+1)*width/2,sy=(1-projected.y)*height/2;
      left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
    }
    const dx=(screen.x-(left+right)/2)/Math.max(1,(right-left)/2);
    const dy=(screen.y-(top+bottom)/2)/Math.max(1,(bottom-top)/2);
    entry.from.copy(entry.rotation);
    const turn=Math.PI*2;
    entry.to.set(Math.round(entry.rotation.x/turn)*turn,Math.round(entry.rotation.y/turn)*turn);
    if(Math.abs(dy)>=Math.abs(dx))entry.to.x+=Math.sign(dy||1)*Math.PI*2;
    else entry.to.y+=Math.sign(dx||1)*Math.PI*2;
    entry.flipStarted=time;
  }
  return {
    add(pivot,visual,size) {
      const proxy=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),proxyMaterial);
      proxy.visible=false;pivot.add(proxy);
      const entry={pivot,visual,proxy,half:size.clone().multiplyScalar(.5),bounceStarted:-Infinity,
        flipStarted:-Infinity,rotation:new THREE.Vector2(),from:new THREE.Vector2(),to:new THREE.Vector2()};
      proxy.userData.letterHover=entry;entries.push(entry);proxies.push(proxy);
    },
    update(time,camera,width,height) {
      let next=null;
      if(pointerActive) {
        ray.setFromCamera(pointer,camera);hits.length=0;
        ray.intersectObjects(proxies,false,hits);
        next=hits.find(hit=>hit.object.parent.visible)?.object.userData.letterHover||null;
      }
      if(next!==hovered) {
        if(hovered)flipOnExit(hovered,time,camera,width,height);
        if(next)next.bounceStarted=time;
        hovered=next;
      }
      for(const entry of entries) {
        const u=THREE.MathUtils.clamp((time-entry.flipStarted)/680,0,1);
        const ease=(1-(1+4.5*u)*Math.exp(-4.5*u))/(1-5.5*Math.exp(-4.5));
        entry.rotation.lerpVectors(entry.from,entry.to,ease);
        if(u===1) {entry.rotation.set(0,0);entry.from.set(0,0);entry.to.set(0,0);}
        entry.visual.rotation.set(reducedMotion.matches?0:entry.rotation.x,reducedMotion.matches?0:entry.rotation.y,0);
        const bounce=THREE.MathUtils.clamp((time-entry.bounceStarted)/420,0,1);
        const scale=reducedMotion.matches?1:1+.22*Math.sin(Math.PI*bounce)*Math.exp(-2.8*bounce);
        entry.visual.scale.setScalar(scale);
      }
    }
  };
}
