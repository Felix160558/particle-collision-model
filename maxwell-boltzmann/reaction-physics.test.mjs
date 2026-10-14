// node --test reaction-physics.test.mjs — optional checks, no build step.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ReactionSystem,SPECIES,kinetic,potential,atomCounts,collisionEnergy} from './reaction-physics.js';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const energy=pair=>pair.reduce((sum,p)=>sum+kinetic(p)+potential(p),0);
const momentum=pair=>[0,1,2].map(k=>pair.reduce((sum,p)=>sum+SPECIES[p.species].mass*p.v[k],0));
function seed(value=1) {return ()=>{value=(1664525*value+1013904223)>>>0;return value/4294967296;};}
function pairAt(species,relativeEnergy,bulk=[0,0,0]) {
  const ma=SPECIES[species[0]].mass,mb=SPECIES[species[1]].mass,M=ma+mb;
  const u=Math.sqrt(2*relativeEnergy*1e6/(ma*mb/M));
  return species.map((sp,i)=>({species:sp,p:[i===0?-.1:.1,0,0],v:bulk.map((v,k)=>v+(k===0?(i===0?mb:-ma)*u/M:0)),axis:[0,1,0],flash:0}));
}
test('forward and reverse exchanges conserve atoms, mass, momentum, and total energy',()=>{
  for(const [species,e,products] of [[['H2','I2'],180,['HI','HI']],[['HI','HI'],190,['H2','I2']]]) {
    const system=new ReactionSystem({random:seed()});
    const pair=pairAt(species,e,[125,-70,31]),before=energy(pair),p=momentum(pair),atoms=atomCounts(pair);
    const mass=pair.reduce((s,a)=>s+SPECIES[a.species].mass,0);
    assert.equal(system.collide(...pair),true);
    assert.deepEqual(pair.map(a=>a.species),products);
    assert.deepEqual(atomCounts(pair),atoms);
    close(pair.reduce((s,a)=>s+SPECIES[a.species].mass,0),mass);
    close(energy(pair),before);momentum(pair).forEach((v,k)=>close(v,p[k],1e-6));
  }
});
test('the reaction test is frame-independent and rejects insufficient relative energy',()=>{
  const system=new ReactionSystem({random:seed()});
  const slow=pairAt(['H2','I2'],10),bulk=pairAt(['H2','I2'],10,[1e6,2e6,-1e6]);
  close(collisionEnergy(...slow),collisionEnergy(...bulk),1e-9);
  assert.equal(system.collide(...bulk),false);
  assert.deepEqual(bulk.map(p=>p.species),['H2','I2']);
});
test('an energetically eligible collision can fail its orientation test',()=>{
  const system=new ReactionSystem({random:seed()});
  const pair=pairAt(['H2','I2'],180);pair.forEach(p=>p.axis=[1,0,0]);
  const before=energy(pair);
  assert.equal(system.collide(...pair),false);close(energy(pair),before);
});
test('atom-limit illustration and return preserve inventory and account for thermostat work',()=>{
  const system=new ReactionSystem({count:100,temperature:5000,random:seed()});
  const atoms=atomCounts(system.particles),composition=system.counts;
  system.setTemperature(10000);
  assert.equal(system.atomic,true);assert.equal(system.particles.length,200);
  assert.ok(system.particles.every(p=>p.species==='H'||p.species==='I'));
  assert.deepEqual(atomCounts(system.particles),atoms);
  close(system.kineticTemperature,10000,1e-8);close(system.balanceError,0,1e-8);
  system.setTemperature(5000);
  assert.equal(system.atomic,false);assert.deepEqual(system.counts,composition);
  assert.deepEqual(atomCounts(system.particles),atoms);close(system.balanceError,0,1e-8);
});
test('many collisions and wall reflections remain bounded and conserve total energy',()=>{
  const system=new ReactionSystem({count:100,temperature:5000,random:seed(7)});
  const atoms=atomCounts(system.particles);
  for(let i=0;i<900;i++) system.step(1/60);
  assert.deepEqual(atomCounts(system.particles),atoms);
  assert.ok(Math.abs(system.balanceError)/Math.abs(system.initialEnergy)<1e-10);
  assert.ok(system.collisions>0);
  assert.ok(system.particles.every(p=>p.p.every(v=>Number.isFinite(v)&&Math.abs(v)<5)));
  for(const species of ['H2','I2','HI']) assert.ok(Number.isInteger(system.counts[species]));
});

test('2500 molecules keep stoichiometric counts, bounds, atoms and energy',()=>{
  const system=new ReactionSystem({count:2500,temperature:9000,random:seed(41)});
  assert.deepEqual(system.counts,{H2:1250,I2:1250,HI:0,H:0,I:0});
  const atoms=atomCounts(system.particles);
  for(let i=0;i<90;i++) system.step(1/60);
  assert.equal(system.particles.length,2500);
  assert.deepEqual(atomCounts(system.particles),atoms);
  assert.equal(system.compositionAudit().valid,true);
  assert.ok(Math.abs(system.balanceError)/Math.abs(system.initialEnergy)<1e-10);
  assert.ok(system.particles.every(p=>p.p.every(v=>Number.isFinite(v)&&Math.abs(v)<5)));
  assert.ok(system.forward>0);
  system.setTemperature(10000);assert.equal(system.particles.length,5000);
  assert.deepEqual(atomCounts(system.particles),atoms);
  system.setTemperature(5000);assert.equal(system.compositionAudit().valid,true);
});
test('three-second effective collision window excludes failed contacts and old events',()=>{
  const system=new ReactionSystem({random:seed()});
  system.observationTime=10;
  system.events=[{kind:'forward',time:7},{kind:'forward',time:7.01},{kind:'reverse',time:9.9},{kind:'forward',time:10}];
  const window=system.recentExchange();
  assert.equal(window.forward,2);assert.equal(window.reverse,1);assert.equal(window.total,3);
  assert.deepEqual(window.changes,{H2:-1,I2:-1,HI:2});
  const pair=pairAt(['H2','I2'],10);
  const before=system.events.length;system.collide(...pair);assert.equal(system.events.length,before);
  system.observationTime=13.01;assert.equal(system.recentExchange().total,0);
});

test('custom initial mixtures conserve their own H/I inventories and reject invalid totals',()=>{
  const system=new ReactionSystem({random:seed(19)});
  for(const inventory of [{H2:30,I2:10,HI:60},{H2:0,I2:0,HI:100},{H2:100,I2:0,HI:0}]) {
    system.reset(100,9000,{inventory});
    assert.deepEqual(system.initialInventory,inventory);
    const atoms={H:2*inventory.H2+inventory.HI,I:2*inventory.I2+inventory.HI};
    assert.deepEqual(atomCounts(system.particles),atoms);
    for(let i=0;i<60;i++) system.step(1/60);
    assert.equal(system.compositionAudit().valid,true);
    assert.deepEqual(atomCounts(system.particles),atoms);
    system.setTemperature(10000);assert.deepEqual(atomCounts(system.particles),atoms);
    system.setTemperature(5000);assert.equal(system.compositionAudit().valid,true);
  }
  const before=system.counts;
  for(const inventory of [{H2:20,I2:20,HI:0},{H2:-1,I2:1,HI:100},{H2:1.5,I2:1.5,HI:97}]) {
    assert.throws(()=>system.reset(100,5000,{inventory}),RangeError);
    assert.deepEqual(system.counts,before);
  }
});

test('zero-kelvin reference is stationary and can be heated without losing the energy ledger',()=>{
  const system=new ReactionSystem({temperature:0,random:seed(23)});
  const positions=system.particles.map(p=>p.p.slice()),axes=system.particles.map(p=>p.axis.slice());
  system.step(1/60);assert.equal(system.kineticTemperature,0);
  assert.deepEqual(system.particles.map(p=>p.p),positions);
  assert.deepEqual(system.particles.map(p=>p.axis),axes);
  for(const temperature of [300,0,9000,0]) {
    system.setTemperature(temperature);close(system.kineticTemperature,temperature,1e-8);
    close(system.balanceError,0,1e-8);
    assert.ok(system.particles.every(p=>p.v.every(Number.isFinite)));
  }
});
