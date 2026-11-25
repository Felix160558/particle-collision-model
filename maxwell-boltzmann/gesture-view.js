import { createGestureCamera } from './gesture-camera.js';
import { countAndFit, ENERGY_LIMIT } from './gesture-science.js?v=20261014';

export function createGestureView({ getEnergies, getTemperature, setTemperature, zoom,
  energyLimit=ENERGY_LIMIT,binWidth=.125,energyUnit='a.u.',heatRate=36,
  minimumTemperature=100,autoDensityScale=false,getNote=()=>'',brand='Maxwell–Boltzmann' }) {
  const layer = document.createElement('section');
  layer.className = 'gesture-view';
  layer.hidden = true;
  layer.setAttribute('aria-label','Live gesture laboratory');
  layer.innerHTML = `
    <div class="gesture-brand">${brand}</div>
    <div class="gesture-return">Double-click model or Esc to return</div>
    <aside class="gesture-data">
      <div class="gesture-summary">
        <h2>Energy distribution</h2>
        <div class="gesture-thermal">
          <div class="gesture-temperature-label">TEMPERATURE</div>
          <div class="gesture-temperature"><span data-temperature>300</span> <small>K</small></div>
        </div>
      </div>
      <canvas data-curve role="img" aria-label="Live fitted energy distribution from counted particles"></canvas>
      <div class="gesture-caption"><span data-count>100 particles counted</span><span data-tail></span></div>
      <p class="gesture-model-note" data-model-note hidden></p>
    </aside>
    <footer class="gesture-footer">
      <div class="gesture-feedback">
        <span class="gesture-response" data-response role="status">Allow camera to use gestures</span>
        <button class="gesture-retry" data-retry hidden>Retry camera</button>
      </div>
      <div class="gesture-legend"><span>Open palm <b>Heat</b></span><span>Fist <b>Cool</b></span><span>OK <b>Closer</b></span><span>V <b>Further</b></span></div>
    </footer>
    <video playsinline muted aria-hidden="true"></video>`;
  document.body.append(layer);
  const video = layer.querySelector('video');
  const canvas = layer.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const response = layer.querySelector('[data-response]');
  const temperatureLabel = layer.querySelector('[data-temperature]');
  const countLabel = layer.querySelector('[data-count]');
  const tailLabel = layer.querySelector('[data-tail]');
  const retry = layer.querySelector('[data-retry]');
  const note=layer.querySelector('[data-model-note]');
  let active = false, lastCount = -Infinity, lastDraw = 0, heatBudget = 0;
  let target, displayed, fixedY = 2;
  const messages = {
    'REQUESTING CAMERA':'Allow camera to use gestures',
    'LOADING HAND TRACKING':'Preparing hand tracking…',
    'SHOW ONE HAND':'Show one hand to the camera',
    'HOLD A GESTURE':'Hold your gesture briefly',
    HEATING:'Adding energy', COOLING:'Removing energy',
    'ZOOMING IN':'Moving closer', 'ZOOMING OUT':'Moving further',
    'CAMERA ACCESS DENIED':'Camera access is blocked',
    'NO CAMERA FOUND':'No camera connected', 'CAMERA IS BUSY':'Camera is in use',
    'OPEN THE HTTPS WEBSITE TO USE CAMERA':'Open the HTTPS site to use gestures',
    'HAND TRACKING UNAVAILABLE — RETRY':'Hand tracking unavailable',
  };
  const tracking = createGestureCamera({ video,
    onStatus(message,error=false) {
      const text=messages[message]||message;
      if(response.textContent!==text) response.textContent=text;
      retry.hidden=!error;
    },
    onGesture(gesture,dt) {
      if (!active) return;
      if (gesture==='palm' || gesture==='fist') {
        heatBudget+=(gesture==='palm'?1:-1)*heatRate*dt;
        const change=Math.trunc(heatBudget);
        heatBudget-=change;
        if(change) setTemperature(getTemperature()+change);
      } else {
        heatBudget=0;
        if (gesture==='ok' || gesture==='v') zoom(gesture==='ok'?'in':'out',dt);
      }
    },
  });
  retry.addEventListener('click',()=>tracking.start());

  function draw(now) {
    if (!active) return;
    const dt = Math.min((now-lastDraw)/1000,.1); lastDraw=now;
    // Recount the current system. Frames are never added as independent samples.
    if (now-lastCount>=100) {
      const result=countAndFit(getEnergies(),{energyLimit,binWidth});
      target=result.values;
      if (!displayed) displayed=Float64Array.from(target);
      countLabel.textContent=`${result.n.toLocaleString()} particles · smoothed counts`;
      tailLabel.textContent=result.overflow?`${result.overflow} above ${energyLimit}`:'';
      temperatureLabel.textContent=Math.round(getTemperature()).toLocaleString('en-US');
      note.textContent=[getNote(),autoDensityScale?'Density scale auto':''].filter(Boolean).join(' · ');
      note.hidden=!note.textContent;
      if(autoDensityScale) fixedY=Math.max(.001,Math.max(...target)*1.25);
      lastCount=now;
    }
    if (!displayed) return;
    // Brief interpolation between successive measured fits keeps motion fluid.
    const blend=1-Math.exp(-dt/.085);
    for(let i=0;i<displayed.length;i++) displayed[i]+=(target[i]-displayed[i])*blend;
    const width=canvas.clientWidth, height=canvas.clientHeight;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)) {
      canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    }
    ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,width,height);
    const left=24,right=width-12,top=18,bottom=height-36;
    const px=i=>left+i/(displayed.length-1)*(right-left);
    const py=v=>bottom-v/fixedY*(bottom-top);
    ctx.font='10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle='#9a9a9a'; ctx.textAlign='left'; ctx.fillText('Probability density',left,10);
    ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.moveTo(left,bottom); ctx.lineTo(right,bottom); ctx.stroke();
    ctx.fillStyle='#9a9a9a';
    for(let value=0;value<=energyLimit;value+=energyLimit/4) {
      const x=left+value/energyLimit*(right-left);
      ctx.textAlign='center'; ctx.fillText(String(value),x,bottom+17);
      ctx.beginPath(); ctx.moveTo(x,bottom); ctx.lineTo(x,bottom+3); ctx.stroke();
    }
    ctx.textAlign='right'; ctx.fillStyle='#999'; ctx.fillText(`Kinetic energy / ${energyUnit}`,right,height-2);
    ctx.textAlign='left';
    if(getTemperature()===0) {
      ctx.fillStyle='#aaa';ctx.fillText('All particles at E = 0',left,top+15);
      ctx.strokeStyle='#eee';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(left,top+30);ctx.stroke();
      return;
    }
    // Only the baseline and a discreet upper tick, including in auto-scale mode.
    ctx.fillStyle='#9a9a9a'; ctx.fillText(fixedY<.1?fixedY.toFixed(3):fixedY.toFixed(1),0,top+4);
    ctx.save(); ctx.beginPath(); ctx.rect(left,top,right-left,bottom-top); ctx.clip();
    ctx.beginPath(); displayed.forEach((v,i)=>i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)));
    ctx.lineWidth=2; ctx.lineJoin='round'; ctx.strokeStyle='#f2f2f2'; ctx.stroke(); ctx.restore();
  }
  return {
    start() {
      active=true; layer.hidden=false; lastCount=-Infinity; displayed=null;
      lastDraw=performance.now();
      // Choose one scale from this system at the coldest permitted temperature;
      // retain it for this whole visit so peak-height changes remain meaningful.
      const temperature=getTemperature(),coldScale=temperature>0?minimumTemperature/temperature:0;
      const cold=countAndFit(getEnergies().map(e=>e*coldScale),{energyLimit,binWidth});
      fixedY=Math.max(.5,Math.ceil(Math.max(...cold.values)*1.12*2)/2);
      tracking.start();
    },
    stop() { active=false; layer.hidden=true; heatBudget=0; tracking.stop(); },
    draw,
  };
}
