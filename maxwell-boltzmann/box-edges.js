import * as THREE from './vendor/three.module.min.js';

// One screen-space antialiased stroke for each physical edge. Constant pixel
// width prevents overlapping subpixel line layers from beating during orbit.
export function createBoxEdges(size) {
  const h=size/2, starts=[], ends=[];
  const add=(a,b)=>{starts.push(...a);ends.push(...b);};
  for(const y of [-h,h]) for(const z of [-h,h]) add([-h,y,z],[h,y,z]);
  for(const x of [-h,h]) for(const z of [-h,h]) add([x,-h,z],[x,h,z]);
  for(const x of [-h,h]) for(const y of [-h,h]) add([x,y,-h],[x,y,h]);
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));
  geometry.setIndex([0,1,2,2,1,3]);
  geometry.setAttribute('edgeStart',new THREE.InstancedBufferAttribute(new Float32Array(starts),3));
  geometry.setAttribute('edgeEnd',new THREE.InstancedBufferAttribute(new Float32Array(ends),3));
  geometry.instanceCount=12;
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{resolution:{value:new THREE.Vector2(1,1)},opacity:{value:.62}},
    vertexShader:`
      attribute vec3 edgeStart;
      attribute vec3 edgeEnd;
      uniform vec2 resolution;
      varying vec2 strokePosition;
      varying float strokeLength;
      void main() {
        vec4 a=projectionMatrix*modelViewMatrix*vec4(edgeStart,1.0);
        vec4 b=projectionMatrix*modelViewMatrix*vec4(edgeEnd,1.0);
        vec2 delta=(b.xy/b.w-a.xy/a.w)*resolution*.5;
        float len=max(length(delta),.0001);
        vec2 tangent=delta/len;
        vec2 normal=vec2(-tangent.y,tangent.x);
        float endPoint=step(0.0,position.x);
        vec4 endpoint=mix(a,b,endPoint);
        float extent=1.2;
        vec2 offset=(normal*position.y+tangent*position.x)*extent;
        // w=1 gives screen-linear interpolation for a uniform coverage ramp.
        gl_Position=vec4(endpoint.xyz/endpoint.w+vec3(offset*2.0/resolution,0.0),1.0);
        strokePosition=vec2(endPoint*len+position.x*extent,position.y*extent);
        strokeLength=len;
      }`,
    fragmentShader:`
      uniform float opacity;
      varying vec2 strokePosition;
      varying float strokeLength;
      void main() {
        vec2 nearest=vec2(clamp(strokePosition.x,0.0,strokeLength),0.0);
        float d=length(strokePosition-nearest);
        float coverage=1.0-smoothstep(.15,1.15,d);
        gl_FragColor=vec4(vec3(.88),opacity*coverage);
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.frustumCulled=false;
  mesh.renderOrder=1;
  return mesh;
}
