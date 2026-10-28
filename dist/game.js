import {bindModelDrag,boardPoint,boardCell} from './drag-deploy.js';
import {bindInputLock} from './input-lock.js';
import { MODELS, LINEUP, CARD_HOTKEYS, MODEL_MAP, CEOS, CEO_MAP, ENEMY_COPY, COPY, NOTICES, localized } from './data.js';
import {enemyGuide} from './field-guide.js';
import {starsOf,rankText,skillDescription,harnessDescription,HARNESSES,harnessOptions,stackDescription,harnessCost} from './ranks.js';
import { GardenGame, FIELD } from './engine.js';
import { GardenRenderer, loadArtwork } from './renderer.js';
import {ELON_SKILLS} from './elon-data.js';
import {APP_VERSION} from './version.js';

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
 heart:'<path d="M12 20 4 12C-2 5 8 0 12 7c4-7 14-2 8 5l-8 8Z"/>',
 sliders:'<path d="M4 7h8M17 7h3M4 12h3M12 12h8M4 17h9M18 17h2"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="15.5" cy="17" r="2.2"/>'
};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.leaf}</svg>`;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stored(key,fallback){try{return JSON.parse(localStorage.getItem('garden-'+key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem('garden-'+key,JSON.stringify(value));}catch{}}
let lang=stored('lang','zh');if(!COPY[lang])lang='zh';
let sound=stored('sound',false),selected='deepseek',dexTab='models',modalKind='',dexFocus=null;
let presidentMode=stored('presidentMode',false)===true;
let game=new GardenGame({lang,presidentMode}),art=null,renderer=null,ready=false,modalPaused=false,lastFrame=0,hudTimer=0,best=stored('best',0),lastPhase='ready';
let bestScore=Math.max(0,Number(stored('best-score',0))||0);
const app=document.getElementById('app'),modal=document.getElementById('modal');
const t=()=>COPY[lang];
const superText=()=>({zh:{monopoly:'垄断 · 操作封锁',battle:'战斗继续，等待封锁结束',sp:'夺取 SP · 五只 QQ 企鹅已出动',mark:'入股分红 · 标记 {n} 位 LLM，5 秒后结算',paid:'入股分红 · 每个敌人回复 {n} HP',stolen:'QQ 企鹅偷走了 {model}'},en:{monopoly:'MONOPOLY · INPUT LOCKED',battle:'Battle continues until controls return',sp:'SP Heist · Five QQ penguins deployed',mark:'Dividend · {n} LLMs marked for 5s',paid:'Dividend · Each enemy heals {n} HP',stolen:'QQ penguin stole {model}'},ja:{monopoly:'独占 · 操作封鎖',battle:'戦闘続行中・解除まで待機',sp:'SP強奪 · QQペンギン5体出撃',mark:'配当 · LLM {n}体を5秒間マーク',paid:'配当 · 各敵のHPを{n}回復',stolen:'QQペンギンが{model}を強奪'}}[lang]);
const trumpText=()=>({zh:{strike:'军事打击 · {n} 处轰炸预警',deploy:'军事部署 · {n} 位军用 Claude 已部署',execute:'斩杀线 · {model} 被斩杀',retreat:'战略撤离 · 无敌 15 秒后撤离',withdraw:'Donald John Trump 已撤离战场'},en:{strike:'Military Strike · {n} tiles targeted',deploy:'Military Deployment · {n} Military Claudes deployed',execute:'Execution · {model} eliminated',retreat:'Strategic Retreat · Invulnerable for 15s',withdraw:'Donald John Trump has withdrawn'},ja:{strike:'軍事攻撃 · {n}マスに爆撃予告',deploy:'軍事配備 · 軍用Claude {n}体配備',execute:'処刑ライン · {model}を処刑',retreat:'戦略撤退 · 15秒間無敵',withdraw:'Donald John Trumpは撤退しました'}}[lang]);
bindInputLock(window,()=>game.controlsLocked);
let audio=null,lastShotSound=0,dragGhost=null,dragCancels=[];
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
function modelCards(){return LINEUP.map((m,i)=>`<button class="model-card ${m.id===selected?'selected':''}" data-model="${m.id}" aria-label="${m.name}, ${localized(m.skill,lang)}, ${m.cost} Token, ${localized(m.role,lang)}" title="${m.name} · ${localized(m.skill,lang)}" aria-pressed="${m.id===selected}"><span class="hotkey">${CARD_HOTKEYS[i]}</span><span class="card-rank">★</span><span class="model-thumb" style="background-image:url('assets/portraits/${m.id}.webp')"></span><span class="card-name">${m.name}</span><span class="card-cost"><i class="tiny-coin"></i>${m.cost}</span><span class="card-cooldown" hidden></span></button>`).join('');}
function gameMarkup(){
 return `<div class="game-page">
 <header class="game-header"><div class="garden-brand"><span class="brand-mark">${icon('leaf',24)}</span><div><strong>Oh My LLMs</strong><small>LLM vs. CAPITAL</small></div></div><div class="selection-note" id="selection-note"></div><div class="header-actions"><button class="score-pill" id="score-open" aria-label="${t().score}"><span>${t().score} <strong id="score-count">${game.score}</strong></span><small>${t().bestScore} <b id="best-score-count">${bestScore}</b></small></button><span class="phase-pill" id="phase-pill"></span><button class="icon-btn" id="pause-game" aria-label="${t().pause}" title="${t().pause}">${icon('pause',18)}</button><button class="icon-btn settings-open" title="${t().settings}" aria-label="${t().settings}">${icon('sliders',18)}</button></div></header>
 <div class="battle-stage"><div class="canvas-wrap" id="canvas-wrap"><canvas id="garden" tabindex="0" role="application" aria-label="${t().level}. ${t().rosterSub}. ${t().keyboard}"></canvas><button class="stage-start" id="stage-start" aria-label="${t().start}" ${game.phase==='ready'?'':'hidden'}><span class="stage-start-arrow">${icon('play',20)}</span></button><div class="stage-overlay" id="stage-overlay" hidden></div><div class="loading-splash ${ready?'done':''}" id="loading-splash"><span class="loading-dot"></span></div></div></div>
 <footer class="bank-row">
  <div class="token-tile" aria-label="${t().tokens}"><span class="token-label">TOKEN BANK</span><div class="token-balance"><span class="token-emblem">${icon('coin',24)}</span><span class="token-count" id="token-count">${game.presidentMode?'∞':game.tokens}</span></div><span class="bank-hint">${t().tokens}</span></div>
  <div class="roster-grid" style="--roster-count:${LINEUP.length}">${modelCards()}</div>
  <div class="deck-tools"><button class="icon-btn shovel-slot ${selected==='shovel'?'active':''}" id="shovel" title="${rankText(lang).refund}" aria-label="${t().shovel}" aria-pressed="${selected==='shovel'}">${icon('shovel',21)}<kbd>S</kbd></button><button class="icon-btn" id="deck-dex" title="${t().navDex}" aria-label="${t().navDex}">${icon('book',19)}</button></div>
 </footer>
</div><div id="monopoly-banner" class="monopoly-banner" role="status" aria-live="polite" hidden><span class="monopoly-seal">${icon('shield',26)}</span><strong>${superText().monopoly}</strong><b id="monopoly-countdown">20.0s</b><small>${superText().battle}</small></div>`;
}
function dexMarkup(){
 const list=dexTab==='models'?MODELS:CEOS;
 const portrait=m=>dexTab==='models'?`<div class="dex-art" role="img" aria-label="${m.name}" style="background-image:url('assets/portraits/${m.id}.webp')"></div>`:`<div class="ceo-art ${m.boss?'boss-art':''}" role="img" aria-label="${m.name}">${m.portrait?`<img class="enemy-portrait" src="${m.portrait}" alt="">`:`<span class="atlas-sprite" style="background-position:${m.index%3*50}% ${Math.floor(m.index/3)*100}%"></span>`}${m.boss?`<span class="enemy-insignia" style="--enemy-color:${m.color}">♛ BOSS</span>`:''}</div>`;
 const focus=m=>dexTab==='models'&&m.id===dexFocus;
 const labels=lang==='zh'?['价格','HP','基础HP','攻击伤害']:lang==='ja'?['価格','HP','基本HP','攻撃ダメージ']:['Price','HP','Base HP','Attack damage'];
 const stats=m=>dexTab==='models'?`<dl class="dex-stats"><div><dt>${labels[0]}</dt><dd>${m.cost} Token</dd></div><div><dt>${labels[1]}</dt><dd class="dex-hp-ranks">${[1,2,3].map(stars=>`<span>★${stars} ${Math.round(m.hp*[0,1,1.8,3][stars])}</span>`).join('')}</dd></div></dl>`:`<dl class="dex-stats"><div><dt>${labels[2]}</dt><dd>${m.hp}</dd></div><div><dt>${labels[3]}</dt><dd>${m.damage}</dd></div><div><dt>${t().points}</dt><dd>${m.points}</dd></div></dl>`;
 const skillParagraph=(name,description)=>`<p class="dex-skill"><strong class="dex-skill-title">${escapeHtml(name)}${lang==='en'?':':'：'}</strong> ${escapeHtml(description)}</p>`;
 const enemyBody=m=>{const guide=enemyGuide(m,lang);return `${guide.intro?`<p>${escapeHtml(guide.intro)}</p>`:''}${guide.skills.map(s=>skillParagraph(s.name,s.description)).join('')}${guide.notes?`<p>${escapeHtml(guide.notes)}</p>`:''}`;};
 const harnessBlock=m=>`<p class="dex-harness">${harnessOptions(m).map(option=>`<strong>${escapeHtml(option.name)}</strong> · ${harnessCost(m)} Token<br>${escapeHtml(harnessDescription(m.id,3,lang,option.variant))}`).join('<br><br>')}</p>`;
 const card=m=>`<article class="dex-card ${dexTab==='enemies'&&m.boss?'boss-card':''}"${focus(m)?' id="dex-focus"':''}>${dexTab==='models'?`<div class="dex-poster-column">${portrait(m)}${stats(m)}</div>`:portrait(m)}<div class="dex-info"><h2>${escapeHtml(m.name)}</h2>${dexTab==='enemies'?stats(m):''}<div class="dex-desc" tabindex="0" role="region" aria-label="${escapeHtml(m.name)}">${dexTab==='models'?[1,2,3].map(stars=>stars===1?skillParagraph(localized(m.skill,lang),skillDescription(m,stars,lang)):`<p>${escapeHtml(skillDescription(m,stars,lang))}</p>`).join('')+harnessBlock(m):enemyBody(m)}</div></div></article>`;
 return `<div class="dex-view"><header class="dex-header"><div class="dex-intro"><h2 id="modal-title">${t().navDex}</h2><button class="icon-btn modal-close" title="${t().close}" aria-label="${t().close}">${icon('cross',16)}</button></div>
 <div class="dex-tabs"><button class="dex-tab ${dexTab==='models'?'active':''}" data-dex="models">${t().models} <small>${String(MODELS.length).padStart(2,'0')}</small></button><button class="dex-tab ${dexTab==='enemies'?'active':''}" data-dex="enemies">${t().enemies} <small>${String(CEOS.length).padStart(2,'0')}</small></button></div>
 </header><section class="dex-grid">${list.map(card).join('')}</section></div>`;
}
function showDex(){
 if(game.controlsLocked)return;
 playSound('click');modalKind='dex';
 dexFocus=selected&&selected!=='shovel'?selected:null;
 if(dexFocus)dexTab='models';
 renderDexModal();
 modal.querySelector('#dex-focus')?.scrollIntoView({block:'nearest'});
}
function renderDexModal(){
 openModal(dexMarkup());
 modal.querySelectorAll('[data-dex]').forEach(b=>b.addEventListener('click',()=>{dexTab=b.dataset.dex;renderDexModal();}));
}
function render(){
 cancelModelDrag();
 document.documentElement.lang={zh:'zh-CN',en:'en',ja:'ja'}[lang];document.title=`${t().title} · LLM vs. Capital`;
 app.innerHTML=`<div class="shell"><main>${gameMarkup()}</main></div>`;
 renderer=null;
  if(art){renderer=new GardenRenderer(document.getElementById('garden'),art);renderer.selection=selected;bindCanvas();fitStage();}
  bindUI();updateHUD(true);
}
function bindUI(){
 document.querySelectorAll('.settings-open').forEach(b=>b.addEventListener('click',showSettings));
 document.querySelectorAll('[data-model]').forEach(b=>{b.addEventListener('click',()=>selectModel(b.dataset.model));bindCardDrag(b);});
 document.getElementById('stage-start')?.addEventListener('click',mainAction);
 document.getElementById('pause-game')?.addEventListener('click',mainAction);
 document.getElementById('deck-dex')?.addEventListener('click',showDex);
 document.getElementById('score-open')?.addEventListener('click',showScore);
 document.getElementById('shovel')?.addEventListener('click',()=>selectModel(selected==='shovel'?null:'shovel'));
}
// Show the scenic region from y=45 to y=625. CSS keeps the complete canvas at
// its original 1120×650 ratio, so pointer mapping still uses its full bounds.
function fitStage(){
 const stage=document.querySelector('.battle-stage'),wrap=document.getElementById('canvas-wrap');
 if(!stage||!wrap)return;
 // clientHeight and clientWidth are both in unscaled layout pixels.
 // Pointer mapping separately uses the rendered canvas bounds after CSS zoom.
 const availableHeight=stage.clientHeight,ratio=1120/580;
 const page=stage.parentElement,style=getComputedStyle(page);
 let width=page.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2,height=width/ratio;
 if(height>availableHeight){height=availableHeight;width=height*ratio;}
 stage.style.width=`${Math.floor(width)+2}px`;
 wrap.style.width=`${Math.max(1,Math.floor(width))}px`;
 wrap.style.height=`${Math.max(1,Math.floor(height))}px`;
 renderer?.resize();
}
function showSettings(){
 if(game.controlsLocked)return;
 modalKind='settings';
 const langs=[['zh','简中'],['en','EN'],['ja','日本語']];
 openModal(`<div class="settings-heading"><div class="settings-emblem">${icon('sliders',24)}</div><div><span class="settings-eyebrow">TOKEN GARDEN · v${APP_VERSION}</span><h2 id="modal-title">${t().settings}</h2></div><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',18)}</button></div>
 <div class="setting-list" data-version="${APP_VERSION}">
  <section class="setting-card language-card"><div class="setting-label"><span class="setting-icon">${icon('grid',19)}</span><h3>${t().languageLabel}</h3></div><div class="segmented">${langs.map(([key,label])=>`<button class="settings-lang ${lang===key?'active':''}" data-lang="${key}" lang="${{zh:'zh-CN',en:'en',ja:'ja'}[key]}" aria-pressed="${lang===key}"><span>${label}</span><small>${{zh:'中文',en:'English',ja:'Japanese'}[key]}</small></button>`).join('')}</div></section>
  <section class="setting-card president-card ${presidentMode?'enabled':''}"><span class="setting-icon">${icon('star',21)}</span><div class="setting-copy"><h3>${t().presidentMode}</h3><p>${t().presidentHint}</p></div><button class="switch-btn president-toggle" aria-pressed="${presidentMode}" aria-label="${t().presidentMode}"><span class="switch-knob"></span></button></section>
  <section class="setting-card"><span class="setting-icon sound-symbol">${icon(sound?'sound':'mute',20)}</span><div class="setting-copy"><h3>${t().soundLabel}</h3><p class="sound-status">${sound?t().soundOn:t().soundOff}</p></div><button class="switch-btn sound-toggle" aria-pressed="${sound}" aria-label="${t().soundLabel}"><span class="switch-knob"></span></button></section>
 </div><button class="settings-help">${icon('book',18)}<span>${t().navHelp}</span>${icon('arrow',17)}</button>`);
 bindSettings();
}
function bindSettings(){
 modal.querySelector('.president-toggle')?.addEventListener('click',()=>{presidentMode=!presidentMode;save('presidentMode',presidentMode);game.setPresidentMode(presidentMode);updateHUD(true);showSettings();});
 modal.querySelectorAll('.settings-lang').forEach(b=>b.addEventListener('click',()=>{
  lang=b.dataset.lang;save('lang',lang);game.setLanguage(lang);render();processEvents();
  if(modalKind==='settings')showSettings();
 }));
 modal.querySelectorAll('.sound-toggle').forEach(b=>b.addEventListener('click',()=>{sound=!sound;save('sound',sound);playSound('click');updateSound();}));
 modal.querySelector('.settings-help')?.addEventListener('click',()=>{modalKind='help';showHelp();});
}
function bindCardDrag(card){
 const model=card.dataset.model;
 dragCancels.push(bindModelDrag(card,{
  canStart:()=>ready&&!game.controlsLocked&&!modal.open&&['ready','playing'].includes(game.phase),
  onStart:e=>{
   selectModel(model);card.classList.add('drag-source');document.body.classList.add('is-deploying');
   dragGhost=card.cloneNode(true);dragGhost.removeAttribute('data-model');dragGhost.removeAttribute('aria-pressed');dragGhost.setAttribute('aria-hidden','true');dragGhost.tabIndex=-1;
   dragGhost.className='model-card drag-ghost';dragGhost.querySelector('.card-cooldown')?.remove();dragGhost.querySelector('.hotkey')?.remove();document.body.append(dragGhost);
  },
  onMove:e=>{
   dragGhost.style.left=`${e.clientX}px`;dragGhost.style.top=`${e.clientY}px`;
   const tile=boardCell(boardPoint(e.clientX,e.clientY,renderer.canvas.getBoundingClientRect()));
   const occupant=tile&&game.units.find(u=>u.row===tile.row&&u.col===tile.col);
   const valid=!!tile&&(!occupant||occupant.model===model&&starsOf(occupant)<3)&&game.availableTokens>=MODEL_MAP[model].cost&&(game.phase==='ready'||!(game.cooldowns[model]>0));
   renderer.hover=tile;renderer.dragTarget={valid};dragGhost.classList.toggle('invalid',!valid);
  },
  onDrop:e=>{const tile=boardCell(boardPoint(e.clientX,e.clientY,renderer.canvas.getBoundingClientRect()));if(tile)deployAt(tile,model);},
  onEnd:()=>{card.classList.remove('drag-source');document.body.classList.remove('is-deploying');dragGhost?.remove();dragGhost=null;if(renderer){renderer.hover=null;renderer.dragTarget=null;}updateSelectionNote();}
 }));
}
function cancelModelDrag(){for(const cancel of dragCancels)cancel();dragCancels=[];}
function showHarnessShop(u){
 if(game.controlsLocked)return;
 const m=MODEL_MAP[u.model],cost=harnessCost(m),equipped=game.harnessFor(u),options=harnessOptions(m);
 const labels=lang==='zh'?['装备 Harness','已装备','购买装备','Token 不足','三星解锁 · 单独购买','选择装备方向']:lang==='ja'?['Harness装備','装備済み','装備を購入','トークン不足','三つ星で解放・別途購入','装備の方向性を選択']:['Equip Harness','Equipped','Buy equipment','Not enough Tokens','Unlocked at three stars · Separate purchase','Choose a direction'];
 modalKind='harness';
 const intro=equipped?`${labels[1]} · ${equipped.name}`:labels[4];
 const button=option=>`<button class="harness-purchase" data-harness="${option.variant??''}" ${equipped||game.availableTokens<cost?'disabled':''}>${equipped?labels[1]:`${game.availableTokens<cost?labels[3]:labels[2]} · ${cost} Token`}</button>`;
 const single=option=>`<div class="setting-card"><span class="setting-icon">${icon('star',22)}</span><div class="setting-copy"><h3>${labels[0]}</h3><p>${escapeHtml(harnessDescription(m.id,3,lang,option.variant))}</p></div></div>${button(option)}`;
 const multiple=()=>`<div class="harness-options">${options.map(option=>`<div class="harness-option ${equipped&&equipped.variant===option.variant?'equipped':''}"><div class="harness-option-head"><span class="harness-glyph" style="background:${option.color}1a;color:${option.color}">${option.glyph}</span><div><strong>${escapeHtml(option.name)}</strong><small>${cost} Token</small></div></div><p>${escapeHtml(harnessDescription(m.id,3,lang,option.variant))}</p>${button(option)}</div>`).join('')}</div>`;
 const title=options.length>1?labels[5]:options[0].name;
 openModal(`<div class="settings-heading"><div class="settings-emblem">${icon('bolt',24)}</div><div><span class="settings-eyebrow">${m.name} ★★★</span><h2 id="modal-title">${escapeHtml(title)}</h2></div><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',18)}</button></div><p class="modal-intro">${escapeHtml(intro)}</p>${options.length>1?multiple():single(options[0])}`);
 modal.querySelectorAll('.harness-purchase').forEach(el=>el.addEventListener('click',()=>{const result=game.equipHarness(u,el.dataset.harness||undefined);if(result.ok){modal.close();processEvents();updateHUD(true);}else showHarnessShop(u);}));
}
function deployAt(tile,model=selected){
 if(game.controlsLocked)return;
 const occupant=game.units.find(u=>u.row===tile.row&&u.col===tile.col);
 if(model!=='shovel'&&occupant&&starsOf(occupant)===3){
  if(!game.harnessFor(occupant))showHarnessShop(occupant);
  return;
 }

 if(!model){toast(t().empty);return;}
 const result=model==='shovel'?game.remove(tile.row,tile.col):game.plant(model,tile.row,tile.col);
 if(!result.ok){
  const notice=model!=='shovel'?NOTICES[model]:null;
  const title=notice&&(result.reason==='lackTokens'||result.reason==='cooldown')
   ?localized(result.reason==='lackTokens'?notice.quota:notice.rateLimit,lang)
   :result.reason==='maxStars'?rankText(lang).maxStars:t()[result.reason];
  const extra=result.reason==='lackTokens'
   ?t().lackTokensHint.replace('{available}',game.tokens).replace('{required}',MODEL_MAP[model]?.cost??0)
   :result.reason==='cooldown'?t().cooldownHint.replace('{seconds}',Math.ceil(game.cooldowns[model]||0)):'';
  toast(title,true,extra);playSound('strike');
 }else if(model==='shovel')toast(t().removed);
 processEvents();updateHUD(true);
}
function bindCanvas(){
 const canvas=renderer.canvas;
 const coords=e=>boardPoint(e.clientX,e.clientY,canvas.getBoundingClientRect());
 const cell=boardCell;
 canvas.addEventListener('pointermove',e=>{
  const p=coords(e);
  renderer.hover=cell(p);
  const coin=game.coins.find(c=>Math.hypot(c.x-p.x,c.y-p.y)<27);
  if(coin){game.collect(coin.id);processEvents();updateHUD(true);canvas.style.cursor='default';return;}
  canvas.style.cursor=renderer.hover?'crosshair':'default';
 });
 canvas.addEventListener('pointerleave',()=>{renderer.hover=null;});
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const p=coords(e),coin=game.coins.find(c=>Math.hypot(c.x-p.x,c.y-p.y)<27);
  if(coin){game.collect(coin.id);processEvents();updateHUD(true);return;}
  const tile=cell(p);if(!tile)return;
  deployAt(tile);
 });
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();selectModel(null);});
}
function selectModel(id){
 if(game.controlsLocked)return;
 selected=id;playSound('click');if(renderer)renderer.selection=id;
 document.querySelectorAll('[data-model]').forEach(b=>{b.classList.toggle('selected',b.dataset.model===id);b.setAttribute('aria-pressed',String(b.dataset.model===id));});
 const shovel=document.getElementById('shovel');if(shovel){shovel.classList.toggle('active',id==='shovel');shovel.setAttribute('aria-pressed',String(id==='shovel'));}
 updateSelectionNote();
}
let lastSelectionKey='';
function updateSelectionNote(){
 const note=document.getElementById('selection-note');if(!note)return;
 const hover=renderer?.hover,u=hover&&game.units.find(u=>u.row===hover.row&&u.col===hover.col),m=MODEL_MAP[u?.model||selected],stars=u?starsOf(u):1;
 const h=u&&game.harnessFor(u),key=[selected,u?.id,u?.copies,stars,h?.stars,h?.variant,lang].join('|');
 if(lastSelectionKey===key&&note.innerHTML)return;lastSelectionKey=key;
 note.innerHTML=m?`<strong>${m.name} <em>${'★'.repeat(stars)}</em></strong><span>${escapeHtml(skillDescription(m,stars,lang))}${u?` · ${escapeHtml(stackDescription(u,lang))}`:''}${h?` · ${escapeHtml(harnessDescription(h.model,h.stars,lang,h.variant))}`:u&&stars===3?` · ${lang==='zh'?'点击棋子装备':lang==='ja'?'クリックして装備':'Click unit to equip'} Harness · ${harnessCost(m)} Token`:''}</span>`:`<span>${selected==='shovel'?rankText(lang).refund:rankText(lang).empty}</span>`;
}
function mainAction(){
 if(!ready||game.controlsLocked)return;
 if(game.phase==='ready')game.start();else if(game.phase==='playing')game.pause();else if(game.phase==='paused')game.resume();else resetGame();
 playSound('click');processEvents();updateHUD(true);
}
function resetGame(){game=new GardenGame({lang,presidentMode});lastPhase='ready';selected='deepseek';render();}
function openModal(html){
 if(game.controlsLocked)return;
 for(const cancel of dragCancels)cancel();
 modal.classList.toggle('dex-modal',modalKind==='dex');
 modal.classList.toggle('settings-modal',modalKind==='settings');
 if(!modal.open){modalPaused=game.pause();modal.innerHTML=html;modal.showModal();}
 else modal.innerHTML=html;
 modal.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click',()=>modal.close()));updateHUD(true);
}
modal.addEventListener('close',()=>{if(modalPaused){game.resume();modalPaused=false;}updateHUD(true);});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
function showHelp(){
 modalKind='help';
 openModal(`<div class="modal-top"><h2 id="modal-title">${t().howTitle}</h2><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',16)}</button></div><p class="modal-intro">${t().howIntro}</p><div class="how-steps">${t().howSteps.map(([title,desc],i)=>`<div class="how-step"><span class="step-number">${i+1}</span><div><h3>${title}</h3><p>${desc}</p></div></div>`).join('')}</div><p class="fiction">${t().fiction}</p>`);
}
function showScore(){
 if(game.controlsLocked)return;
 modalKind='score';
 const rows=CEOS.filter(c=>game.defeated[c.id]).map(c=>{const record=game.defeated[c.id];return `<tr><th scope="row">${escapeHtml(c.name)}</th><td>${record.count}</td><td>${record.points.toLocaleString()}</td></tr>`;}).join('');
 const rule=lang==='zh'?'普通敌人按图鉴分值计分，迷你敌人统一为 25 分。积分与 Token 分开累计。':lang==='ja'?'通常の敵は図鑑のスコア、ミニ敵は一律25点。スコアとトークンは別集計です。':'Enemies award their field-guide points; mini enemies award 25 points each. Score is separate from Tokens.';
 openModal(`<div class="modal-top"><h2 id="modal-title">${t().score}</h2><button class="icon-btn modal-close" aria-label="${t().close}">${icon('cross',16)}</button></div><div class="score-summary"><strong>${game.score.toLocaleString()}</strong><span>${t().bestScore} ${bestScore.toLocaleString()} · ${t().survived} ${game.wave} · ${t().kills} ${game.kills}</span></div><table class="score-table"><thead><tr><th>${t().enemies}</th><th>${t().kills}</th><th>${t().score}</th></tr></thead><tbody>${rows||`<tr><td colspan="3">—</td></tr>`}</tbody></table><p class="fiction">${rule}</p>`);
}
function updateSound(){
 modal.querySelector('.sound-toggle')?.setAttribute('aria-pressed',String(sound));
 const status=modal.querySelector('.sound-status');if(status)status.textContent=sound?t().soundOn:t().soundOff;
 const symbol=modal.querySelector('.sound-symbol');if(symbol)symbol.innerHTML=icon(sound?'sound':'mute',20);
}
function updateHUD(force=false){
 const locked=game.controlsLocked,banner=document.getElementById('monopoly-banner');
 document.body.classList.toggle('monopoly-locked',locked);
 if(banner)banner.hidden=!locked;
 const countdown=document.getElementById('monopoly-countdown');if(countdown)countdown.textContent=`${game.monopolyRemaining.toFixed(1)}s`;
 document.querySelectorAll('#app button').forEach(b=>{if(locked){if(!b.hasAttribute('data-before-monopoly'))b.dataset.beforeMonopoly=String(b.disabled);b.disabled=true;}else if(b.hasAttribute('data-before-monopoly')){b.disabled=b.dataset.beforeMonopoly==='true';delete b.dataset.beforeMonopoly;}});
 const count=document.getElementById('token-count');if(count)count.textContent=game.presidentMode?'∞':game.tokens;
 const score=document.getElementById('score-count');if(score)score.textContent=game.score.toLocaleString();
 const high=document.getElementById('best-score-count');if(high)high.textContent=bestScore.toLocaleString();
 updateSelectionNote();
 const phase=document.getElementById('phase-pill');if(phase)phase.textContent=game.phase==='ready'?t().ready:game.phase==='paused'?t().paused:game.phase==='lost'?t().lose:`${t().waveOf} ${game.wave} · ∞`;
 const pause=document.getElementById('pause-game');if(pause){pause.disabled=locked||!ready||game.phase==='ready';const resume=game.phase==='paused';pause.innerHTML=icon(resume?'play':['won','lost'].includes(game.phase)?'restart':'pause',18);pause.setAttribute('aria-label',resume?t().resume:['won','lost'].includes(game.phase)?t().playAgain:t().pause);pause.title=pause.getAttribute('aria-label');}
 document.querySelectorAll('[data-model]').forEach(b=>{const m=MODEL_MAP[b.dataset.model],cd=game.cooldowns[m.id]||0;b.classList.toggle('unaffordable',game.availableTokens<m.cost);const cover=b.querySelector('.card-cooldown');cover.hidden=cd<=0;if(cd>0)cover.textContent=`${cd.toFixed(1)}`;});
 const startBtn=document.getElementById('stage-start');if(startBtn)startBtn.hidden=game.phase!=='ready'||!ready;
 if(force||lastPhase!==game.phase){
  const overlay=document.getElementById('stage-overlay');if(!overlay)return;const p=game.phase;
  overlay.hidden=!['paused','won','lost'].includes(p)||modal.open;
  if(!overlay.hidden){
   // Icon only: one mark says what happened, one button says what to do next.
   const result=p==='won'||p==='lost';
   overlay.innerHTML=`${result?`<div class="run-result"><strong>${t().score} ${game.score.toLocaleString()}</strong><span>${t().survived} ${game.wave} · ${t().kills} ${game.kills}</span><button class="result-score">${t().points}</button></div>`:''}<button class="icon-btn overlay-action" aria-label="${result?t().playAgain:t().resume}">${icon(result?'restart':'play',22)}</button>`;
   overlay.querySelector('.result-score')?.addEventListener('click',showScore);
   overlay.querySelector('.overlay-action').addEventListener('click',()=>{if(result)resetGame();else{game.resume();updateHUD(true);}});
  }
  lastPhase=p;
 }
}
function processEvents(){
 const previousBest=bestScore;
 for(const e of game.drainEvents()){
  if(['plant','collect','shoot','wave','kill','mower','win','lose'].includes(e.type))playSound(e.type);
  if(e.type==='upgrade'){toast(`${MODEL_MAP[e.model].name} ${'★'.repeat(e.stars)}`,false,e.stars===3?`${rankText(lang).harness} · ${harnessCost(MODEL_MAP[e.model])} Token`:'');playSound('plant');}
  if(e.type==='equipHarness'){toast(`${MODEL_MAP[e.model].name} · ${e.name||HARNESSES[e.model].name}`,false,harnessDescription(e.model,3,lang,e.variant));playSound('plant');}
  if(e.type==='strike'){toast(t().strike,true,t().strikeHint);playSound('strike');}
  if(e.type==='resumeClaude')toast(t().backToWork);
  if(e.type==='mower')toast(t().mower);
  if(e.type==='wave'&&e.wave>1)toast(`${t().waveStart} ${e.wave} · ∞`);
  if(e.type==='kill')bestScore=Math.max(bestScore,e.score);
  if(e.type==='stolen')toast(t().stolen,true);
  if(e.type==='raidLock'&&e.enemyType!=='qq_raider')toast(ENEMY_COPY[lang].raidLock.replace('{model}',MODEL_MAP[e.model].name),true,ENEMY_COPY[lang].raidHint);
  if(e.type==='abducted')toast((e.enemyType==='qq_raider'?superText().stolen:ENEMY_COPY[lang].raidStolen).replace('{model}',MODEL_MAP[e.model].name),true);
  if(e.type==='superSP')toast(superText().sp,true,ENEMY_COPY[lang].raidHint);
  if(e.type==='dividendMark')toast(superText().mark.replace('{n}',e.count),true);
  if(e.type==='dividendPaid')toast(superText().paid.replace('{n}',Math.round(e.damage)),true);
  if(e.type==='militaryStrike')toast(trumpText().strike.replace('{n}',e.count),true);
  if(e.type==='militaryDeployment'&&e.count)toast(trumpText().deploy.replace('{n}',e.count),true);
  if(e.type==='execution')toast(trumpText().execute.replace('{model}',MODEL_MAP[e.model].name),true);
  if(e.type==='strategicRetreat')toast(trumpText().retreat,true);
  if(e.type==='strategicWithdraw')toast(trumpText().withdraw);
  if(e.type==='elonCast'&&['search','launch','think','repost','trend','limit'].includes(e.skill)){
   const skill=ELON_SKILLS.find(s=>s[0]===e.skill);toast(`Elon Super · ${localized(skill[1],lang)}`,true);
  }
  if(e.type==='elonCorrected')toast(localized({zh:'社区注释：该装甲仍可击穿 · 易伤4秒',en:'Community Note: armor is breakable · Vulnerable for 4s',ja:'コミュニティノート：装甲は破壊可能・4秒弱点'},lang));
  if(e.type==='elonInterrupted')toast(localized({zh:'成功打断 · 抓住输出窗口！',en:'Interrupted · Attack during the opening!',ja:'中断成功・隙を狙おう！'},lang));
  if(e.type==='monopoly'){
   for(const cancel of dragCancels)cancel();selected=null;if(renderer){renderer.selection=null;renderer.hover=null;}
   document.querySelectorAll('[aria-pressed="true"][data-model],#shovel').forEach(b=>{b.classList.remove('selected','active');b.setAttribute('aria-pressed','false');});
   if(modal.open)modal.close();updateHUD(true);
  }
  if(e.type==='monopolyEnd')updateHUD(true);
  if(['bossSpawn','bossRage','bossDefeated'].includes(e.type)){
   const key={bossSpawn:'bossArrives',bossRage:'bossRage',bossDefeated:'bossDefeated'}[e.type];
   const enemy=CEO_MAP[e.enemyType];
   toast(`${ENEMY_COPY[lang][key]} · ${enemy.name}`,e.type!=='bossDefeated',e.reward?`+${e.reward} Token`:localized(enemy.arrivalHint||enemy.desc,lang));
   playSound(e.type==='bossDefeated'?'collect':'wave');
  }
  if(e.type==='win'||e.type==='lose'){best=Math.max(best,game.kills);save('best',best);updateHUD(true);}
 }
 if(bestScore>previousBest)save('best-score',bestScore);
}
document.addEventListener('keydown',e=>{
 if(modal.open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.repeat)return;
 if(dragGhost&&e.key!=='Escape')return;
 if(CARD_HOTKEYS.includes(e.key)&&e.key.length===1){selectModel(LINEUP[CARD_HOTKEYS.indexOf(e.key)].id);e.preventDefault();}
 else if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();mainAction();}
 else if(e.key.toLowerCase()==='s'){selectModel(selected==='shovel'?null:'shovel');e.preventDefault();}
 else if(e.key==='Escape')selectModel(null);
});
// 选中模型后，点击棋盘与卡牌、按钮等交互元素以外的任何区域即可取消选中。
document.addEventListener('pointerdown',e=>{
 if(modal.open||!selected)return;
 if(e.target.closest('canvas, button, a, input, select, textarea'))return;
 selectModel(null);
});
function resumeLockedBattle(){if(game.systemPaused&&game.controlsLocked&&game.resume({system:true}))updateHUD(true);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const cancel of dragCancels)cancel();if(game.pause({system:true}))updateHUD(true);}else resumeLockedBattle();});
addEventListener('desktop:pause',()=>{for(const cancel of dragCancels)cancel();if(game.pause({system:true}))updateHUD(true);});
addEventListener('desktop:focus',resumeLockedBattle);addEventListener('focus',resumeLockedBattle);
addEventListener('resize',fitStage);
function loop(now){
 const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
 // Fixed-size substeps keep projectile and one-second mechanics stable.
 if(ready){let left=dt;while(left>0){const step=Math.min(left,1/60);game.update(step);left-=step;}processEvents();}
 if(renderer)renderer.draw(game,now);
 hudTimer+=dt;if(hudTimer>.1){hudTimer=0;updateHUD();}
 requestAnimationFrame(loop);
}
render();requestAnimationFrame(loop);
loadArtwork().then(loaded=>{
 art=loaded;ready=true;render();
 if(!art.models||!art.ceos||art.missingAnimations.length)toast(localized({zh:'部分动作图集加载失败，请刷新页面重试。',en:'Some animation sheets failed to load. Please refresh.',ja:'一部のモーションを読み込めませんでした。再読み込みしてください。'},lang),true);
});
