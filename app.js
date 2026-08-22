const app=document.querySelector('#app'),camera=document.querySelector('#camera'),svg=document.querySelector('#hotspot-layer');
const tooltip=document.querySelector('#tooltip'),message=document.querySelector('#message'),back=document.querySelector('#back-button');
const scene=document.querySelector('#scene-card'),motionToggle=document.querySelector('#motion-toggle');
const mq=matchMedia('(prefers-reduced-motion: reduce)');
const copy={H01:{name:'蓝色城堡',title:'S01 山路与城堡外观'},H02:{name:'花园',title:'S02 后花园与温室'},H03:{name:'热气球',hint:'风吹动了气球的绳索，远方还没有显露清晰的道路。'},H04:{name:'小镇',hint:'山下亮着一些尚未熟悉的灯。'},H05:{name:'瀑布',hint:'瀑布从山顶落下，通向城堡的楼梯在水雾和松树间若隐若现。'}};
const fallback=[
 ['H01','S01','enter_scene','#4D9DE0','1067,507 1107,469 1114,428 1131,411 1131,342 1152,258 1173,348 1216,341 1248,261 1259,171 1285,229 1301,208 1333,245 1376,245 1392,133 1419,192 1438,112 1488,0 1520,19 1533,101 1552,59 1568,176 1611,235 1619,288 1636,294 1616,331 1653,357 1680,397 1685,459 1664,512 1643,560 1600,608 1536,645 1472,651 1440,619 1397,597 1365,587 1344,597 1291,587 1227,576 1163,555 1115,539 1083,523'],
 ['H02','S02','enter_scene','#62B36F','1621,245 1643,181 1685,165 1717,171 1749,80 1803,48 1867,50 1963,80 1984,160 1968,219 1931,245 1984,254 2011,288 2021,357 2000,432 1963,491 1920,533 1877,517 1824,544 1771,523 1739,491 1707,437 1675,405 1653,352 1637,288'],
 ['H03','S12','locked_scene','#F2C14E','653,287 694,297 736,330 746,375 739,431 710,479 697,506 694,544 764,559 791,595 777,620 725,633 654,621 594,593 588,560 629,537 628,501 594,464 569,421 561,374 573,327 614,293'],
 ['H04','town','locked_scene','#F28E2B','43,761 80,704 119,695 138,622 197,590 251,614 319,670 364,556 390,659 442,691 523,691 543,717 621,693 677,751 698,908 693,928 725,962 731,1011 683,1067 576,1152 0,1152 0,832'],
 ['H05','waterfall','show_observation','#2EC4B6','992,587 1030,592 1051,612 1067,693 1041,779 1036,875 1065,960 1031,1045 992,1099 976,1152 887,1152 891,1077 915,1013 935,960 938,875 928,811 942,736 931,672 955,608']
].map(([id,target,action,color,points])=>({id,target,action,color,pointsPx:points.split(' ').map(p=>p.split(',').map(Number))}));
let hotspots=[],active=null,activeBox=null,primed=null,returning=false,messageTimer,sceneTimer,cameraTimer,parallax={x:0,y:0};
const savedReduced=localStorage.getItem('blueCastle.reducedMotion.v3');
let reduced=savedReduced==='true';

async function init(){
  let source=fallback;
  if(location.protocol!=='file:'){try{const data=await fetch('assets/s00-hotspots.json').then(r=>{if(!r.ok)throw Error('热点数据加载失败');return r.json()});source=data.hotspots}catch(error){console.warn('使用内置热点坐标',error)}}
  hotspots=source.map(h=>({...h,...copy[h.id]}));renderHotspots();setReduced(reduced,false)
}
function renderHotspots(){
  const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs');
  defs.innerHTML='<filter id="white-edge-glow" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="4.8" result="softCore"/><feGaussianBlur in="SourceGraphic" stdDeviation="9.5" result="middle"/><feGaussianBlur in="SourceGraphic" stdDeviation="20" result="outer"/><feMerge><feMergeNode in="outer"/><feMergeNode in="middle"/><feMergeNode in="middle"/><feMergeNode in="softCore"/></feMerge></filter>';
  svg.append(defs);
  hotspots.forEach(h=>{const points=h.pointsPx.map(v=>v.join(',')).join(' '),p=document.createElementNS(ns,'polygon'),glow=document.createElementNS(ns,'polygon');p.setAttribute('points',points);p.setAttribute('class','hotspot');p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',h.name);p.dataset.id=h.id;glow.setAttribute('points',points);glow.setAttribute('class','hotspot-glow');glow.setAttribute('aria-hidden','true');p.addEventListener('pointerenter',e=>showTooltip(h,e));p.addEventListener('pointermove',e=>positionTooltip(e));p.addEventListener('pointerleave',()=>hideTooltip());p.addEventListener('focus',()=>showTooltip(h));p.addEventListener('blur',hideTooltip);p.addEventListener('click',e=>activate(h,p,e));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(h,p,e)}});svg.append(p,glow)})
}
function showTooltip(h,e){if(active||returning||svg.classList.contains('inactive'))return;tooltip.hidden=false;tooltip.textContent=h.name;tooltip.classList.add('visible');if(e)positionTooltip(e);else{const r=document.querySelector(`[data-id="${h.id}"]`).getBoundingClientRect();tooltip.style.left=`${r.left+r.width/2}px`;tooltip.style.top=`${Math.max(12,r.top-36)}px`}}
function positionTooltip(e){tooltip.style.left=`${e.clientX}px`;tooltip.style.top=`${Math.max(12,e.clientY-38)}px`}function hideTooltip(){tooltip.classList.remove('visible')}
function activate(h,el,e){
  if(active||returning)return;
  if(e.pointerType==='touch'&&primed!==h.id){document.querySelector('.hotspot.is-primed')?.classList.remove('is-primed');primed=h.id;el.classList.add('is-primed');showTooltip(h,e);return}
  primed=null;el.classList.remove('is-primed');localStorage.setItem(`blueCastle.visited.${h.id}`,'true');
  if(h.action==='enter_scene')enterScene(h);else showMessage(h.hint||'这里尚未开放。');
}
function updateZoom(){if(!activeBox)return;const cx=(activeBox.l+activeBox.r)/2,cy=(activeBox.t+activeBox.b)/2,scale=Math.min(2.35,Math.max(1.55,1500/Math.max(activeBox.r-activeBox.l,activeBox.b-activeBox.t)));camera.style.setProperty('--zoom-scale',scale);camera.style.setProperty('--zoom-x',`${(.5-cx/2048)*camera.clientWidth*scale}px`);camera.style.setProperty('--zoom-y',`${(.5-cy/1152)*camera.clientHeight*scale}px`)}
function lockHotspots(){primed=null;hideTooltip();tooltip.hidden=true;tooltip.textContent='';document.querySelectorAll('.hotspot').forEach(p=>{p.classList.remove('is-primed');p.setAttribute('tabindex','-1')});document.activeElement?.blur?.();svg.classList.add('inactive');svg.setAttribute('aria-hidden','true')}
function unlockHotspots(){svg.classList.remove('inactive');svg.removeAttribute('aria-hidden');tooltip.hidden=false;document.querySelectorAll('.hotspot').forEach(p=>p.setAttribute('tabindex','0'))}
function enterScene(h){active=h;returning=false;clearTimeout(sceneTimer);clearTimeout(cameraTimer);lockHotspots();message.hidden=true;camera.style.translate='0 0';activeBox=h.pointsPx.reduce((b,[x,y])=>({l:Math.min(b.l,x),r:Math.max(b.r,x),t:Math.min(b.t,y),b:Math.max(b.b,y)}),{l:2048,r:0,t:1152,b:0});updateZoom();requestAnimationFrame(()=>camera.classList.add('entered'));scene.querySelector('#scene-kicker').textContent=h.target;scene.querySelector('#scene-title').textContent=h.title;scene.hidden=false;scene.classList.remove('visible');sceneTimer=setTimeout(()=>scene.classList.add('visible'),reduced?180:900);back.hidden=false}
function returnOverview(){if(!active||returning)return;returning=true;clearTimeout(sceneTimer);camera.classList.remove('entered');scene.classList.remove('visible');scene.hidden=true;back.hidden=true;message.hidden=true;cameraTimer=setTimeout(()=>{active=null;activeBox=null;returning=false;unlockHotspots()},reduced?240:1600)}
function showMessage(text,duration=4800){clearTimeout(messageTimer);message.textContent=text;message.hidden=false;if(duration)messageTimer=setTimeout(()=>message.hidden=true,duration)}
function setReduced(value,persist=true){reduced=value;app.classList.toggle('reduced',value);motionToggle.setAttribute('aria-pressed',String(value));motionToggle.textContent=`减少动态：${value?'开':'关'}`;if(persist)localStorage.setItem('blueCastle.reducedMotion.v3',String(value))}
motionToggle.addEventListener('click',()=>setReduced(!reduced));back.addEventListener('click',returnOverview);addEventListener('keydown',e=>{if(e.key==='Escape')returnOverview()});
addEventListener('pointermove',e=>{if(reduced||active||e.pointerType==='touch')return;const x=(e.clientX/innerWidth-.5)*8,y=(e.clientY/innerHeight-.5)*8;parallax.x+=(x-parallax.x)*.22;parallax.y+=(y-parallax.y)*.22;camera.style.translate=`${parallax.x}px ${parallax.y}px`},{passive:true});
document.addEventListener('visibilitychange',()=>app.classList.toggle('paused',document.hidden));mq.addEventListener('change',e=>{if(savedReduced===null)setReduced(e.matches,false)});init();
addEventListener('resize',()=>{if(active)updateZoom()});
