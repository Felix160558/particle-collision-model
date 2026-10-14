// Translational hard-sphere teaching model. Units: nm, m/s, g/mol, kJ/mol.
// Rounded bond energies are chosen consistently with ΔE = -13 kJ/mol.
// The 10,000 K atom-only limit is an explicit display convention, not a
// dissociation-equilibrium calculation or a universal physical threshold.
export const R=8.314462618;
export const LIMIT_T=10000;
export const SPECIES=Object.freeze({
  H2:{mass:2.01588,bond:436,length:.0741,radius:.14,atoms:['H','H'],color:0xececec},
  I2:{mass:253.80894,bond:151,length:.2666,radius:.24,atoms:['I','I'],color:0xa478d4},
  HI:{mass:127.91241,bond:300,length:.1609,radius:.22,atoms:['H','I'],color:0xececec},
  H:{mass:1.00794,bond:0,length:0,radius:.095,atoms:['H'],color:0xececec},
  I:{mass:126.90447,bond:0,length:0,radius:.17,atoms:['I'],color:0xa478d4},
});
export const EA_FORWARD=170, EA_REVERSE=183;
export const MOTION_SCALE=.0013; // 1 visual second = 1.3 ps; box width 10 nm.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>Math.hypot(...a);
const normalize=a=>{const n=norm(a)||1;return a.map(x=>x/n);};
// Integer spatial keys avoid thousands of string allocations per frame.
// Cells stay within [-11, 10] in this fixed 10 nm container; radix 64 leaves
// room for all adjacent cells without key aliasing.
const neighborOffsets=[];
for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++) neighborOffsets.push(dx+64*dy+4096*dz);
export const kinetic=p=>.5*SPECIES[p.species].mass*dot(p.v,p.v)/1e6;
export const potential=p=>-SPECIES[p.species].bond;
export function collisionEnergy(a,b) {
  const ma=SPECIES[a.species].mass,mb=SPECIES[b.species].mass;
  const relative=a.v.map((v,i)=>v-b.v[i]);
  return .5*(ma*mb/(ma+mb))*dot(relative,relative)/1e6;
}
export function atomCounts(particles) {
  const counts={H:0,I:0};
  for(const p of particles) for(const atom of SPECIES[p.species].atoms) counts[atom]++;
  return counts;
}
function gaussian(random) {
  return Math.sqrt(-2*Math.log(Math.max(random(),1e-15)))*Math.cos(2*Math.PI*random());
}
export class ReactionSystem {
  constructor({count=100,temperature=5000,random=Math.random}={}) {
    this.random=random;this.particles=[];this.events=[];
    this.reset(count,temperature);
  }
  get energy() {return this.particles.reduce((s,p)=>s+kinetic(p)+potential(p),0);}
  get kineticTemperature() {
    return this.particles.length?this.particles.reduce((s,p)=>s+kinetic(p),0)*2000/(3*this.particles.length*R):0;
  }
  get counts() {
    const out={H2:0,I2:0,HI:0,H:0,I:0};
    this.particles.forEach(p=>out[p.species]++);return out;
  }
  get balanceError() {return this.energy-this.initialEnergy-this.externalWork;}
  makeParticle(species,position) {
    const sigma=Math.sqrt(1000*R*this.targetTemperature/SPECIES[species].mass);
    return {species,p:position||[0,0,0],v:[0,0,0].map(()=>gaussian(this.random)*sigma),
      axis:normalize([0,0,0].map(()=>gaussian(this.random))),spin:(this.random()-.5)*.5,flash:0};
  }
  reset(count=this.initialCount,temperature=this.targetTemperature,{inventory=null}={}) {
    const initial=inventory||{H2:count/2,I2:count/2,HI:0};
    if(!Number.isInteger(count)||count<1||!['H2','I2','HI'].every(key=>Number.isInteger(initial[key])&&initial[key]>=0)||initial.H2+initial.I2+initial.HI!==count) {
      throw new RangeError('Initial molecule counts must be nonnegative integers adding up to the total.');
    }
    this.initialCount=count;this.targetTemperature=temperature;
    this.atomic=false;this.savedMixture=null;this.forward=0;this.reverse=0;
    this.collisions=0;this.eligible=0;this.physicalTime=0;this.observationTime=0;this.events=[];
    this.lastCollision=null;this.lastEvent=null;this.revision=0;
    this.initialInventory={...initial};
    this.particles=[];
    for(let i=0;i<count;i++) {
      const species=i<this.initialInventory.H2?'H2':i<this.initialInventory.H2+this.initialInventory.I2?'I2':'HI';
      let position;
      for(let attempt=0;attempt<200;attempt++) {
        const bound=5-SPECIES[species].radius;
        position=[0,0,0].map(()=>(this.random()*2-1)*bound);
        if(this.particles.every(p=>norm(p.p.map((x,k)=>x-position[k]))>SPECIES[p.species].radius+SPECIES[species].radius)) break;
      }
      this.particles.push(this.makeParticle(species,position));
    }
    this.thermalize(temperature);
    this.initialEnergy=this.energy;this.externalWork=0;
    if(temperature>=LIMIT_T) this.setTemperature(temperature);
  }
  thermalize(temperature) {
    if(temperature===0) {for(const p of this.particles) p.v=[0,0,0];return;}
    // A zero velocity cannot be heated by scaling. On leaving the stationary
    // reference state, sample thermal components before the usual rescaling.
    if(this.kineticTemperature<1e-15) for(const p of this.particles) {
      const sigma=Math.sqrt(1000*R*temperature/SPECIES[p.species].mass);
      p.v=[0,0,0].map(()=>gaussian(this.random)*sigma);
    }
    // Remove center-of-mass drift, then set total translational temperature.
    const mass=this.particles.reduce((s,p)=>s+SPECIES[p.species].mass,0);
    const com=[0,0,0];
    for(const p of this.particles) for(let k=0;k<3;k++) com[k]+=SPECIES[p.species].mass*p.v[k]/mass;
    if(this.particles.length>1) for(const p of this.particles) for(let k=0;k<3;k++) p.v[k]-=com[k];
    const factor=Math.sqrt(temperature/Math.max(this.kineticTemperature,1e-20));
    for(const p of this.particles) p.v=p.v.map(v=>v*factor);
  }
  setTemperature(value) {
    if(!Number.isFinite(value)) return;
    const t=Math.max(0,Math.min(LIMIT_T,value));
    const before=this.energy;
    this.targetTemperature=t;
    if(t>=LIMIT_T && !this.atomic) this.toAtoms();
    else if(t<LIMIT_T && this.atomic) this.restoreMolecules();
    this.thermalize(t);
    this.externalWork+=this.energy-before;
  }
  toAtoms() {
    this.savedMixture=this.particles.map(p=>({species:p.species,p:p.p.slice(),axis:p.axis.slice()}));
    const atoms=[];
    for(const p of this.particles) {
      const species=SPECIES[p.species],mass=species.mass;
      species.atoms.forEach((atom,i)=>{
        const other=SPECIES[species.atoms[1-i]].mass;
        const offset=(i===0?-1:1)*species.length*other/mass;
        const a=this.makeParticle(atom,p.p.map((x,k)=>x+offset*p.axis[k]));
        a.p=a.p.map(x=>Math.max(-4.8,Math.min(4.8,x)));atoms.push(a);
      });
    }
    this.particles=atoms;this.atomic=true;this.revision++;
    this.lastEvent={kind:'atomic',energy:null};
  }
  restoreMolecules() {
    // Presentation boundary: restore the saved molecular composition. This is
    // not claimed to simulate atom recombination; all work enters the ledger.
    const molecules=[];
    this.savedMixture.forEach(saved=>{
      const molecule=this.makeParticle(saved.species,saved.p.slice());
      molecule.axis=saved.axis.slice();
      molecules.push(molecule);
    });
    this.particles=molecules;this.atomic=false;this.revision++;
    this.lastEvent={kind:'molecular',energy:null};
  }
  collide(a,b) {
    const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],dz=b.p[2]-a.p[2];
    const r=SPECIES[a.species].radius+SPECIES[b.species].radius;
    const squaredDistance=dx*dx+dy*dy+dz*dz;
    if(squaredDistance>r*r||squaredDistance<1e-24) return false;
    const delta=b.p.map((x,k)=>x-a.p[k]);
    const distance=Math.sqrt(squaredDistance);
    const n=delta.map(x=>x/distance);
    const ma=SPECIES[a.species].mass,mb=SPECIES[b.species].mass,M=ma+mb;
    const approach=dot(a.v.map((v,k)=>v-b.v[k]),n);
    const overlap=Math.max(0,r-distance)+1e-7;
    for(let k=0;k<3;k++) {a.p[k]-=n[k]*overlap*mb/M;b.p[k]+=n[k]*overlap*ma/M;}
    if(approach<=0) return false;
    this.collisions++;
    let kind=null;
    if((a.species==='H2'&&b.species==='I2')||(a.species==='I2'&&b.species==='H2')) kind='forward';
    if(a.species==='HI'&&b.species==='HI') kind='reverse';
    const energy=collisionEnergy(a,b),ea=kind==='reverse'?EA_REVERSE:EA_FORWARD;
    const orientation=Math.abs(dot(a.axis,b.axis))>.45 && Math.abs(dot(a.axis,n))<.9 && Math.abs(dot(b.axis,n))<.9;
    if(kind) {
      this.lastCollision={kind,energy,ea,orientation,reacted:false};
      if(energy>=ea) this.eligible++;
    }
    if(kind&&energy>=ea&&orientation) {
      const products=kind==='forward'?['HI','HI']:['H2','I2'];
      const oldPotential=potential(a)+potential(b);
      const newPotential=-SPECIES[products[0]].bond-SPECIES[products[1]].bond;
      const outgoing=energy+oldPotential-newPotential;
      if(outgoing>=0) {
        const com=a.p.map((x,k)=>(ma*x+mb*b.p[k])/M);
        const comV=a.v.map((v,k)=>(ma*v+mb*b.v[k])/M);
        a.species=products[0];b.species=products[1];
        const pa=SPECIES[a.species],pb=SPECIES[b.species];
        const speed=Math.sqrt(2*outgoing*1e6/(pa.mass*pb.mass/M));
        const separation=pa.radius+pb.radius+1e-6;
        for(let k=0;k<3;k++) {
          a.v[k]=comV[k]-n[k]*speed*pb.mass/M;
          b.v[k]=comV[k]+n[k]*speed*pa.mass/M;
          a.p[k]=com[k]-n[k]*separation*pb.mass/M;
          b.p[k]=com[k]+n[k]*separation*pa.mass/M;
        }
        a.flash=b.flash=.32;
        this[kind]++;this.lastCollision.reacted=true;
        this.events.push({kind,time:this.observationTime});
        this.lastEvent={kind,energy,position:com};this.revision++;
        return true;
      }
    }
    const impulse=2*approach/(1/ma+1/mb);
    for(let k=0;k<3;k++) {a.v[k]-=impulse*n[k]/ma;b.v[k]+=impulse*n[k]/mb;}
    return false;
  }
  step(dt,observationDt=dt) {
    this.observationTime+=Math.max(0,observationDt);
    let maxSpeed=0;
    for(const p of this.particles) maxSpeed=Math.max(maxSpeed,Math.hypot(p.v[0],p.v[1],p.v[2]));
    const minRadius=this.atomic ? .095 : .14;
    const safeStep=minRadius*.45/(Math.max(maxSpeed,1)*MOTION_SCALE);
    const actualDt=Math.min(dt,safeStep*24);
    const steps=Math.max(1,Math.ceil(actualDt/safeStep));
    const h=actualDt/steps,cellSize=.5;
    for(let sub=0;sub<steps;sub++) {
      const grid=new Map();
      for(let i=0;i<this.particles.length;i++) {
        const p=this.particles[i],bound=5-SPECIES[p.species].radius;
        for(let k=0;k<3;k++) {
          p.p[k]+=p.v[k]*MOTION_SCALE*h;
          if(p.p[k]>bound) {p.p[k]=2*bound-p.p[k];p.v[k]=-Math.abs(p.v[k]);}
          else if(p.p[k]<-bound) {p.p[k]=-2*bound-p.p[k];p.v[k]=Math.abs(p.v[k]);}
        }
        const key=(Math.floor(p.p[0]/cellSize)+32)+64*(Math.floor(p.p[1]/cellSize)+32)+4096*(Math.floor(p.p[2]/cellSize)+32);
        if(!grid.has(key)) grid.set(key,[]);
        grid.get(key).push(i);
        p.cellKey=key;
      }
      for(let i=0;i<this.particles.length;i++) {
        const a=this.particles[i];
        for(const offset of neighborOffsets) {
          const bucket=grid.get(a.cellKey+offset);
          if(bucket) for(const j of bucket) if(j>i) this.collide(a,this.particles[j]);
        }
        // Orientation rotates for visualization / steric gating only; internal
        // rotational and vibrational energies are outside this model.
        const angle=this.targetTemperature===0?0:a.spin*h,c=Math.cos(angle),s=Math.sin(angle),ax=a.axis[0];
        a.axis[0]=c*ax-s*a.axis[2];a.axis[2]=s*ax+c*a.axis[2];
        a.flash=Math.max(0,a.flash-h);
      }
    }
    this.physicalTime+=actualDt*MOTION_SCALE*1e-9;
    // Window history is bounded by time, not an arbitrary event count.
    this.events=this.events.filter(event=>event.time>this.observationTime-3);
  }
  recentExchange() {
    const recent=this.events.filter(event=>event.time>this.observationTime-3&&event.time<=this.observationTime);
    const forward=recent.filter(event=>event.kind==='forward').length;
    const reverse=recent.length-forward;
    return {forward,reverse,total:recent.length,elapsed:Math.min(3,this.observationTime),
      changes:{H2:reverse-forward,I2:reverse-forward,HI:2*(forward-reverse)}};
  }
  compositionAudit() {
    if(this.atomic) return {valid:true,expected:null};
    const net=this.forward-this.reverse;
    const expected={H2:this.initialInventory.H2-net,I2:this.initialInventory.I2-net,HI:this.initialInventory.HI+2*net};
    const counts=this.counts;
    return {valid:Object.keys(expected).every(key=>counts[key]===expected[key]),expected};
  }
}
