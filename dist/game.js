import { MODELS, MODEL_MAP, CEOS, COPY, localized } from './data.js';
import { GardenGame, FIELD } from './engine.js';
import { GardenRenderer, loadArtwork } from './renderer.js';

const icons={
 leaf:'<path d="M5 14C5 7 11 4 21 4c0 10-4 16-11 16-3 0-5-3-5-6Z"/><path d="m6 19 10-10"/>',
 grid:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
 play:'<path d="m9 5 11 7-11 7V5Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',
 shovel:'<path d="m15 4 5 5M17.5 6.5l-8 8M7 12l5 5-5 4-4-1 1-4 3-4Z"/>',
 restart:'<path d="M4 11a8 8 0 1 1 2 6M4 5v6h6"/>',
 sound:'<path d="m11 5-5 4H3v6h3l5 4V5ZM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>',
 mute:'<path d="m11 5-5 4H3v6h3l5 4V5ZM16 9l5 6M21 9l-5 6"/>',
 star:'<path d="m12 3 2.7 5.9 6.3.8-4.7 4.5 1.1 6.3-5.4-3.1-5.4 3.1 1.1-6.3L3 9.7l6.3-.8L12 3Z"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
 coin:'<circle cx="12" cy="12" r="9"/><path d="M8 8h8M12 8v9"/>',
 bolt:'<path d="m13 3-8 11h7l-1 7 8-11h-7l1-7Z"/>',
 bulb:'<path d="M9 18h6M10 21h4M8 15c-5-4-2-12 4-12s9 8 4 12l-1 3H9l-1-3Z"/>',
 cross:'<path d="m6 6 12 12M18 6 6 18"/>',
 shield:'<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 book:'<path d="M12 6C9 3 4 4 3 5v14c4-2 7-1 9 1 2-2 5-3 9-1V5c-4-2-7-1-9 1Zm0 0v14"/>',
 flower:'<path d="M12 11c-8-9 8-9 0 0 9-8 9 8 0 0 8 9-8 9 0 0-9 8-9-8 0 0Z"/><path d="M12 14v8m0-4 5-2"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 heart:'<path d="M12 20 4 12C-2 5 8 0 12 7c4-7 14-2 8 5l-8 8Z"/>'
};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.leaf}</svg>`;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stored(key,fallback){try{return JSON.parse(localStorage.getItem('garden-'+key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem('garden-'+key,JSON.stringify(value));}catch{}}
let lang=stored('lang','zh');if(!COPY[lang])lang='zh';
let difficulty=stored('difficulty','normal');if(!['easy','normal','hard'].includes(difficulty))difficulty='normal';
let eggs=stored('eggs',true),sound=stored('sound',false),speed=1,selected='deepseek',view='garden',dexTab='models';
let game=new GardenGame({lang,difficulty,eggs}),art=null,renderer=null,ready=false,modalPaused=false,tipIndex=0,lastTip=0,lastFrame=0,hudTimer=0,best=stored('best',0),lastPhase='ready';
const app=document.getElementById('app'),modal=document.getElementById('modal');
const t=()=>COPY[lang];
let audio=null,lastShotSound=0;
function playSound(kind){
 if(!sound)return;
 try{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const when=audio.currentTime;if(kind==='shoot'&&when-lastShotSound<.13)return;if(kind==='shoot')lastShotSound=when;
  const notes={plant:[440,554],collect:[880,1108],shoot:[330],wave:[330,440,554],kill:[196],win:[523,659,784,1046],lose:[294,247,196],mower:[130,196,262],click:[660],strike:[330,294]};
  const freqs=notes[kind]||notes.click;
  freqs.forEach((freq,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type=kind==='shoot'?'sine':'triangle';osc.frequency.setValueAtTime(freq,when+i*.09);gain.gain.setValueAtTime(0,when+i*.09);gain.gain.linearRampToValueAtTime(kind==='shoot'?.012:.035,when+i*.09+.01);gain.gain.exponentialRampToValueAtTime(.001,when+i*.09+.2);osc.connect(gain);gain.connect(audio.destination);osc.start(when+i*.09);osc.stop(when+i*.09+.22);});
 }catch{}
}
function toast(message,warning=false,extra=''){
 const stack=document.getElementById('toast-stack'),item=document.createElement('div');item.className='toast'+(warning?' warning':'');item.innerHTML=escapeHtml(message)+(extra?`<small>${escapeHtml(extra)}</small>`:'');stack.append(item);
 while(stack.children.length>3)stack.firstElementChild.remove();
 setTimeout(()=>{item.classList.add('out');setTimeout(()=>item.remove(),300);},warning?5400:2900);
}
function nav(){return `<header class="topbar"><button class="brand" data-view="garden" aria-label="${t().title}"><span class="brand-mark">${icon('leaf',27)}</span><span><span class="brand-name">LLM <span>vs.</span> CAPITAL</span><span class="brand-caption">A LITTLE GARDEN. A BIG DEFENSE.</span></span></button><nav class="navigation" aria-label="${t().title}"><button class="nav-link ${view==='garden'?'active':''}" data-view="garden">${t().navGame}</button><button class="nav-link ${view==='dex'?'active':''}" data-view="dex">${t().navDex}</button><button class="nav-link" data-view="help">${t().navHelp}</button></nav><div class="top-actions"><button class="icon-btn sound-toggle" title="${sound?t().soundOn:t().soundOff}" aria-label="${sound?t().soundOn:t().soundOff}" aria-pressed="${sound}">${icon(sound?'sound':'mute',15)}</button><div class="lang-switch" aria-label="Language">${[['zh','简中'],['en','EN'],['ja','日本語']].map(([key,label])=>`<button data-lang="${key}" lang="${{zh:'zh-CN',en:'en',ja:'ja'}[key]}" class="${lang===key?'active':''}" aria-pressed="${lang===key}">${label}</button>`).join('')}</div></div></header>`;}
function footer(){return `<footer class="page-footer"><div class="footer-left">${icon('flower',13)}<span>${t().footer}</span><span class="footer-dot"></span><span>2026</span></div><div class="footer-right"><span class="fan-pill">${t().fanwork}</span><button class="text-btn credits-open">${t().credits} ↗</button></div></footer>`;}
function modelCards(){return MODELS.map((m,i)=>`<button class="model-card ${m.id===selected?'selected':''}" data-model="${m.id}" title="${m.name} · ${localized(m.skill,lang)} · ${m.cost} Token" aria-label="${m.name}, ${m.cost} Token, ${localized(m.role,lang)}" aria-pressed="${m.id===selected}"><span class="hotkey">${i+1}</span><span class="model-thumb" style="background-image:url('assets/portraits/${m.id}.png')"></span><span class="card-name">${m.name}</span><span class="card-cost"><i class="tiny-coin"></i>${m.cost}</span><span class="card-cooldown" hidden></span></button>`).join('');}
function detail(){
 if(selected==='shovel')return `<div class="detail-label">${t().skillLabel}<span>S</span></div><div class="detail-skill">${icon('shovel',14)}${t().shovel}</div><p class="detail-desc">${t().shovelHint}</p>`;
 const m=MODEL_MAP[selected]||MODELS[0];return `<div class="detail-label">${t().skillLabel}<span>${localized(m.role,lang)}</span></div><div class="detail-skill"><span style="color:${m.color}">${icon(m.id==='deepseek'?'coin':m.id==='qwen'?'shield':m.id==='kimi'?'heart':m.id==='claude'?'book':'star',14)}</span>${localized(m.skill,lang)}</div><p class="detail-desc">${localized(m.desc,lang)}</p>`;
}
function gameMarkup(){return `<section class="page-intro"><div><div class="eyebrow">${t().eyebrow}</div><h1>${t().headline}</h1><p class="intro-sub">${t().subtitle}</p></div><div class="edition"><div class="edition-top">${t().introBadge}</div><div class="edition-bottom">let it grow.</div></div></section><div class="game-layout"><aside class="roster-panel"><div class="panel-title"><h2>${t().roster}</h2><span class="count">01 — 09</span></div><p class="panel-sub">${t().rosterSub}</p><div class="roster-grid">${modelCards()}</div><div class="selected-detail" id="selected-detail">${detail()}</div></aside><section class="battle-column" aria-label="${t().level}"><div class="battle-hud"><div class="level-meta"><span class="level-icon">${icon('leaf',23)}</span><div><div class="level-name">${t().level}</div><div class="level-en">${t().levelSub}</div></div></div><div class="hud-right"><div class="wave-box"><div><div class="wave-meta">${t().wave} <span id="wave-number">0 / 6</span></div><div class="wave-dots">${Array.from({length:6},(_,i)=>`<span class="wave-dot" data-wave="${i+1}"></span>`).join('')}</div></div></div><div class="token-box"><span class="token-emblem">${icon('coin',20)}</span><div><div class="token-count" id="token-count">${game.tokens}</div><div class="token-label">${t().tokens}</div></div></div><button class="primary-btn main-start" id="main-start">${icon('play',15)}<span>${t().start}</span></button></div></div><div class="battle-stage"><div class="canvas-wrap"><canvas id="garden" tabindex="0" role="application" aria-label="${t().level}. ${t().rosterSub}. ${t().keyboard}"></canvas><div class="stage-top-label">${icon('shield',12)} <span>${t().home}</span></div><div class="stage-status"><span class="status-dot"></span><span id="stage-status">${t().ready}</span></div><div class="stage-selection">${icon('leaf',12)}<span id="stage-selection">${t().gardenHint}</span></div><div class="stage-atmosphere">GROW YOUR MODELS, NOT THEIR REVENUE.</div><div class="stage-overlay" id="stage-overlay" hidden></div><div class="loading-splash ${ready?'done':''}" id="loading-splash"><span class="loading-dot"></span>${t().loading}</div></div></div><div class="battle-controls"><div class="tool-group"><button class="tool-btn ${selected==='shovel'?'active':''}" id="shovel" title="${t().shovelHint}" aria-label="${t().shovel}" aria-pressed="${selected==='shovel'}">${icon('shovel',14)}<span>${t().shovel}</span></button><button class="tool-btn" id="speed" title="${t().speed}" aria-label="${t().speed}">${icon('bolt',13)}<span class="speed-label">${speed}×</span></button><button class="tool-btn sound-toggle" title="${sound?t().soundOn:t().soundOff}" aria-label="${sound?t().soundOn:t().soundOff}" aria-pressed="${sound}">${icon(sound?'sound':'mute',14)}</button><button class="tool-btn" id="restart" title="${t().restart}" aria-label="${t().restart}">${icon('restart',14)}</button><button class="tool-btn" id="help" title="${t().navHelp}" aria-label="${t().navHelp}">${icon('book',14)}</button></div><div class="tool-group"><button class="next-button" id="next-wave" hidden>${t().nextWave} +25T</button><select class="difficulty-select" id="difficulty" aria-label="${t().difficulty}" title="${t().difficulty}">${['easy','normal','hard'].map(k=>`<option value="${k}" ${difficulty===k?'selected':''}>${t()[k]}</option>`).join('')}</select><label class="egg-control" title="${t().eggsHint}"><input class="toggle-input" id="eggs" type="checkbox" ${eggs?'checked':''}><span>${t().eggs}</span></label></div></div><div class="field-note">${icon('bulb',16)}<span class="note-title">${t().tip}</span><p class="note-text" id="note-text">${t().tips[tipIndex]}</p></div></section></div>`;}
function dexMarkup(){
 const list=dexTab==='models'?MODELS:CEOS;
 const subtitle=localized({zh:'九种技能，九种脾气。找到属于你的守园阵容。',en:'Nine abilities. Nine personalities. Find your garden crew.',ja:'9つのスキル、9つの個性。自分だけの防衛チームを。'},lang);
 const portrait=m=>dexTab==='models'?`<div class="dex-art" role="img" aria-label="${m.name}" style="background-image:url('assets/portraits/${m.id}.png')"></div>`:`<div class="ceo-art" role="img" aria-label="${m.name}"><span class="atlas-sprite" style="background-position:${m.index%3*50}% ${Math.floor(m.index/3)*100}%"></span></div>`;
 return `<section class="dex-intro"><div class="eyebrow">${t().fanwork}</div><h1>${dexTab==='models'?t().allNine:t().ceoTitle}</h1><p>${dexTab==='models'?subtitle:t().fiction}</p></section>
 <div class="dex-tabs"><button class="dex-tab ${dexTab==='models'?'active':''}" data-dex="models">${t().models} <small>09</small></button><button class="dex-tab ${dexTab==='enemies'?'active':''}" data-dex="enemies">${t().enemies} <small>06</small></button></div>
 <section class="dex-grid">${list.map(m=>dexTab==='models'?`<article class="dex-card">${portrait(m)}<div class="dex-info"><span class="dex-role">${localized(m.role,lang)}</span><h2>${m.name}</h2><p class="dex-skill">${localized(m.skill,lang)}</p><p class="dex-desc">${localized(m.desc,lang)}</p><div class="dex-stats"><span>${t().cost}<b>${m.cost} T</b></span><span>${t().hp}<b>${m.hp}</b></span><span>${t().cd}<b>${m.cooldown}${t().sec}</b></span></div><div class="dex-quote">“${localized(m.quote,lang)}”</div></div></article>`:`<article class="dex-card">${portrait(m)}<div class="dex-info"><span class="dex-role">${localized(m.title,lang)}</span><h2>${m.name}</h2><p class="dex-desc">${localized(m.desc,lang)}</p><div class="dex-stats"><span>${t().hp}<b>${m.hp}</b></span><span>${t().power}<b>${m.damage}</b></span></div></div></article>`).join('')}</section>`;
}
function render(){
 document.documentElement.lang={zh:'zh-CN',en:'en',ja:'ja'}[lang];document.title=`${t().title} · LLM vs. Capital`;
 app.innerHTML=`<div class="shell">${nav()}<main>${view==='garden'?gameMarkup():dexMarkup()}</main>${footer()}</div>`;
 renderer=null;
 if(view==='garden'&&art){renderer=new GardenRenderer(document.getElementById('garden'),art);renderer.selection=selected;bindCanvas();}
 bindUI();updateHUD(true);
}
function bindUI(){
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
  const target=b.dataset.view;if(target==='help'){showHelp();return;}
  if(target===view)return;
  if(target==='dex')game.pause();
  view=target;render();playSound('click');
 }));
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{
  lang=b.dataset.lang;save('lang',lang);game.setLanguage(lang);render();processEvents();
 }));
 document.querySelectorAll('.sound-toggle').forEach(b=>b.addEventListener('click',()=>{sound=!sound;save('sound',sound);playSound('click');updateSound();}));
 document.querySelectorAll('.credits-open').forEach(b=>b.addEventListener('click',showCredits));
 document.querySelectorAll('[data-model]').forEach(b=>b.addEventListener('click',()=>selectModel(b.dataset.model)));
 document.querySelectorAll('[data-dex]').forEach(b=>b.addEventListener('click',()=>{dexTab=b.dataset.dex;render();}));
 document.getElementById('main-start')?.addEventListener('click',mainAction);
 document.getElementById('shovel')?.addEventListener('click',()=>selectModel(selected==='shovel'?null:'shovel'));
 document.getElementById('speed')?.addEventListener('click',()=>{speed=speed===3?1:speed+1;document.querySelector('#speed .speed-label').textContent=`${speed}×`;playSound('click');});
 document.getElementById('restart')?.addEventListener('click',requestRestart);
 document.getElementById('help')?.addEventListener('click',showHelp);
 document.getElementById('eggs')?.addEventListener('change',e=>{eggs=e.target.checked;save('eggs',eggs);game.setEggs(eggs);toast(eggs?t().eggOn:t().eggToast);processEvents();});
 document.getElementById('difficulty')?.addEventListener('change',e=>{difficulty=e.target.value;save('difficulty',difficulty);resetGame();});
 document.getElementById('next-wave')?.addEventListener('click',()=>{game.nextWave();processEvents();updateHUD(true);});
}
function bindCanvas(){
 const canvas=renderer.canvas;
 const coords=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*1120,y:(e.clientY-r.top)/r.height*650};};
 const cell=({x,y})=>{const col=Math.floor((x-100)/100),row=Math.floor((y-104)/96);return col>=0&&col<9&&row>=0&&row<5?{row,col}:null;};
 canvas.addEventListener('pointermove',e=>{renderer.hover=cell(coords(e));canvas.style.cursor=renderer.hover?'crosshair':'default';});
 canvas.addEventListener('pointerleave',()=>{renderer.hover=null;});
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const p=coords(e),coin=game.coins.find(c=>Math.hypot(c.x-p.x,c.y-p.y)<27);
  if(coin){game.collect(coin.id);processEvents();updateHUD(true);return;}
  const tile=cell(p);if(!tile)return;
  if(!selected){toast(t().empty);return;}
  const result=selected==='shovel'?game.remove(tile.row,tile.col):game.plant(selected,tile.row,tile.col);
  if(!result.ok){toast(t()[result.reason],true);playSound('strike');}
  else if(selected==='shovel')toast(t().removed);
  processEvents();updateHUD(true);
 });
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();selectModel(null);});
}
function selectModel(id){
 selected=id;playSound('click');if(renderer)renderer.selection=id;
 document.querySelectorAll('[data-model]').forEach(b=>{b.classList.toggle('selected',b.dataset.model===id);b.setAttribute('aria-pressed',String(b.dataset.model===id));});
 const shovel=document.getElementById('shovel');if(shovel){shovel.classList.toggle('active',id==='shovel');shovel.setAttribute('aria-pressed',String(id==='shovel'));}
 const d=document.getElementById('selected-detail');if(d)d.innerHTML=detail();
 const s=document.getElementById('stage-selection');if(s)s.textContent=id==='shovel'?t().shovelHint:id?`${MODEL_MAP[id].name} · ${t().deployHint}`:t().neutral;
}
function mainAction(){
 if(!ready)return;
 if(game.phase==='ready')game.start();else if(game.phase==='playing')game.pause();else if(game.phase==='paused')game.resume();else resetGame();
 playSound('click');processEvents();updateHUD(true);
}
function resetGame(){game=new GardenGame({lang,difficulty,eggs});lastPhase='ready';selected='deepseek';speed=1;render();}
function requestRestart(){
 if(game.phase==='ready'||['won','lost'].includes(game.phase)){resetGame();return;}
 openModal(`<div class="modal-top"><h2 id="modal-title">${t().restart}</h2><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',16)}</button></div><p class="modal-body">${t().confirmRestart}</p><div class="modal-actions"><button class="secondary-btn modal-close">${t().cancelBtn}</button><button class="primary-btn" id="confirm-reset">${t().confirm}</button></div>`);
 document.getElementById('confirm-reset').addEventListener('click',()=>{modalPaused=false;modal.close();resetGame();});
}
function openModal(html){
 if(!modal.open){modalPaused=game.pause();modal.innerHTML=html;modal.showModal();}
 else modal.innerHTML=html;
 modal.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click',()=>modal.close()));updateHUD(true);
}
modal.addEventListener('close',()=>{if(modalPaused){game.resume();modalPaused=false;}updateHUD(true);});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
function showHelp(){
 const starter=localized({zh:'开局赠送 DeepSeek、ChatGPT、Qwen 各一位。',en:'Start with a free DeepSeek, ChatGPT, and Qwen.',ja:'開始時にDeepSeek、ChatGPT、Qwenを1人ずつ配置済み。'},lang);
 openModal(`<div class="modal-top"><h2 id="modal-title">${t().howTitle}</h2><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',16)}</button></div><p class="modal-intro">${t().howIntro}</p><div class="how-steps">${t().howSteps.map(([title,desc],i)=>`<div class="how-step"><span class="step-number">${i+1}</span><div><h3>${title}</h3><p>${desc}</p></div></div>`).join('')}</div><div class="keyboard-box">${starter}<br>${t().keyboard}</div><p class="fiction">${t().fiction}</p>`);
}
function showCredits(){openModal(`<div class="modal-top"><h2 id="modal-title">${t().creditsTitle}</h2><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',16)}</button></div><p class="modal-body">${t().creditsText}</p><p class="modal-body">${t().creditsLicense}</p><div class="modal-links"><a href="https://github.com/Apprentice-Geo/AI-Fanworks/tree/main/ApprenTice/AI-Girls-and-Chibis" target="_blank" rel="noopener noreferrer">${t().creditsLink} ↗</a><a href="https://www.bilibili.com/video/BV1tE9XBbErS/" target="_blank" rel="noopener noreferrer">ZipZipPipe ↗</a><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">${t().licenseLink} ↗</a></div><p class="fiction">${t().fiction}</p><div class="credits-tag">BUILT WITH A LITTLE CODE, A LOT OF TOKENS & COMMUNITY LOVE.</div>`);}
function updateSound(){document.querySelectorAll('.sound-toggle').forEach(b=>{b.innerHTML=icon(sound?'sound':'mute',15);b.title=sound?t().soundOn:t().soundOff;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(sound));});}
function formatTime(seconds){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function updateHUD(force=false){
 if(view!=='garden')return;
 const count=document.getElementById('token-count');if(count)count.textContent=game.tokens;
 const wave=document.getElementById('wave-number');if(wave)wave.textContent=`${game.wave} / 6`;
 document.querySelectorAll('[data-wave]').forEach(d=>{const i=Number(d.dataset.wave);d.classList.toggle('done',i<game.wave||game.phase==='won');d.classList.toggle('current',i===game.wave&&game.phase!=='won');});
 document.querySelectorAll('[data-model]').forEach(b=>{const m=MODEL_MAP[b.dataset.model],cd=game.cooldowns[m.id]||0;b.classList.toggle('unaffordable',game.tokens<m.cost);const cover=b.querySelector('.card-cooldown');cover.hidden=cd<=0;if(cd>0)cover.textContent=`${cd.toFixed(1)}`;});
 const start=document.getElementById('main-start');if(start){const p=game.phase,key=p==='ready'?'start':p==='playing'?'pause':p==='paused'?'resume':'playAgain';const html=`${icon(p==='playing'?'pause':'play',15)}<span>${t()[key]}</span>`;if(start.innerHTML!==html)start.innerHTML=html;start.classList.toggle('started',p==='playing'||p==='paused');start.disabled=!ready;}
 const status=document.getElementById('stage-status');if(status)status.textContent=game.phase==='ready'?t().ready:game.phase==='playing'?(game.nextWaveTimer!==null?`${t().nextIn} ${Math.ceil(game.nextWaveTimer)}s`:`${t().playing} · ${game.wave}/6 · ${formatTime(game.time)}`):game.phase==='paused'?t().paused:game.phase==='won'?t().win:t().lose;
 const diff=document.getElementById('difficulty');if(diff)diff.disabled=game.phase!=='ready';
 const next=document.getElementById('next-wave');if(next)next.hidden=!(game.phase==='playing'&&game.nextWaveTimer!==null&&game.wave>0);
 if(force||lastPhase!==game.phase){
  const overlay=document.getElementById('stage-overlay');if(!overlay)return;const p=game.phase;
  overlay.hidden=!['paused','won','lost'].includes(p)||modal.open;
  if(!overlay.hidden){
   const result=p!=='paused';overlay.innerHTML=`<div><div class="overlay-mark">${icon(p==='won'?'flower':p==='lost'?'restart':'pause',30)}</div><h2 class="overlay-title">${t()[p==='won'?'win':p==='lost'?'lose':'paused']}</h2><p class="overlay-desc">${t()[p==='won'?'winSub':p==='lost'?'loseSub':'pausedSub']}</p>${result?`<div class="overlay-stats"><div class="overlay-stat"><strong>${game.kills}</strong>${t().kills}</div><div class="overlay-stat"><strong>${formatTime(game.time)}</strong>${t().elapsed}</div><div class="overlay-stat"><strong>${best}</strong>${t().best}</div></div>`:''}<div class="result-actions"><button class="primary-btn overlay-action">${icon('play',14)}${result?t().playAgain:t().resume}</button></div></div>`;
   overlay.querySelector('.overlay-action').addEventListener('click',()=>{if(result)resetGame();else{game.resume();updateHUD(true);}});
  }
  lastPhase=p;
 }
}
function processEvents(){
 for(const e of game.drainEvents()){
  if(['plant','collect','shoot','wave','kill','mower','win','lose'].includes(e.type))playSound(e.type);
  if(e.type==='strike'){toast(t().strike,true,t().strikeHint);playSound('strike');}
  if(e.type==='resumeClaude')toast(t().backToWork);
  if(e.type==='mower')toast(t().mower);
  if(e.type==='wave'&&e.wave>1)toast(`${t().waveStart} ${e.wave}/6`);
  if(e.type==='stolen')toast(t().stolen,true);
  if(e.type==='win'||e.type==='lose'){best=Math.max(best,game.kills);save('best',best);updateHUD(true);}
 }
}
document.addEventListener('keydown',e=>{
 if(modal.open||view!=='garden'||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.repeat)return;
 if(/^[1-9]$/.test(e.key)){selectModel(MODELS[Number(e.key)-1].id);e.preventDefault();}
 else if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();mainAction();}
 else if(e.key.toLowerCase()==='s'){selectModel(selected==='shovel'?null:'shovel');e.preventDefault();}
 else if(e.key==='Escape')selectModel(null);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.pause())updateHUD(true);});
function loop(now){
 const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
 // Fixed-size substeps preserve projectile and one-second mechanics at 3x speed.
 if(ready){let left=dt*speed;while(left>0){const step=Math.min(left,1/60);game.update(step);left-=step;}processEvents();}
 if(renderer)renderer.draw(game,now);
 hudTimer+=dt;if(hudTimer>.1){hudTimer=0;updateHUD();}
 if(now-lastTip>18000){lastTip=now;tipIndex=(tipIndex+1)%t().tips.length;const note=document.getElementById('note-text');if(note)note.textContent=t().tips[tipIndex];}
 requestAnimationFrame(loop);
}
render();requestAnimationFrame(loop);
loadArtwork().then(loaded=>{
 art=loaded;ready=true;render();
 if(!art.models||!art.ceos||art.missingAnimations.length)toast(localized({zh:'部分动作图集加载失败，请刷新页面重试。',en:'Some animation sheets failed to load. Please refresh.',ja:'一部のモーションを読み込めませんでした。再読み込みしてください。'},lang),true);
});
