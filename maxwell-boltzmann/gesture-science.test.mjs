// Optional verification: node --test gesture-science.test.mjs. No build required.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=await readFile(new URL('./gesture-science.js',import.meta.url),'utf8');
const {countAndFit,createGestureGate}=vm.runInNewContext(source.replace(/export /g,'')+';({countAndFit,createGestureGate})');
test('each real molecule is counted once, including above-axis energies',()=>{
  const energies=[0,.12,.125,1,1.12,20,20.2,35];
  const result=countAndFit(energies);
  assert.equal(result.n,energies.length);
  assert.equal([...result.counts.values()].reduce((a,b)=>a+b,0),energies.length);
  assert.equal(result.counts.get(0),2);
  assert.equal(result.counts.get(1),1);
  assert.equal(result.overflow,2);
  assert.equal(countAndFit(energies).n,result.n);
});
test('the fitted distribution stays nonnegative, smooth, and approximately normalized',()=>{
  const energies=Array.from({length:1000},(_,i)=>.1+(i%140)/20);
  const {values}=countAndFit(energies);
  assert.equal(values[0],0);
  assert.ok([...values].every(v=>Number.isFinite(v)&&v>=0));
  const area=[...values].reduce((a,b)=>a+b,0)*20/(values.length-1);
  assert.ok(Math.abs(area-1)<.005,`area ${area}`);
  let maxSecondDifference=0;
  for(let i=1;i<values.length-1;i++) maxSecondDifference=Math.max(maxSecondDifference,Math.abs(values[i+1]-2*values[i]+values[i-1]));
  assert.ok(maxSecondDifference<.01);
});
test('heating preserves the count and broadens the empirical fit',()=>{
  const energies=Array.from({length:1000},(_,i)=>.1+(i%140)/20);
  const cold=countAndFit(energies),hot=countAndFit(energies.map(e=>e*2));
  assert.equal(cold.n,hot.n);
  assert.ok(Math.abs(hot.mean-cold.mean*2)<1e-10);
  assert.ok(Math.max(...hot.values)<Math.max(...cold.values)*.6);
});
test('hand loss immediately stops a held gesture',()=>{
  const gate=createGestureGate();
  assert.equal(gate.update('palm',0),'none');
  assert.equal(gate.update('palm',350),'palm');
  assert.equal(gate.update('none',351),'none');
  assert.equal(gate.update('fist',352),'none');
});

test('reaction edition can count a physical-energy axis without changing the default',()=>{
  const custom=countAndFit([40,150,200],{energyLimit:500,binWidth:.5});
  assert.equal(custom.n,3);assert.equal(custom.overflow,0);
  assert.equal(custom.counts.get(80),1);
  assert.equal(countAndFit([40,150,200]).overflow,3);
});
