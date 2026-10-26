// Project the existing Canvas control points as directions at infinity.
// Camera translation never enters this calculation. The opening view is an
// identity projection, so its original pixel sizes and positions are retained.
export function createSkyProjection() {
  let width=1,height=1,focal=1,rotation=[1,0,0,0,1,0,0,0,1];
  let version=0,active=false;
  const identity=[1,0,0,0,1,0,0,0,1];
  const orientations=[
    [1,0,0,0,1,0,0,0,1],
    [0,0,1,0,1,0,-1,0,0],
    [-1,0,0,0,1,0,0,0,-1],
    [0,0,-1,0,1,0,1,0,0],
    [1,0,0,0,0,-1,0,1,0],
    [1,0,0,0,0,1,0,-1,0],
  ];
  // Fill the latitudes between the horizon and poles as well, so looking up
  // while turning does not expose an empty band between the direction fields.
  for(const pitch of [-Math.PI/6,Math.PI/6])for(let i=0;i<4;i++) {
    const yaw=i*Math.PI/2,c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    orientations.push([c,s*sp,s*cp,0,cp,-sp,-s,c*sp,c*cp]);
  }
  function apply(m,x,y,z) {
    return [m[0]*x+m[1]*y+m[2]*z,m[3]*x+m[4]*y+m[5]*z,m[6]*x+m[7]*y+m[8]*z];
  }
  function project(x,y,face=0,initial=false) {
    const world=apply(orientations[face],(x-width/2)/focal,(height/2-y)/focal,-1);
    const p=initial?world:apply(rotation,...world);
    if(p[2]>=-.035)return null;
    return {x:width/2+p[0]*focal/-p[2],y:height/2-p[1]*focal/-p[2],scale:1/-p[2]};
  }
  return {
    orientations,
    get active(){return active;},get version(){return version;},
    get gradientY(){return Math.asin(Math.max(-1,Math.min(1,-rotation[7])))*focal;},
    resize(w,h){width=w;height=h;focal=h/(2*Math.tan(38*Math.PI/360));version++;},
    setCamera(camera,reference,strength=1) {
      let next=identity;
      if(camera&&reference&&strength>0) {
        const relative=camera.quaternion.clone().invert().multiply(reference);
        if(strength<1)relative.copy(relative.clone().identity().slerp(relative,strength));
        const {x,y,z,w}=relative;
        next=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),
          2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),
          2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
        focal=height/(2*Math.tan(camera.fov*Math.PI/360));
      }
      if(next.some((n,i)=>Math.abs(n-rotation[i])>.000001)){version++;rotation=next;}
      active=next.some((n,i)=>Math.abs(n-identity[i])>.000001);
    },
    project,
    fieldVisible(face) {
      const p=apply(rotation,...apply(orientations[face],0,0,-1));
      return p[2]<.5;
    },
    visible(points,face) {
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const point of points) {
        const p=project(point.x,point.y,face);if(!p)continue;
        left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);
      }
      return right>=-80&&left<=width+80&&bottom>=-80&&top<=height+80;
    },
    cloud(cloud,face) {
      const blobs=cloud.blobs.map(blob=>{
        const center=project(blob.x,blob.y,face);if(!center)return null;
        return {...blob,x:center.x,y:center.y,radiusX:blob.radiusX*center.scale,radiusY:blob.radiusY*center.scale};
      }).filter(Boolean);
      if(!blobs.length)return null;
      const contours=cloud.contours.map(points=>points.map(p=>project(p.x,p.y,face))).filter(points=>points.length>2&&points.every(Boolean));
      const points=contours.flat(),pad=80;
      if(!points.length||points.every(p=>p.x < -pad)||points.every(p=>p.x>width+pad)||
         points.every(p=>p.y < -pad)||points.every(p=>p.y>height+pad))return null;
      const path=new Path2D();
      for(const contour of contours) {
        const first=contour[0],last=contour.at(-1);path.moveTo((first.x+last.x)/2,(first.y+last.y)/2);
        contour.forEach((p,i)=>{const next=contour[(i+1)%contour.length];path.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);});
        path.closePath();
      }
      return {path,blobs};
    },
    outsideOpening(blob,face) {
      // Additional sky directions never add clouds over the original opening.
      for(let i=0;i<16;i++) {
        const a=i/16*Math.PI*2;
        const p=project(blob.x+Math.cos(a)*blob.radiusX*2,blob.y+Math.sin(a)*blob.radiusY*2,face,true);
        if(p&&p.x>-100&&p.x<width+100&&p.y>-100&&p.y<height+100)return false;
      }
      const center=project(blob.x,blob.y,face,true);
      return !center||center.x<0||center.x>width||center.y<0||center.y>height;
    },
  };
}
