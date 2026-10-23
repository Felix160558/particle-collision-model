import * as THREE from './vendor/three.module.min.js';
import { createBoxEdges } from './box-edges.js';
import { createGestureView } from './gesture-view.js?v=20261014f';
import { countAndFit } from './gesture-science.js?v=20261014';
import { ReactionSystem,SPECIES,kinetic,atomCounts } from './reaction-physics.js?v=20261014f';
import {createDiffuseView} from './reaction-diffuse.js?v=20261014d';

const $=selector=>document.querySelector(selector);
const viewport=$('#threeViewport'),curtain=$('#startCurtain'),slider=$('#temperatureSlider');
const system=new ReactionSystem({count:2500,temperature:0});
const mixtureDialog=$('#mixtureDialog'),mixtureKeys=['H2','I2','HI'];
const maximumMolecules=2500;
let configured=false,mixtureWasRunning=false;
let renderer,scene,camera,edges,atomMesh,bondMesh,shellMesh,pulse,diffuseView;
let diffuseMode=false;
let running=false,started=false,showShells=false,gestureMode=false,gestureView,restore;
let yaw=-.66,pitch=.43,distance=14.2,isDragging=false,dragX=0,dragY=0;
let lastFrame=performance.now(),lastUI=-Infinity,lastChart=-Infinity,chartFit;
const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),axis=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
const color=new THREE.Color(),position=new THREE.Vector3(),scale=new THREE.Vector3();
const sphereGeometry=new THREE.SphereGeometry(1,12,8),bondGeometry=new THREE.CylinderGeometry(1,1,1,8);
const atomMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.42,metalness:0});
const bondMaterial=new THREE.MeshBasicMaterial({color:0xbcbcbc});
const shellMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.11,wireframe:true,depthWrite:false});
const chart=$('#energyChart'),ctx=chart.getContext('2d');

function failure(error) {
  $('#failure').hidden=false;curtain.classList.add('hidden');
  $('#failureDetail').textContent='The 3D view could not start. Enable WebGL or use another browser.';
  $('#stateLabel').textContent='UNAVAILABLE';console.error(error);
}
function init() {
  if(location.protocol==='file:') return;
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    viewport.append(renderer.domElement);
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(38,1,.1,100);
    scene.add(new THREE.HemisphereLight(0xffffff,0x353535,2.4));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,7,9);scene.add(light);
    edges=createBoxEdges(10);scene.add(edges);
    const volume=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.017,side:THREE.BackSide,depthWrite:false}));scene.add(volume);
    const grid=new THREE.GridHelper(10,10,0x444444,0x222222);grid.position.y=-5;grid.material.transparent=true;grid.material.opacity=.14;scene.add(grid);
    pulse=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:0,depthWrite:false}));pulse.visible=false;scene.add(pulse);
    createMeshes();resize();updateCamera();attachPointer();
    diffuseView=createDiffuseView({THREE,viewport,camera,getParticles:()=>system.particles});
    new ResizeObserver(resize).observe(viewport);
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();running=false;failure(new Error('WebGL context lost'));});
    document.documentElement.dataset.reactionReady='true';
    $('#stateLabel').textContent='READY';$('#startStatus').textContent='INITIAL MIXTURE · READY TO COLLIDE';$('#startButton').disabled=false;
    updateUI();requestAnimationFrame(animate);openMixture();
  } catch(error) {failure(error);}
}
function createMeshes() {
  for(const mesh of [atomMesh,bondMesh,shellMesh]) if(mesh) {scene.remove(mesh);mesh.dispose();}
  const count=system.initialCount;
  atomMesh=new THREE.InstancedMesh(sphereGeometry,atomMaterial,count*2);
  bondMesh=new THREE.InstancedMesh(bondGeometry,bondMaterial,count);
  shellMesh=new THREE.InstancedMesh(sphereGeometry,shellMaterial,count*2);
  for(const mesh of [atomMesh,bondMesh,shellMesh]) {mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}
  shellMesh.visible=showShells;
  syncMeshes();
}
function syncMeshes() {
  atomMesh.visible=bondMesh.visible=!diffuseMode;shellMesh.visible=showShells&&!diffuseMode;
  let aIndex=0,bIndex=0;
  system.particles.forEach((p,i)=>{
    const sp=SPECIES[p.species];
    color.setHex(sp.color);
    const offsets=[];
    sp.atoms.forEach((atom,j)=>{
      const offset=sp.atoms.length===1?0:(j===0?-1:1)*sp.length*SPECIES[sp.atoms[1-j]].mass/sp.mass;
      offsets.push(offset);
      position.set(...p.p).addScaledVector(axis.set(...p.axis),offset);
      const r=atom==='H' ? .025 : .074;
      matrix.makeScale(r,r,r);matrix.setPosition(position);
      atomMesh.setMatrixAt(aIndex,matrix);atomMesh.setColorAt(aIndex,color);aIndex++;
    });
    if(sp.atoms.length===2) {
      position.set(...p.p).addScaledVector(axis.set(...p.axis),(offsets[0]+offsets[1])/2);
      quaternion.setFromUnitVectors(up,axis);
      matrix.compose(position,quaternion,scale.set(.008,sp.length,.008));
      bondMesh.setMatrixAt(bIndex++,matrix);
    }
    if(showShells) {
      // Molecular volume stays fixed. Only halo extension encodes speed.
      const halo=sp.radius+Math.hypot(...p.v)*.000018;
      matrix.makeScale(halo,halo,halo);matrix.setPosition(...p.p);
      shellMesh.setMatrixAt(i,matrix);shellMesh.setColorAt(i,color);
    }
  });
  atomMesh.count=aIndex;bondMesh.count=bIndex;shellMesh.count=system.particles.length;
  atomMesh.instanceMatrix.needsUpdate=true;atomMesh.instanceColor.needsUpdate=true;
  bondMesh.instanceMatrix.needsUpdate=true;
  if(showShells) {shellMesh.instanceMatrix.needsUpdate=true;shellMesh.instanceColor.needsUpdate=true;}
  if(!diffuseMode && system.lastEvent?.position && system.particles.some(p=>p.flash>0)) {
    const flash=Math.max(...system.particles.map(p=>p.flash));
    pulse.visible=true;pulse.position.set(...system.lastEvent.position);
    pulse.scale.setScalar(.3+(.32-flash)*1.4);pulse.material.opacity=flash*.42;
  } else pulse.visible=false;
}
function resize() {
  if(!renderer) return;
  const width=Math.max(1,viewport.clientWidth),height=Math.max(1,viewport.clientHeight);
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  edges.material.uniforms.resolution.value.set(width,height);
}
function updateCamera() {
  if(!camera) return;
  const x=!gestureMode&&viewport.clientWidth>900?-1.15:0,y=gestureMode?-.6:0;
  camera.position.set(x+Math.sin(yaw)*Math.cos(pitch)*distance,y+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);
  camera.lookAt(x,y,0);
}
function attachPointer() {
  viewport.addEventListener('pointerdown',event=>{isDragging=true;dragX=event.clientX;dragY=event.clientY;viewport.setPointerCapture(event.pointerId);});
  viewport.addEventListener('pointermove',event=>{
    if(!isDragging) return;
    yaw-=(event.clientX-dragX)*.006;pitch=THREE.MathUtils.clamp(pitch+(event.clientY-dragY)*.005,-1.08,1.08);
    dragX=event.clientX;dragY=event.clientY;updateCamera();
  });
  for(const eventName of ['pointerup','pointercancel']) viewport.addEventListener(eventName,event=>{isDragging=false;if(viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);});
  viewport.addEventListener('wheel',event=>{if(!event.shiftKey) return;event.preventDefault();distance=THREE.MathUtils.clamp(distance+event.deltaY*.008,10.2,38);updateCamera();},{passive:false});
}
function setRunning(value) {
  running=value;$('#stateLabel').textContent=value?'LIVE':started?'PAUSED':'READY';
  $('#liveState').classList.toggle('running',value);$('#playButton').classList.toggle('active',value);
  $('#playButton').setAttribute('aria-pressed',String(value));$('#pauseButton').setAttribute('aria-pressed',String(!value&&started));
}
function start() {if(!renderer||!configured||mixtureDialog.open) return;started=true;curtain.classList.add('hidden');setRunning(true);}
function setShells(value) {showShells=value;shellMesh.visible=value;$('#velocityToggle').setAttribute('aria-checked',String(value));syncMeshes();}
function setTemperature(value) {
  system.setTemperature(Math.round(value));
  slider.value=system.targetTemperature;
  lastUI=-Infinity;lastChart=-Infinity;
  syncMeshes();updateUI();
}
function updateUI() {
  const counts=system.counts;
  updateMixtureLive(counts);
  $('#initialCountReadout').textContent=`INITIAL · ${system.initialCount.toLocaleString()} MOLECULES`;
  const currentCount=system.particles.length.toLocaleString(),currentUnit=system.atomic?'atoms':'molecules';
  if($('#currentParticleCount').textContent!==currentCount) $('#currentParticleCount').textContent=currentCount;
  if($('#currentParticleUnit').textContent!==currentUnit) $('#currentParticleUnit').textContent=currentUnit;
  for(const species of Object.keys(counts)) $(`#count${species}`).textContent=counts[species].toLocaleString();
  $('#atomicCounts').hidden=!system.atomic;
  $('#speciesTitle').textContent=system.atomic?'Atomic limit illustration':'Current molecular inventory';
  $('#phaseReadout').textContent=system.atomic?'ATOMIC LIMIT · TEACHING CONVENTION':'MOLECULAR MIXTURE';
  $('#temperatureReadout').textContent=`${Math.round(system.targetTemperature).toLocaleString()} K`;
  slider.style.setProperty('--temperature-progress',`${system.targetTemperature/10000*100}%`);
  $('#forwardCount').textContent=system.forward.toLocaleString();$('#reverseCount').textContent=system.reverse.toLocaleString();
  const rates=system.recentExchange();
  $('#effectiveForward').textContent=rates.forward;
  $('#effectiveReverse').textContent=rates.reverse;
  $('#effectiveTotal').textContent=rates.total;
  $('#exchangeState').textContent=system.atomic?'Molecular exchange paused':rates.elapsed<3?`Collecting ${rates.elapsed.toFixed(1)} / 3.0 s`:
    'Successful bond exchanges · active playback clock';
  const audit=system.compositionAudit();
  $('#stoichiometryReadout').textContent=system.atomic?'Atomic illustration · H and I inventory conserved':
    audit.valid?'1 H₂ + 1 I₂ ⇌ 2 HI · count audit passed':'Particle count mismatch — please reset';
  const mean=system.particles.reduce((sum,p)=>sum+kinetic(p),0)/system.particles.length;
  $('#meanEnergy').textContent=mean.toFixed(2);$('#kineticTemperature').textContent=`${Math.round(system.kineticTemperature).toLocaleString()} K`;
  const error=Math.abs(system.balanceError)/Math.max(1,Math.abs(system.initialEnergy)+Math.abs(system.externalWork))*100;
  $('#balanceError').textContent=`${error.toFixed(6)}%`;
  $('#externalWork').textContent=`${(system.externalWork*.001660539067).toFixed(2)} aJ`;
  const atoms=atomCounts(system.particles);$('#atomAudit').textContent=`H ${atoms.H} · I ${atoms.I}`;
  const last=system.lastCollision;
  if(system.atomic) {
    $('#collisionReadout').textContent='H + I · elastic collisions';
    $('#collisionDecision').textContent='Molecular reaction channels are paused in the atomic illustration.';
  } else if(last) {
    $('#collisionReadout').textContent=`Erel ${last.energy.toFixed(1)} / Ea ${last.ea} kJ mol⁻¹`;
    $('#collisionDecision').textContent=last.reacted?(last.kind==='forward'?'H₂ + I₂ → 2HI · 13 kJ mol⁻¹ released':'2HI → H₂ + I₂ · 13 kJ mol⁻¹ absorbed'):
      last.energy<last.ea?'Below activation barrier · elastic rebound':!last.orientation?'Above barrier · orientation unsuccessful':'Eligible contact · no bond exchange';
  } else {$('#collisionReadout').textContent='Waiting for contact';$('#collisionDecision').textContent='Energy and orientation are tested at contact.';}
  $('#modelNote').textContent=system.targetTemperature===0?'0 K · idealized stationary starting state, not a realizable gas. Raise temperature to add translational energy.':system.atomic?'10,000 K atomic-limit illustration · not a dissociation-equilibrium prediction. Lower T restores the saved molecular mixture.':
    'Collision teaching model · equilibrium composition unvalidated. High-temperature dissociation is omitted below 10,000 K.';
}
function drawChart(now) {
  if(gestureMode) return;
  if(now-lastChart>=130 || !chartFit) {
    chartFit=countAndFit(system.particles.map(kinetic),{energyLimit:500,binWidth:.5});lastChart=now;
    $('#sampleCount').textContent=`${chartFit.n.toLocaleString()} ${system.atomic?'atoms':'molecules'} counted`;
    $('#overflowCount').textContent=`E > 500: ${chartFit.overflow}`;
  }
  const w=chart.clientWidth,h=chart.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(chart.width!==Math.round(w*dpr)||chart.height!==Math.round(h*dpr)) {chart.width=Math.round(w*dpr);chart.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  if(system.targetTemperature===0) {
    ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#999';
    ctx.fillText('ALL MOLECULES AT E = 0',46,20);
    ctx.fillStyle='#666';ctx.fillText('0 K · stationary reference',46,39);
    ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(46,h-32);ctx.lineTo(w-16,h-32);ctx.stroke();
    ctx.fillStyle='#888';ctx.fillText('0',46,h-14);
    ctx.strokeStyle='#eee';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(46,h-32);ctx.lineTo(46,58);ctx.stroke();
    return;
  }
  const left=46,right=w-16,top=20,bottom=h-32,values=chartFit.values;
  const max=Math.max(.001,Math.max(...values)*1.25),x=i=>left+i/(values.length-1)*(right-left),y=v=>bottom-v/max*(bottom-top);
  ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#888';ctx.fillText('DENSITY',left,10);
  for(let i=0;i<=2;i++) {
    const density=max*i/2;ctx.strokeStyle=i?'rgba(255,255,255,.055)':'rgba(255,255,255,.2)';
    ctx.beginPath();ctx.moveTo(left,y(density));ctx.lineTo(right,y(density));ctx.stroke();
    ctx.fillText(density.toFixed(3),0,y(density)+3);
  }
  for(let e=0;e<=500;e+=100) ctx.fillText(String(e),left+e/500*(right-left),h-14);
  ctx.textAlign='right';ctx.fillText('KINETIC ENERGY / kJ mol⁻¹',right,h-1);ctx.textAlign='left';
  ctx.beginPath();values.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));
  ctx.strokeStyle='#ededed';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
  ctx.lineTo(right,bottom);ctx.lineTo(left,bottom);ctx.closePath();
  const fill=ctx.createLinearGradient(0,top,0,bottom);fill.addColorStop(0,'rgba(255,255,255,.12)');fill.addColorStop(1,'rgba(255,255,255,.01)');ctx.fillStyle=fill;ctx.fill();
}
function animate(now) {
  const elapsed=Math.min((now-lastFrame)/1000,.25),dt=Math.min(elapsed,.033);lastFrame=now;
  if(running&&!document.hidden) system.step(dt,elapsed);
  syncMeshes();renderer.render(scene,camera);
  diffuseView?.draw(now);
  if(now-lastUI>125) {updateUI();lastUI=now;}
  drawChart(now);gestureView?.draw(now);requestAnimationFrame(animate);
}
function toggleGesture(force) {
  if(!renderer||!configured||mixtureDialog.open) return;
  const next=typeof force==='boolean'?force:!gestureMode;
  if(next===gestureMode) return;
  if(next) {
    restore={started,running,showShells,yaw,pitch,distance,scroll:scrollY};
    gestureMode=true;document.documentElement.classList.add('gesture-mode');
    start();setShells(true);yaw=-.64;pitch=.3;distance=24.5;
    if(!gestureView) gestureView=createGestureView({
      getEnergies:()=>system.particles.map(kinetic),getTemperature:()=>system.targetTemperature,setTemperature,
      zoom(direction,dt){distance=THREE.MathUtils.clamp(distance+(direction==='in'?-1:1)*5*dt,10.2,38);updateCamera();},
      energyLimit:500,binWidth:.5,energyUnit:'kJ mol⁻¹',heatRate:600,minimumTemperature:0,autoDensityScale:true,
      brand:'Hydrogen–Iodine',getNote:()=>system.targetTemperature===0?'0 K: idealized stationary reference':system.atomic?'10,000 K: prescribed atomic illustration':
        `H₂ ${system.counts.H2} · I₂ ${system.counts.I2} · HI ${system.counts.HI} · Dissociation omitted`,
    });
    gestureView.start();
  } else {
    gestureView.stop();gestureMode=false;document.documentElement.classList.remove('gesture-mode');
    started=restore.started;setRunning(restore.running);curtain.classList.toggle('hidden',started);
    setShells(restore.showShells);({yaw,pitch,distance}=restore);scrollTo(0,restore.scroll);
  }
  isDragging=false;resize();updateCamera();lastChart=-Infinity;
}
$('#startButton').addEventListener('click',start);
$('#playButton').addEventListener('click',start);
$('#pauseButton').addEventListener('click',()=>setRunning(false));
slider.addEventListener('input',()=>setTemperature(Number(slider.value)));
$('#velocityToggle').addEventListener('click',()=>setShells(!showShells));
$('#diffuseToggle').addEventListener('click',()=>{
  diffuseMode=!diffuseMode;diffuseView?.setVisible(diffuseMode);
  $('#diffuseToggle').setAttribute('aria-pressed',String(diffuseMode));
  $('#diffuseToggle').classList.toggle('active',diffuseMode);
});
function reset(inventory=system.initialInventory) {
  const total=mixtureKeys.reduce((sum,key)=>sum+inventory[key],0);
  system.reset(total,system.targetTemperature,{inventory});createMeshes();
  started=false;setRunning(false);curtain.classList.remove('hidden');
  lastUI=-Infinity;lastChart=-Infinity;updateUI();
}
$('#resetButton').addEventListener('click',()=>reset());
function readMixture() {
  const inventory=Object.fromEntries(mixtureKeys.map(key=>[key,$(`#initial${key}`).valueAsNumber]));
  const valid=mixtureKeys.every(key=>Number.isInteger(inventory[key])&&inventory[key]>=0&&inventory[key]<=maximumMolecules);
  const total=mixtureKeys.reduce((sum,key)=>sum+(Number.isFinite(inventory[key])?inventory[key]:0),0);
  $('#mixtureTotal').textContent=Number.isSafeInteger(total)?total.toLocaleString():'—';
  for(const key of mixtureKeys) $(`#fraction${key}`).textContent=valid&&total>0?`${(inventory[key]/total*100).toFixed(1)}%`:'—';
  const ready=valid&&total>0&&total<=maximumMolecules;
  $('#confirmMixture').disabled=!ready;
  $('#mixtureFeedback').textContent=!valid?'Use whole numbers from 0 to 2,500.':total===0?'Add at least one molecule.':
    total>maximumMolecules?'Keep the total at or below 2,500 for browser performance.':`Ready. ${total.toLocaleString()} molecules in total.`;
  return {inventory,valid:ready};
}
function updateMixtureLive(counts=system.counts) {
  if(!configured||!mixtureDialog.open) return;
  const values={
    mixtureLiveH2:counts.H2,mixtureLiveI2:counts.I2,mixtureLiveHI:counts.HI,
    mixtureLiveH:counts.H,mixtureLiveI:counts.I,
    mixtureLiveTotal:system.particles.length,
    mixtureLiveUnit:system.atomic?'atoms':'molecules',
    mixtureLiveState:running?'LIVE':'PAUSED',
    mixtureLiveTemperature:`${Math.round(system.kineticTemperature).toLocaleString()} K`,
  };
  for(const [id,value] of Object.entries(values)) {
    const element=$(`#${id}`),text=typeof value==='number'?value.toLocaleString():value;
    if(element.textContent!==text) element.textContent=text;
  }
  $('#mixtureLiveAtoms').hidden=!system.atomic;
}
function openMixture() {
  if(mixtureDialog.open) return;
  mixtureWasRunning=running;
  for(const key of mixtureKeys) $(`#initial${key}`).value=system.initialInventory[key];
  $('#cancelMixture').hidden=!configured;
  $('#mixtureLive').hidden=!configured;
  $('#mixtureInputsLabel').hidden=!configured;
  mixtureDialog.classList.toggle('with-live-counts',configured);
  $('#mixtureDescription').textContent='Enter each species count. The total is calculated from your inputs. '+
    (configured?`Keep the current temperature: ${Math.round(system.targetTemperature).toLocaleString()} K.`:'Start at 0 K, then add energy.');
  $('#confirmMixture').textContent=configured?'APPLY & RESTART →':'ENTER LABORATORY →';
  readMixture();mixtureDialog.showModal();updateMixtureLive();
}
function closeMixture() {mixtureDialog.close();setRunning(mixtureWasRunning);}
$('#mixtureButton').addEventListener('click',openMixture);
$('#cancelMixture').addEventListener('click',closeMixture);
mixtureDialog.addEventListener('cancel',event=>{event.preventDefault();if(configured) closeMixture();});
$('#mixtureForm').addEventListener('input',readMixture);
$('#mixtureForm').addEventListener('submit',event=>{
  event.preventDefault();const {inventory,valid}=readMixture();if(!valid) return;
  $('#confirmMixture').disabled=true;
  reset(inventory);configured=true;mixtureDialog.close();start();
});
$('.viewport-wrap').addEventListener('dblclick',event=>{if(event.target.closest('button,a')) return;event.preventDefault();toggleGesture();});
addEventListener('keydown',event=>{if(event.key==='Escape') toggleGesture(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gestureMode) toggleGesture(false);});
addEventListener('pagehide',()=>gestureView?.stop());
init();
