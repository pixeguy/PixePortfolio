export const NEBULA_MOTION = { flowRate: 0.000035, minimumSpeed: 3, speedVariation: 0.25 };
let activeBackground = null;
export function getSpaceBackground() { return activeBackground; }

const math = {
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  smoothstep(value, min, max) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return t * t * (3 - 2 * t);
  },
};

// Low-frequency moving noise changes the outline itself, inspired by the
// reference shader's differently moving layers. Only control points sample it.
export function nebulaNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const hash = (a, b) => {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  return math.lerp(
    math.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    math.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}

// Shared by the portfolio and each project page; no model dependency.
export function createSpaceBackground(host, nebulaCanvas, starCanvas) {
  const nebulaContext = nebulaCanvas.getContext('2d');
  const starContext = starCanvas.getContext('2d');
  let stars = [];
  let nebulaBlobs = [];
  let nebulaLinks = [];
  let nebulaLastDraw = -Infinity;
  let starfieldWidth = 0;
  let starfieldHeight = 0;
  let paletteProgress = 0;
  let backgroundWidth = 0, backgroundHeight = 0, backgroundRatio = 0;
  let nebulaWidth = 0, nebulaHeight = 0;
  const goldenColors = [[175, 130, 55], [191, 155, 64], [230, 193, 89], [146, 107, 53]];
  function mixColor(source, target) {
    return source.map((value, index) => Math.round(math.lerp(value, target[index], paletteProgress))).join(',');
  }

  function resizeNebula() {
    const width = host.clientWidth;
    const height = nebulaCanvas.clientHeight;
    if (!width || !height) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    nebulaCanvas.width = Math.round(width * pixelRatio);
    nebulaCanvas.height = Math.round(height * pixelRatio);
    nebulaContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const minDimension = Math.min(width, height);
    if (nebulaBlobs.length && nebulaWidth && nebulaHeight) {
      const radiusScale = minDimension / Math.min(nebulaWidth, nebulaHeight);
      for (const blob of nebulaBlobs) {
        blob.x *= width / nebulaWidth;
        blob.y *= height / nebulaHeight;
        blob.radiusX *= radiusScale;
        blob.radiusY *= radiusScale;
      }
      nebulaWidth = width;
      nebulaHeight = height;
      linkNebulaBlobs();
      return;
    }
    nebulaWidth = width;
    nebulaHeight = height;
    const colors = ['108,78,151', '86,62,130', '127,83,151', '65,70,131'];
    const blobCount = Math.ceil(Math.max(7, Math.floor((width * height) / 80000)) / 2);
    nebulaBlobs = Array.from({ length: blobCount }, () => ({
      x: width * (0.04 + Math.random() * 0.92),
      y: height * (0.04 + Math.random() * 0.92),
      radiusX: minDimension * (0.105 + Math.random() * 0.224),
      radiusY: minDimension * (0.07 + Math.random() * 0.196),
      rotation: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      speed: NEBULA_MOTION.minimumSpeed + Math.random() * NEBULA_MOTION.speedVariation,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 0.25 + Math.random() * 0.16,
      radii: Array.from({ length: 11 }, () => 0.66 + Math.random() * 0.48),
    }));
    linkNebulaBlobs();
  }

  function nebulaReach(blob, directionX, directionY) {
    const angle = Math.atan2(directionY / blob.radiusY, directionX / blob.radiusX);
    const turns = (angle - blob.rotation) / (Math.PI * 2);
    const index = ((turns % 1 + 1) % 1) * blob.radii.length;
    const first = Math.floor(index);
    const next = (first + 1) % blob.radii.length;
    const radius = math.lerp(blob.radii[first], blob.radii[next], index - first);
    return radius / Math.hypot(directionX / blob.radiusX, directionY / blob.radiusY);
  }

  function linkNebulaBlobs() {
    const candidates = [];
    for (let a = 0; a < nebulaBlobs.length; a += 1) {
      for (let b = a + 1; b < nebulaBlobs.length; b += 1) {
        const first = nebulaBlobs[a];
        const second = nebulaBlobs[b];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (!distance) continue;
        const directionX = (second.x - first.x) / distance;
        const directionY = (second.y - first.y) / distance;
        const reachA = nebulaReach(first, directionX, directionY);
        const reachB = nebulaReach(second, -directionX, -directionY);
        const ratio = distance / (reachA + reachB);
        // Pair nearby outlines; distant and nested clouds keep their own form.
        if (ratio < 0.7 || ratio > 1.55) continue;
        candidates.push({ a, b, distance, directionX, directionY, reachA, reachB, ratio });
      }
    }
    candidates.sort((first, second) => Math.abs(first.ratio - 1) - Math.abs(second.ratio - 1));
    const paired = new Set();
    nebulaLinks = [];
    for (const candidate of candidates) {
      if (paired.has(candidate.a) || paired.has(candidate.b)) continue;
      paired.add(candidate.a);
      paired.add(candidate.b);
      const link = {
        ...candidate,
        scale: Math.min(candidate.reachA, candidate.reachB),
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.4,
      };
      nebulaLinks.push(link);
      nebulaBlobs[link.a].link = { link, sign: 1 };
      nebulaBlobs[link.b].link = { link, sign: -1 };
    }
  }

  function nebulaConnection(link, time) {
    const wave = 0.5 + 0.5 * Math.sin(time * 0.00016 * link.speed + link.phase);
    return math.smoothstep(wave, 0.15, 0.85);
  }

  function nebulaShape(blob, time) {
    const phase = time * 0.00016 * blob.speed + blob.phase;
    const flow = time * NEBULA_MOTION.flowRate * blob.speed;
    const rotation = blob.rotation + Math.sin(phase * 0.44) * 0.08;
    const connection = blob.link ? nebulaConnection(blob.link.link, time) : 0;
    const link = blob.link?.link;
    const targetGap = link ? link.scale * (0.35 - 0.55 * connection) : 0;
    const extension = link ? (link.distance - link.reachA - link.reachB - targetGap) * 0.5 : 0;
    const points = blob.radii.map((baseRadius, index) => {
      const angle = rotation + (index / blob.radii.length) * Math.PI * 2;
      // Broad lobes grow, recede, and travel independently. Even an isolated
      // cloud keeps reshaping; contact and separation follow its changing surface.
      const direction = index / blob.radii.length * Math.PI * 2;
      const nx = Math.cos(direction), ny = Math.sin(direction);
      const broad = nebulaNoise(nx * 1.1 + flow + blob.phase * 7,
        ny * 1.1 + flow * 0.53 + blob.phase * 3);
      const secondary = nebulaNoise(nx * 1.8 - flow * 1.67 + blob.phase * 11,
        ny * 1.8 + flow * 0.8 + blob.phase * 5);
      const pulse = 1 + (broad - 0.5) * 0.62 + (secondary - 0.5) * 0.28
        + Math.sin(phase + direction * 2) * 0.13;
      const offsetX = Math.cos(angle) * blob.radiusX;
      const offsetY = Math.sin(angle) * blob.radiusY;
      const length = Math.hypot(offsetX, offsetY);
      let radius = baseRadius * pulse;
      if (link) {
        const alignment = (offsetX * link.directionX + offsetY * link.directionY) / length * blob.link.sign;
        const lobe = Math.pow(Math.max(0, alignment), 5);
        const stretch = math.clamp(extension, -length * 0.4, length * 0.65);
        radius += stretch / length * lobe;
      }
      return { x: blob.x + offsetX * radius, y: blob.y + offsetY * radius };
    });
    const path = new Path2D();
    const first = points[0];
    const last = points[points.length - 1];
    path.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      path.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    path.closePath();
    return { blob, points, path };
  }

  // The original quadratic outlines become two surfaces of one smooth union.
  function nebulaSurface({ blob, points }) {
    const samples = [];
    for (let i = 0; i < points.length; i += 1) {
      const previous = points[(i + points.length - 1) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];
      for (let j = 0; j < 8; j += 1) {
        const t = j / 8, u = 1 - t;
        const x = u*u*(previous.x+current.x)/2 + 2*u*t*current.x + t*t*(current.x+next.x)/2 - blob.x;
        const y = u*u*(previous.y+current.y)/2 + 2*u*t*current.y + t*t*(current.y+next.y)/2 - blob.y;
        samples.push({ angle: (Math.atan2(y,x)+Math.PI*2)%(Math.PI*2), radius: Math.hypot(x,y) });
      }
    }
    samples.sort((a,b) => a.angle-b.angle);
    const radii = new Float32Array(128);
    let index = 0;
    for (let i = 0; i < radii.length; i += 1) {
      const angle = i/radii.length*Math.PI*2;
      while (index < samples.length && samples[index].angle < angle) index += 1;
      const left = samples[(index+samples.length-1)%samples.length];
      const right = samples[index%samples.length];
      const start = index === 0 ? left.angle-Math.PI*2 : left.angle;
      const end = index === samples.length ? right.angle+Math.PI*2 : right.angle;
      radii[i] = math.lerp(left.radius,right.radius,(angle-start)/(end-start));
    }
    return { blob, radii };
  }

  function nebulaDistance(surface,x,y) {
    const dx = x-surface.blob.x, dy = y-surface.blob.y;
    const index = ((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*surface.radii.length;
    const first = Math.floor(index);
    return Math.hypot(dx,dy)-math.lerp(surface.radii[first],surface.radii[(first+1)%surface.radii.length],index-first);
  }

  function mergedNebulaPath(a,b,link) {
    const surfaces = [nebulaSurface(a),nebulaSurface(b)];
    const points = [...a.points,...b.points];
    const blend = link.scale*0.32, padding = blend+12;
    const left = Math.min(...points.map(p=>p.x))-padding;
    const top = Math.min(...points.map(p=>p.y))-padding;
    const width = Math.max(...points.map(p=>p.x))+padding-left;
    const height = Math.max(...points.map(p=>p.y))+padding-top;
    // Bounded geometry grid; the output is smooth vector curves, not pixels.
    const step = Math.max(7,width/96,height/96);
    const columns = Math.ceil(width/step)+1, rows = Math.ceil(height/step)+1;
    const field = new Float32Array(columns*rows);
    for (let y=0;y<rows;y+=1) for (let x=0;x<columns;x+=1) {
      const first = nebulaDistance(surfaces[0],left+x*step,top+y*step);
      const second = nebulaDistance(surfaces[1],left+x*step,top+y*step);
      const h = Math.max(blend-Math.abs(first-second),0)/blend;
      field[y*columns+x] = Math.min(first,second)-h*h*blend*0.25;
    }
    const vertices = new Map(), adjacency = new Map();
    function edge(x,y,vertical) {
      const id = (y*columns+x)*2+Number(vertical);
      if (!vertices.has(id)) {
        const start = field[y*columns+x];
        const end = field[(y+Number(vertical))*columns+x+Number(!vertical)];
        const t = start/(start-end);
        vertices.set(id,{x:left+(x+(vertical?0:t))*step,y:top+(y+(vertical?t:0))*step});
      }
      return id;
    }
    function connect(a,b) {
      if (!adjacency.has(a)) adjacency.set(a,[]);
      if (!adjacency.has(b)) adjacency.set(b,[]);
      adjacency.get(a).push(b); adjacency.get(b).push(a);
    }
    for (let y=0;y<rows-1;y+=1) for (let x=0;x<columns-1;x+=1) {
      const v = [field[y*columns+x],field[y*columns+x+1],field[(y+1)*columns+x+1],field[(y+1)*columns+x]];
      const edges = [];
      if ((v[0]<0)!==(v[1]<0)) edges.push(edge(x,y,false));
      if ((v[1]<0)!==(v[2]<0)) edges.push(edge(x+1,y,true));
      if ((v[2]<0)!==(v[3]<0)) edges.push(edge(x,y+1,false));
      if ((v[3]<0)!==(v[0]<0)) edges.push(edge(x,y,true));
      if (edges.length===2) connect(edges[0],edges[1]);
      if (edges.length===4) {
        if ((v.reduce((sum,value)=>sum+value,0)<0)===(v[0]<0)) {
          connect(edges[0],edges[1]); connect(edges[2],edges[3]);
        } else { connect(edges[0],edges[3]); connect(edges[1],edges[2]); }
      }
    }
    const path = new Path2D(), visited = new Set();
    for (const start of adjacency.keys()) {
      if (visited.has(start)) continue;
      const contour = [];
      let current = start;
      while (!visited.has(current)) {
        visited.add(current); contour.push(vertices.get(current));
        const next = adjacency.get(current).find(id=>!visited.has(id));
        if (next===undefined) break;
        current = next;
      }
      if (contour.length<3) continue;
      const first = contour[0], last = contour[contour.length-1];
      path.moveTo((first.x+last.x)/2,(first.y+last.y)/2);
      contour.forEach((point,index)=>{
        const next = contour[(index+1)%contour.length];
        path.quadraticCurveTo(point.x,point.y,(point.x+next.x)/2,(point.y+next.y)/2);
      });
      path.closePath();
    }
    return path;
  }

  let cachedClouds = [], cloudTime = -1;
  function drawNebula(time, context = nebulaContext) {
    const width = host.clientWidth;
    const height = nebulaCanvas.clientHeight;
    context.clearRect(0, 0, width, height);
    if (cloudTime !== time) {
    const shapes = nebulaBlobs.map(blob => nebulaShape(blob, time));
    const paired = new Set();
    const clouds = [];
    for (const link of nebulaLinks) {
      const a = shapes[link.a], b = shapes[link.b];
      paired.add(link.a); paired.add(link.b);
      clouds.push({ path: mergedNebulaPath(a,b,link), blobs: [a.blob,b.blob] });
    }
    shapes.forEach((shape,index)=>{
      if (!paired.has(index)) clouds.push({ path: shape.path, blobs: [shape.blob] });
    });
    cachedClouds = clouds;
    cloudTime = time;
    }
    for (const { path, blobs } of cachedClouds) {
      // Shade the complete shared contour; there is no separate connector layer.
      for (const [index,blob] of blobs.entries()) {
        const color = mixColor(blob.color.split(',').map(Number), goldenColors[nebulaBlobs.indexOf(blob) % goldenColors.length]);
        const x = blob.x;
        const y = blob.y;
        const gradient = context.createRadialGradient(
          x - blob.radiusX * 0.18,
          y - blob.radiusY * 0.2,
          0,
          x,
          y,
          Math.max(blob.radiusX, blob.radiusY) * 1.12,
        );
        gradient.addColorStop(0, `rgba(${color},${blob.opacity})`);
        gradient.addColorStop(0.62, `rgba(${color},${blob.opacity * 0.72})`);
        gradient.addColorStop(1, `rgba(${color},${blob.opacity * 0.08})`);

        context.save();
        context.shadowColor = `rgba(${color},${blob.opacity * 0.75})`;
        context.shadowBlur = index === 0 ? Math.max(blob.radiusX, blob.radiusY) * 0.45 : 0;
        context.fillStyle = gradient;
        context.fill(path);
        context.restore();
      }
    }
  }

  function resizeStarfield() {
    const width = host.clientWidth;
    const height = nebulaCanvas.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (!width || !height) return;

    const oldWidth = starfieldWidth, oldHeight = starfieldHeight;
    starfieldWidth = width;
    starfieldHeight = height;
    starCanvas.width = Math.round(width * pixelRatio);
    starCanvas.height = Math.round(height * pixelRatio);
    starContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (stars.length && oldWidth && oldHeight) {
      for (const star of stars) {
        star.x *= width / oldWidth;
        star.y *= height / oldHeight;
      }
      return;
    }

    const starCount = Math.max(48, Math.floor((width * height) / 11000));
    stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() > 0.78 ? 2 : 1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() * 1.4,
      cross: Math.random() > 0.80,
      color: Math.random() > 0.77 ? '#fff18a' : (Math.random() > 0.5 ? '#e5cf45' : '#bca735'),
    }));
  }

  function drawStarfield(time, context = starContext) {
    context.clearRect(0, 0, starfieldWidth, starfieldHeight);
    for (const star of stars) {
      const shimmer = 0.35 + (0.65 * (0.5 + 0.5 * Math.sin(time * 0.001 * star.speed + star.phase)));
      const x = Math.round(star.x);
      const y = Math.round(star.y);
      context.globalAlpha = shimmer;
      const starRgb = [1, 3, 5].map(offset => parseInt(star.color.slice(offset, offset + 2), 16));
      context.fillStyle = `rgb(${mixColor(starRgb, [65, 45, 84])})`;
      context.fillRect(x, y, star.size, star.size);
      if (star.cross) {
        context.globalAlpha = shimmer * 0.82;
        context.fillRect(x - 2, y + 1, 5, 1);
        context.fillRect(x, y - 1, 1, 5);
      }
    }
    context.globalAlpha = 1;
  }

  const alternateClouds = document.createElement('canvas');
  const alternateStars = document.createElement('canvas');
  let alternateTime = -Infinity;
  const api = {
    resize() {
      const width = host.clientWidth, height = nebulaCanvas.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (!width || !height || (width === backgroundWidth && height === backgroundHeight && ratio === backgroundRatio)) return;
      backgroundWidth = width; backgroundHeight = height; backgroundRatio = ratio;
      resizeNebula(); resizeStarfield(); cloudTime = -1; alternateTime = -Infinity;
      nebulaLastDraw = -Infinity;
    },
    drawRegion(context, bounds, time) {
      if (time - alternateTime >= 33) {
        if (alternateClouds.width !== nebulaCanvas.width || alternateClouds.height !== nebulaCanvas.height) {
          alternateClouds.width = nebulaCanvas.width; alternateClouds.height = nebulaCanvas.height;
        }
        if (alternateStars.width !== starCanvas.width || alternateStars.height !== starCanvas.height) {
          alternateStars.width = starCanvas.width; alternateStars.height = starCanvas.height;
        }
        const cloudContext = alternateClouds.getContext('2d'), starsContext = alternateStars.getContext('2d');
        cloudContext.setTransform(nebulaCanvas.width / backgroundWidth, 0, 0, nebulaCanvas.height / backgroundHeight, 0, 0);
        starsContext.setTransform(starCanvas.width / backgroundWidth, 0, 0, starCanvas.height / backgroundHeight, 0, 0);
        const previousPalette = paletteProgress;
        paletteProgress = 0;
        // Use the last main-cloud pose: both palettes share exactly one contour.
        drawNebula(cloudTime < 0 ? time : cloudTime, cloudContext);
        drawStarfield(time, starsContext);
        paletteProgress = previousPalette;
        alternateTime = time;
      }
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.fillStyle = '#030306'; context.fillRect(0, 0, bounds.width, bounds.height);
      const origin = host.getBoundingClientRect();
      for (const canvas of [alternateClouds, alternateStars]) {
        const ratioX = canvas.width / backgroundWidth, ratioY = canvas.height / backgroundHeight;
        context.drawImage(canvas, (bounds.left - origin.left) * ratioX, (bounds.top - origin.top) * ratioY,
          bounds.width * ratioX, bounds.height * ratioY, 0, 0, bounds.width, bounds.height);
      }
    },
    draw(time, progress = 0) {
      paletteProgress = math.clamp(progress, 0, 1);
      if (time - nebulaLastDraw >= 33) {
        drawNebula(time);
        nebulaLastDraw = time;
      }
      drawStarfield(time);
    },
  };
  activeBackground = api;
  return api;
}
