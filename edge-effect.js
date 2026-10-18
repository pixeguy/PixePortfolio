import * as THREE from 'three';

// Shared post-process settings for the person, cat, and mask.
export const EDGE_SETTINGS = {
  threshold: 0.5,
  thickness: 1, // CSS pixels; independent of display pixel density.
  color: '#d4c444',
};

export function createEdgeEffect(renderer) {
  const normals = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      normalTexture: { value: target.texture },
      pixelOffset: { value: new THREE.Vector2() },
      edgeThreshold: { value: EDGE_SETTINGS.threshold },
      blitThreshold: { value: 0 },
      outlineColor: { value: new THREE.Color(EDGE_SETTINGS.color) },
      boundaryEnabled: { value: 0 },
      boundaryTop: { value: 0 },
      boundaryBottom: { value: 1 },
      boundaryCurve: { value: 0 },
      boundaryColor: { value: new THREE.Color('#d4c444') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D normalTexture;
      uniform vec2 pixelOffset;
      uniform float edgeThreshold;
      uniform float blitThreshold;
      uniform vec3 outlineColor;
      uniform float boundaryEnabled;
      uniform float boundaryTop;
      uniform float boundaryBottom;
      uniform float boundaryCurve;
      uniform vec3 boundaryColor;
      varying vec2 vUv;
      vec3 decodeNormal(vec4 sampleValue) {
        return (sampleValue.rgb * 2.0 - 1.0) * step(0.5, sampleValue.a);
      }
      void main() {
        vec4 right = texture2D(normalTexture, vUv + vec2(pixelOffset.x, 0.0));
        vec4 left = texture2D(normalTexture, vUv - vec2(pixelOffset.x, 0.0));
        vec4 up = texture2D(normalTexture, vUv + vec2(0.0, pixelOffset.y));
        vec4 down = texture2D(normalTexture, vUv - vec2(0.0, pixelOffset.y));
        // Unity's opposite-neighbour normal comparison.
        float difference = length(decodeNormal(right) - decodeNormal(left))
          + length(decodeNormal(up) - decodeNormal(down));
        float normalEdge = step(edgeThreshold, difference);
        // Alpha also catches silhouettes against the transparent background.
        float silhouette = max(abs(right.a - left.a), abs(up.a - down.a));
        float outline = max(normalEdge, silhouette);
        if (blitThreshold > 0.0) {
          float strength = max(difference, silhouette);
          outline *= smoothstep(blitThreshold - 0.1, blitThreshold + 0.1, strength);
        }
        // Match the section's elliptical CSS corners at both its entrance and exit.
        float horizontal = vUv.x * 2.0 - 1.0;
        float curve = boundaryCurve * (1.0 - sqrt(max(0.0, 1.0 - horizontal * horizontal)));
        float screenY = 1.0 - vUv.y;
        float insideSection = boundaryEnabled * step(boundaryTop + curve, screenY)
          * step(screenY, boundaryBottom - curve);
        gl_FragColor = vec4(mix(outlineColor, boundaryColor, insideSection), outline);
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const screen = new THREE.Scene();
  screen.add(new THREE.Mesh(geometry, material));
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bufferSize = new THREE.Vector2();
  const previousColor = new THREE.Color();
  let colorOverride = null;

  return {
    setColors(outline = null, boundary = '#d4c444') {
      colorOverride = outline;
      material.uniforms.boundaryColor.value.set(boundary);
    },
    setBlitThreshold(value) {
      material.uniforms.blitThreshold.value = Math.max(0, value);
    },
    setColorBoundary(top, bottom, curve) {
      material.uniforms.boundaryEnabled.value = top < 1 && bottom > 0 ? 1 : 0;
      material.uniforms.boundaryTop.value = top;
      material.uniforms.boundaryBottom.value = bottom;
      material.uniforms.boundaryCurve.value = curve;
    },
    render(scene, camera) {
      renderer.getDrawingBufferSize(bufferSize);
      if (target.width !== bufferSize.x || target.height !== bufferSize.y) {
        target.setSize(bufferSize.x, bufferSize.y);
      }
      const offset = EDGE_SETTINGS.thickness * renderer.getPixelRatio();
      material.uniforms.pixelOffset.value.set(offset / bufferSize.x, offset / bufferSize.y);
      material.uniforms.edgeThreshold.value = EDGE_SETTINGS.threshold;
      material.uniforms.outlineColor.value.set(colorOverride || EDGE_SETTINGS.color);
      const previousTarget = renderer.getRenderTarget();
      const previousMaterial = scene.overrideMaterial;
      const previousAlpha = renderer.getClearAlpha();
      renderer.getClearColor(previousColor);
      try {
        scene.overrideMaterial = normals;
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        scene.overrideMaterial = previousMaterial;
        renderer.setRenderTarget(previousTarget);
        renderer.clear();
        renderer.render(screen, screenCamera);
      } finally {
        scene.overrideMaterial = previousMaterial;
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(previousColor, previousAlpha);
      }
    },
    destroy() {
      target.dispose();
      normals.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
