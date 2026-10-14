// Qualitative, uniform I2 colour field. Not a calibrated absorption spectrum.
// Fixed box volume / exposure: colour depth follows actual N(I2)/V, not a
// fraction of all particles, temperature, or moving particle positions.
export function createDiffuseView({THREE,viewport,camera,getParticles}) {
  const canvas=document.createElement('canvas');
  canvas.className='composition-haze';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
  viewport.append(canvas);
  const ctx=canvas.getContext('2d'),point=new THREE.Vector3();
  const boxVolume=10*10*10,colourGain=2;
  let visible=false,last=-Infinity;
  function hull(points) {
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
    return half(points).slice(0,-1).concat(half(points.slice().reverse()).slice(0,-1));
  }
  return {
    setVisible(value) {visible=value;canvas.hidden=!value;last=-Infinity;},
    draw(now) {
      if(!visible||now-last<80) return;
      last=now;
      const w=viewport.clientWidth,h=viewport.clientHeight;
      if(!w||!h) return;
      if(canvas.width!==w||canvas.height!==h) {canvas.width=w;canvas.height=h;}
      let iodineCount=0;
      for(const p of getParticles()) if(p.species==='I2') iodineCount++;
      const concentration=iodineCount/boxVolume;
      const opacity=.72*(1-Math.exp(-colourGain*concentration));
      ctx.clearRect(0,0,w,h);
      if(iodineCount===0) return;
      const corners=[];
      for(const x of [-5,5]) for(const y of [-5,5]) for(const z of [-5,5]) {
        point.set(x,y,z).project(camera);corners.push([(point.x*.5+.5)*w,(.5-point.y*.5)*h]);
      }
      const outline=hull(corners);
      ctx.beginPath();
      outline.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
      ctx.fillStyle='rgba(164,116,212,'+opacity+')';ctx.fill();
    },
  };
}
