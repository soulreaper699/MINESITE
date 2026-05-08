// VOXEL — WebGL Engine (6-Scene Minecraft Edition)

const canvas  = document.getElementById('webgl-canvas');
const scene   = new THREE.Scene();
const camera  = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 2000);
camera.position.set(0, 30, 180);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference:'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x050505, 1);

// =========================================================================
// FBO PING-PONG SETUP
// =========================================================================
const SIZE  = 256;
const COUNT = SIZE * SIZE; // 65,536 voxels

function makeFBO() {
  return new THREE.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, type: THREE.FloatType,
    depthBuffer: false, stencilBuffer: false
  });
}
let posA = makeFBO(), posB = makeFBO();
let velA = makeFBO(), velB = makeFBO();

const simScene  = new THREE.Scene();
const simCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const simMesh   = new THREE.Mesh(new THREE.PlaneGeometry(2,2));
simScene.add(simMesh);

const passVert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`;

// Simplex & Curl Noise GLSL
const NOISE_GLSL = `
vec3 mod289v(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289v(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289v(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289v(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 curl(vec3 p){
  const float e=0.1;
  vec3 dx=vec3(e,0,0),dy=vec3(0,e,0),dz=vec3(0,0,e);
  vec3 px0=vec3(snoise(p-dx),snoise(p-dx+vec3(12.3)),snoise(p-dx+vec3(24.6)));
  vec3 px1=vec3(snoise(p+dx),snoise(p+dx+vec3(12.3)),snoise(p+dx+vec3(24.6)));
  vec3 py0=vec3(snoise(p-dy),snoise(p-dy+vec3(12.3)),snoise(p-dy+vec3(24.6)));
  vec3 py1=vec3(snoise(p+dy),snoise(p+dy+vec3(12.3)),snoise(p+dy+vec3(24.6)));
  vec3 pz0=vec3(snoise(p-dz),snoise(p-dz+vec3(12.3)),snoise(p-dz+vec3(24.6)));
  vec3 pz1=vec3(snoise(p+dz),snoise(p+dz+vec3(12.3)),snoise(p+dz+vec3(24.6)));
  float x=py1.z-py0.z-pz1.y+pz0.y;
  float y=pz1.x-pz0.x-px1.z+px0.z;
  float z=px1.y-px0.y-py1.x+py0.x;
  return vec3(x,y,z)/(2.0*e);
}
`;

// Velocity shader — handles ALL 6 biome scenes
const velMat = new THREE.ShaderMaterial({
  uniforms:{
    tPos:{value:null},tVel:{value:null},tOrigin:{value:null},
    uTime:{value:0},uScene:{value:0},uAero:{value:0.5},uAudio:{value:0}
  },
  vertexShader: passVert,
  fragmentShader:`
    uniform sampler2D tPos,tVel,tOrigin;
    uniform float uTime,uScene,uAero,uAudio;
    varying vec2 vUv;
    ${NOISE_GLSL}
    void main(){
      vec3 pos=texture2D(tPos,vUv).xyz;
      vec3 vel=texture2D(tVel,vUv).xyz;
      vec3 ori=texture2D(tOrigin,vUv).xyz;

      // ---- Scene 0: OVERWORLD — Sculk wind tunnel ----
      if(uScene<0.5){
        vec3 f=curl(pos*0.04+vec3(uTime*1.5,0,0))*uAero*(1.0+uAudio*6.0);
        f.x-=(1.5+uAudio*8.0);
        f.y+=-pos.y*0.008; f.z+=-pos.z*0.008;
        if(pos.x<-160.0){pos.x=160.0;pos.y=ori.y;pos.z=ori.z;vel=vec3(0);}
        vel=vel*0.88+f*0.12;

      // ---- Scene 1: ARMORY — Pickaxe formation ----
      }else if(uScene<1.5){
        vec3 tv=(ori-pos)*0.12;
        vec3 n=curl(pos*0.08+uTime*0.3)*0.04;
        vel=vel*0.82+tv+n;

      // ---- Scene 2: NETHER — Lava convection ----
      }else if(uScene<2.5){
        vec3 f=curl(pos*0.05+vec3(0,uTime*0.8,0))*1.2*(1.0+uAudio*4.0);
        f.y+=2.5; // buoyancy
        f.x+=sin(pos.y*0.05+uTime)*0.5;
        if(pos.y>80.0){pos.y=-80.0;vel.y=0.0;}
        if(pos.y<-80.0){pos.y=80.0;}
        vel=vel*0.92+f*0.08;

      // ---- Scene 3: REDSTONE — Pulsing sphere ----
      }else if(uScene<3.5){
        float r=55.0+sin(uTime*3.0)*8.0+uAudio*35.0;
        float phi=ori.x*0.05; float theta=ori.y*0.05;
        vec3 tp=vec3(r*sin(phi)*cos(theta),r*sin(phi)*sin(theta),r*cos(phi));
        vec3 tv=(tp-pos)*0.04;
        vec3 tang=normalize(cross(pos,vec3(0,1,0)));
        vel=vel*0.9+tv+tang*(2.0+uAudio*12.0);

      // ---- Scene 4: THE END — Void drift, endermen teleport ----
      }else if(uScene<4.5){
        vec3 f=curl(pos*0.03+uTime*0.5)*0.6;
        // Random teleport when dist > threshold
        float d=length(pos);
        if(d>140.0||d<5.0){
          pos=ori*120.0; vel=vec3(0);
        }
        vel=vel*0.95+f*0.05;

      // ---- Scene 5: RESERVE — Blocks settle / rain down ----
      }else{
        vel.y-=0.15; // gravity
        if(pos.y<-60.0){vel.y*=-0.3; vel.xz*=0.9; pos.y=-60.0;}
        vel*=0.97;
      }
      gl_FragColor=vec4(vel,1.0);
    }
  `
});

const posMat = new THREE.ShaderMaterial({
  uniforms:{ tPos:{value:null}, tVel:{value:null} },
  vertexShader: passVert,
  fragmentShader:`
    uniform sampler2D tPos,tVel; varying vec2 vUv;
    void main(){
      vec3 pos=texture2D(tPos,vUv).xyz;
      vec3 vel=texture2D(tVel,vUv).xyz;
      gl_FragColor=vec4(pos+vel,1.0);
    }
  `
});

// =========================================================================
// INIT DATA TEXTURES
// =========================================================================
const dataPos    = new Float32Array(COUNT*4);
const dataOrigin = new Float32Array(COUNT*4);
const dataVel    = new Float32Array(COUNT*4);

for(let i=0; i<COUNT; i++){
  // Procedural Diamond Pickaxe
  let x, y, z;
  const r = Math.random();
  if(r < 0.45){
    // Handle (diagonal rod)
    const t = (Math.random()-0.5)*110;
    x = t + (Math.random()-0.5)*7;
    y = t + (Math.random()-0.5)*7;
    z = (Math.random()-0.5)*7;
  } else if(r < 0.85){
    // Pickaxe head arc
    const ang = (Math.random()-0.5)*Math.PI*0.75;
    const rad = 50 + (Math.random()-0.5)*10;
    const nx = Math.cos(ang)*rad;
    const ny = Math.sin(ang)*rad;
    x =  nx*0.707 - ny*0.707 + 42;
    y =  nx*0.707 + ny*0.707 + 42;
    z = (Math.random()-0.5)*11;
  } else {
    // Tips
    const side = Math.random() > 0.5 ? 1 : -1;
    x = side*80 + (Math.random()-0.5)*12;
    y = side*80 + (Math.random()-0.5)*12;
    z = (Math.random()-0.5)*8;
  }

  // Scatter start positions
  dataPos[i*4]   = (Math.random()-0.5)*300;
  dataPos[i*4+1] = (Math.random()-0.5)*300;
  dataPos[i*4+2] = (Math.random()-0.5)*300;
  dataPos[i*4+3] = 1;
  dataOrigin[i*4]=x; dataOrigin[i*4+1]=y; dataOrigin[i*4+2]=z; dataOrigin[i*4+3]=1;
  dataVel[i*4]=0; dataVel[i*4+1]=0; dataVel[i*4+2]=0; dataVel[i*4+3]=1;
}

function fillFBO(rt, arr){
  simMesh.material = new THREE.ShaderMaterial({
    uniforms:{ t:{value:new THREE.DataTexture(arr,SIZE,SIZE,THREE.RGBAFormat,THREE.FloatType)} },
    vertexShader: passVert,
    fragmentShader:`uniform sampler2D t;varying vec2 vUv;void main(){gl_FragColor=texture2D(t,vUv);}`
  });
  simMesh.material.uniforms.t.value.needsUpdate = true;
  renderer.setRenderTarget(rt); renderer.render(simScene, simCamera); renderer.setRenderTarget(null);
}
fillFBO(posA, dataPos); fillFBO(posB, dataPos);
fillFBO(velA, dataVel); fillFBO(velB, dataVel);
velMat.uniforms.tOrigin.value = new THREE.DataTexture(dataOrigin,SIZE,SIZE,THREE.RGBAFormat,THREE.FloatType);
velMat.uniforms.tOrigin.value.needsUpdate = true;

// =========================================================================
// PARTICLE RENDER MESH
// =========================================================================
const geo = new THREE.BufferGeometry();
const uvs = new Float32Array(COUNT*2);
for(let i=0;i<COUNT;i++){
  uvs[i*2]   = ((i%SIZE)+0.5)/SIZE;
  uvs[i*2+1] = (Math.floor(i/SIZE)+0.5)/SIZE;
}
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT*3), 3));
geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));

const voxelMat = new THREE.ShaderMaterial({
  transparent: false, depthWrite: true,
  uniforms:{ tPos:{value:null}, uScene:{value:0}, uMat:{value:0}, uAudio:{value:0} },
  vertexShader:`
    uniform sampler2D tPos;
    uniform float uScene,uMat,uAudio;
    varying vec3 vColor;
    void main(){
      vec3 pos=texture2D(tPos,uv).xyz;
      vec4 mv=modelViewMatrix*vec4(pos,1.0);
      gl_Position=projectionMatrix*mv;

      // Biome color palette
      if(uScene<0.5){
        // Overworld: sculk blue-green
        vColor=mix(vec3(0.0,0.25,0.2),vec3(0.0,0.9,1.0),uAudio*3.0);
      }else if(uScene<1.5){
        // Armory: obsidian or diamond
        if(uMat<0.5) vColor=mix(vec3(0.1,0.05,0.15),vec3(0.2,0.1,0.3),uAudio*3.0);
        else vColor=vec3(0.1,0.85,1.0)+uAudio*1.2;
      }else if(uScene<2.5){
        // Nether: lava orange/red
        float heat=abs(sin(pos.y*0.05))*0.5+0.5;
        vColor=mix(vec3(0.8,0.1,0.0),vec3(1.0,0.5,0.0),heat+uAudio);
      }else if(uScene<3.5){
        // Redstone
        vColor=vec3(0.9+uAudio,0.05,0.05);
      }else if(uScene<4.5){
        // The End: purple void
        vColor=mix(vec3(0.3,0.0,0.5),vec3(0.7,0.3,1.0),uAudio*2.0);
      }else{
        // Reserve: cobblestone
        vColor=vec3(0.35,0.35,0.35);
      }

      gl_PointSize=clamp(5.0*(300.0/-mv.z), 1.0, 12.0);
    }
  `,
  fragmentShader:`
    varying vec3 vColor;
    void main(){
      // Pixelated square voxel with darker border
      vec2 uv=gl_PointCoord-0.5;
      float bd=max(abs(uv.x),abs(uv.y));
      vec3 col=vColor;
      if(bd>0.42) col*=0.55; // darker edges = 3D block illusion
      gl_FragColor=vec4(col,1.0);
    }
  `
});

const points = new THREE.Points(geo, voxelMat);
scene.add(points);

// =========================================================================
// BLOOM POST-PROCESSING
// =========================================================================
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.3, 0.1);
composer.addPass(bloom);

// =========================================================================
// SCROLL TRIGGER → scene morph
// =========================================================================
setTimeout(()=>{
  gsap.registerPlugin(ScrollTrigger);
  const sectionIds = ['#home','#armory','#nether','#redstone','#end','#reserve'];

  sectionIds.forEach((id, i) => {
    const el = document.querySelector(id);
    if(!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top center',
      end:   'bottom center',
      scrub: 1.5,
      onUpdate: self => {
        const target = i + self.progress;
        gsap.to(velMat.uniforms.uScene, { value: target, duration: 0.8, ease:'none', overwrite:true });
        gsap.to(voxelMat.uniforms.uScene, { value: target, duration: 0.8, ease:'none', overwrite:true });
        if(window.updateF3Scene) window.updateF3Scene(target);
      }
    });
  });

  // Cinematic camera sweeps per section
  const cameraPositions = [
    {x:0,   y:30,  z:180},  // Overworld
    {x:80,  y:20,  z:120},  // Armory (side view of pickaxe)
    {x:0,   y:-40, z:160},  // Nether (looking up at lava)
    {x:0,   y:30,  z:180},  // Redstone sphere
    {x:20,  y:60,  z:200},  // The End
    {x:0,   y:80,  z:160},  // Reserve (top-down rain)
  ];

  sectionIds.forEach((id, i) => {
    const el = document.querySelector(id);
    if(!el) return;
    const cp = cameraPositions[i];
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end:   'center center',
      scrub: 2,
      onUpdate: self => {
        camera.position.lerp(new THREE.Vector3(cp.x, cp.y, cp.z), self.progress * 0.06);
      }
    });
  });
}, 400);

// =========================================================================
// RENDER LOOP
// =========================================================================
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Feed globals from app.js
  velMat.uniforms.uTime.value  = t;
  velMat.uniforms.uAero.value  = window.aeroForce  ?? 0.5;
  velMat.uniforms.uAudio.value = window.audioAvg   ?? 0;
  voxelMat.uniforms.uMat.value   = window.materialState ?? 0;
  voxelMat.uniforms.uAudio.value = window.audioAvg     ?? 0;

  // Velocity step
  simMesh.material = velMat;
  velMat.uniforms.tPos.value = posA.texture;
  velMat.uniforms.tVel.value = velA.texture;
  renderer.setRenderTarget(velB); renderer.render(simScene, simCamera);

  // Position step
  simMesh.material = posMat;
  posMat.uniforms.tPos.value = posA.texture;
  posMat.uniforms.tVel.value = velB.texture;
  renderer.setRenderTarget(posB); renderer.render(simScene, simCamera);

  // Swap buffers
  let tmp=posA; posA=posB; posB=tmp;
  tmp=velA; velA=velB; velB=tmp;

  voxelMat.uniforms.tPos.value = posA.texture;

  // Rotate pickaxe in scene 1
  const sc = velMat.uniforms.uScene.value;
  points.rotation.y = (sc>0.5 && sc<1.5) ? t*0.08 : 0;

  // HUD Blueprint Tracking
  if(sc>0.5 && sc<1.5){
    const tip = new THREE.Vector3(100, 100, 0).applyMatrix4(points.matrixWorld).project(camera);
    const hud = document.getElementById('hud-width');
    if(hud){
      hud.style.left = ((tip.x*0.5+0.5)*innerWidth)+'px';
      hud.style.top  = ((-(tip.y*0.5-0.5))*innerHeight)+'px';
    }
  }

  camera.lookAt(0,0,0);
  renderer.setRenderTarget(null);
  composer.render();
}
animate();

// Resize
window.addEventListener('resize',()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
