'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayStr=()=>new Date().toDateString();
const LEVEL_NAMES={1:'Easy',2:'Medium',3:'Hard'};

// Short maths "glyphs" shown on topic tiles
const GLYPH={algebra:'x²',geometry:'πr²',trigonometry:'θ',statistics:'x̄',fractions:'%',surds:'√',standardform:'10ⁿ',simultaneous:'{ }',algfrac:'a/b',similarity:'∼',functions:'f(x)',vectors:'→',circle:'○',
  h_straight:'y=mx',h_functions:'f∘g',h_poly:'x³',h_recur:'uₙ',h_diff:'dy/dx',h_int:'∫',h_trig:'rad',h_circle:'(a,b)',h_vectors:'a·b',h_logs:'log'};

// ---------------- State ----------------
const STORE='nat5_v4';
const S={
  panel:'practice',currentQ:null,currentTopic:'random',currentDiff:'mixed',answered:false,
  questionNum:1,notepadContent:'',recent:[],
  stats:{answered:0,correct:0,streak:0,bestStreak:0,dailyCount:0,dailyDate:'',dayStreak:0,lastStudyDate:''},
  topicStats:{},settings:{name:'',goal:10,accent:'saltire',mode:'system'},
  timerScores:[],mockScores:[],fcIdx:0,fcCards:[]
};
try{
  const p=JSON.parse(localStorage.getItem(STORE)||'null');
  if(p){
    if(p.stats){const {xp,level,...rest}=p.stats;Object.assign(S.stats,rest);}
    if(p.topicStats)S.topicStats=p.topicStats;
    if(p.notepadContent)S.notepadContent=p.notepadContent;
    if(p.questionNum)S.questionNum=p.questionNum;
    if(p.settings){
      Object.assign(S.settings,p.settings);
      // migrate old theme names
      const old={purple:'thistle',teal:'loch',green:'loch',red:'heather',amber:'whisky'};
      if(p.settings.theme&&!p.settings.accent)S.settings.accent=old[p.settings.theme]||'saltire';
      delete S.settings.theme;
    }
    if(p.timerScores)S.timerScores=p.timerScores;
    if(p.mockScores)S.mockScores=p.mockScores;
  }
}catch(e){}

function save(){
  try{localStorage.setItem(STORE,JSON.stringify({stats:S.stats,topicStats:S.topicStats,notepadContent:S.notepadContent,questionNum:S.questionNum,settings:S.settings,timerScores:S.timerScores,mockScores:S.mockScores}));}catch(e){}
}
function rollDay(){
  const t=todayStr();
  if(S.stats.dailyDate!==t){S.stats.dailyCount=0;S.stats.dailyDate=t;}
  // day streak lapses if the last study day was before yesterday
  if(S.stats.lastStudyDate){
    const y=new Date();y.setDate(y.getDate()-1);
    if(S.stats.lastStudyDate!==t&&S.stats.lastStudyDate!==y.toDateString())S.stats.dayStreak=0;
  }
}
function recordStudy(){
  rollDay();
  const t=todayStr();
  if(S.stats.lastStudyDate!==t){S.stats.dayStreak=(S.stats.dayStreak||0)+1;S.stats.lastStudyDate=t;}
}

let toastTimer;
function toast(msg){
  const el=$('toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

// ---------------- Navigation ----------------
const PANELS=['practice','topics','worksheets','flashcards','mock','timer','formulas','calculator','notepad','progress','resources','shop','settings'];
function showPanel(id,{focus=false}={}){
  if(!PANELS.includes(id))id='practice';
  document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='panel-'+id);
  document.querySelectorAll('[data-nav]').forEach(a=>{
    if(a.dataset.nav===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
  const panel=$('panel-'+id);
  $('page-title').textContent=panel.dataset.title;
  document.title=(id==='practice'?'Free Nat 5 & Higher Maths Revision — Scotland':panel.dataset.title+' — Nat 5 Maths Scotland')+' | nat5mathsscotland.com';
  S.panel=id;
  closeSheet();
  if(id==='progress')renderProg();
  if(id==='topics')renderTopics();
  if(id==='worksheets')closeWS();
  if(id==='notepad')$('notepad-text').value=S.notepadContent;
  if(id==='mock'&&!mock.active)renderMockHome();
  if(id==='practice'&&!S.answered)setTimeout(()=>$('q-input').focus({preventScroll:true}),0);
  if(focus)window.scrollTo(0,0);
}
function route(){showPanel((location.hash||'#practice').slice(1),{focus:true});}
window.addEventListener('hashchange',route);
function go(id){if(location.hash==='#'+id)route();else location.hash=id;}

function openSheet(){$('more-sheet').hidden=false;$('sheet-backdrop').hidden=false;$('more-btn').setAttribute('aria-expanded','true');}
function closeSheet(){$('more-sheet').hidden=true;$('sheet-backdrop').hidden=true;$('more-btn').setAttribute('aria-expanded','false');}
$('more-btn').addEventListener('click',()=>$('more-sheet').hidden?openSheet():closeSheet());
$('sheet-backdrop').addEventListener('click',closeSheet);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});

// ---------------- Topic pickers ----------------
const topicKeys=higher=>Object.keys(TOPICS).filter(k=>!!TOPICS[k].higher===higher);
function fillTopicSelect(sel,{smart=true,all=true}={}){
  const grp=(label,higher)=>{
    const g=document.createElement('optgroup');g.label=label;
    const sfx=higher?'_h':'';
    if(all)g.append(new Option('Random mix ('+(higher?'Higher':'Nat 5')+')','random'+sfx));
    if(smart)g.append(new Option('Smart Mix — focuses on your weakest topics','smart'+sfx));
    topicKeys(higher).forEach(k=>g.append(new Option(TOPICS[k].name,k)));
    sel.append(g);
  };
  grp('National 5',false);grp('Higher',true);
}

// ---------------- Question selection ----------------
function weightedPick(keys){
  const w=keys.map(k=>{const ts=S.topicStats[k];if(!ts||ts.total<3)return 2;return 0.5+3*(1-ts.correct/ts.total);});
  let r=Math.random()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<keys.length;i++){r-=w[i];if(r<=0)return keys[i];}
  return keys[keys.length-1];
}
function pickTopic(t){
  if(t==='random'||t==='random_h'){const k=topicKeys(t==='random_h');return k[Math.floor(Math.random()*k.length)];}
  if(t==='smart'||t==='smart_h')return weightedPick(topicKeys(t==='smart_h'));
  return TOPICS[t]?t:'algebra';
}
function pickQuestion(topic,filter){
  const all=TOPICS[topic].questions;
  let pool=all.filter(filter);if(!pool.length)pool=all;
  // avoid repeating any of the last few questions
  const fresh=pool.filter(q=>!S.recent.includes(q.q));
  if(fresh.length)pool=fresh;
  const q=pool[Math.floor(Math.random()*pool.length)];
  S.recent.push(q.q);if(S.recent.length>12)S.recent.shift();
  return q;
}

// ---------------- Answer marking ----------------
// '|' separates accepted alternatives; top-level ',' separates parts that must all be given (any order).
const SUP='⁰¹²³⁴⁵⁶⁷⁸⁹';
function norm(s){
  return String(s).toLowerCase()
    .replace(/sqrt/g,'√').replace(/(^|[^a-z])pi(?![a-z])/g,'$1π').replace(/theta/g,'θ')
    .replace(/[−–—‐]/g,'-').replace(/\s+/g,'')
    .replace(/[×x]/g,'*').replace(/\^/g,'').replace(/°|degrees?$/g,'')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,d=>SUP.indexOf(d))
    .replace(/√\(([\d.]+)\)/g,'√$1')
    .replace(/\.$/,'');
}
function splitTop(s){const out=[];let d=0,cur='';for(const ch of s){if(ch==='(')d++;else if(ch===')')d--;if(ch===','&&d===0){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
const isNum=s=>/^-?(\d+\.?\d*|\.\d+)$/.test(s);
const VAR=/^[a-zθ*]=/;
const stripVar=s=>s.replace(VAR,'');
// "£138", "13cm", "40%" → number, but only if what's left is a plain number
function unitless(s){const t=s.replace(/^£/,'').replace(/(cm2|cm3|cm|mm2|mm3|mm|km|m2|m3|m|ml|l|kg|g|p|%|units?|litres?|pence)$/,'');return isNum(t)?t:s;}
// products of brackets in any order: (x+2)(x+3) == (x+3)(x+2)
function canon(s){const m=s.match(/^([^()]*)((?:\([^()]+\))+)$/);if(!m)return s;return m[1]+m[2].match(/\([^()]+\)/g).sort().join('');}
function fracVal(s){const m=s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);return m&&+m[2]?(+m[1])/(+m[2]):null;}
function partEq(u,c){
  if(u===c||canon(u)===canon(c))return true;
  if(VAR.test(u)&&VAR.test(c)&&u[0]!==c[0])return false; // named the wrong variable
  const un=unitless(stripVar(u)),cn=stripVar(c);
  if(un===cn||canon(un)===canon(cn))return true;
  if(!isNum(cn))return false;
  const uv=isNum(un)?parseFloat(un):fracVal(un);
  if(uv===null)return false;
  // integers must be exact; decimals allow the rounding band of the stated answer
  const dp=(cn.split('.')[1]||'').length;
  const tol=dp>0?0.5*Math.pow(10,-dp)+1e-9:1e-9;
  return Math.abs(parseFloat(cn)-uv)<=tol;
}
function match(user,correct){
  const raw=String(user).trim().replace(/\s+(and|or|&)\s+/gi,',').replace(/;/g,',');
  if(!raw)return false;
  return String(correct).split('|').some(alt=>{
    const cParts=splitTop(alt).map(norm).filter(Boolean);
    const u=alt.includes(',')?raw:raw.replace(/(\d),(?=\d{3}(?!\d))/g,'$1'); // allow 153,000
    const uParts=splitTop(u).map(norm).filter(Boolean);
    if(uParts.length!==cParts.length)return false;
    const used=cParts.map(()=>false);
    const tryM=i=>{
      if(i===uParts.length)return true;
      for(let j=0;j<cParts.length;j++){
        if(!used[j]&&partEq(uParts[i],cParts[j])){used[j]=true;if(tryM(i+1))return true;used[j]=false;}
      }
      return false;
    };
    return tryM(0);
  });
}
const showAns=a=>esc(String(a).split('|')[0].split(',').join(', '));

// ---------------- Symbol buttons ----------------
const SYMBOLS=['√','²','³','π','−','/','(',')','°',',','='];
document.querySelectorAll('.symbols').forEach(box=>{
  const input=$(box.dataset.for);
  SYMBOLS.forEach(sym=>{
    const b=document.createElement('button');b.type='button';b.textContent=sym;b.tabIndex=-1;
    b.setAttribute('aria-label','Insert '+sym);
    b.addEventListener('mousedown',e=>e.preventDefault()); // keep focus in input
    b.addEventListener('click',()=>{
      if(input.disabled)return;
      const s=input.selectionStart??input.value.length,e=input.selectionEnd??s;
      input.value=input.value.slice(0,s)+sym+input.value.slice(e);
      input.setSelectionRange(s+sym.length,s+sym.length);input.focus();
    });
    box.append(b);
  });
});

// ---------------- Practice ----------------
function calcTag(el,calc){
  el.textContent=calc?'Calculator allowed':'No calculator';
  el.className='tag '+(calc?'tag-calc':'tag-nocalc');
}
function newQuestion(){
  const topic=pickTopic(S.currentTopic);
  const d=S.currentDiff;
  const q=pickQuestion(topic,d==='mixed'?()=>true:x=>x.level===+d);
  S.currentQ={...q,topic};S.answered=false;
  $('q-text').textContent=q.q;
  const inp=$('q-input');inp.value='';inp.disabled=false;
  $('q-topic-label').textContent=TOPICS[topic].name;
  $('q-num').textContent=S.questionNum;
  const lv=$('q-level');lv.textContent=LEVEL_NAMES[q.level];lv.className='tag tag-lvl-'+q.level;
  calcTag($('calc-badge'),TOPICS[topic].calc);
  $('calc-link').hidden=!TOPICS[topic].calc;
  $('feedback-area').innerHTML='';
  $('check-btn').hidden=false;$('hint-btn').hidden=false;$('skip-btn').hidden=false;
  if(S.panel==='practice')inp.focus({preventScroll:true});
}
function checkAnswer(){
  if(!S.currentQ||S.answered)return;
  const raw=$('q-input').value.trim();
  if(!raw){$('q-input').focus();return;}
  S.answered=true;
  const q=S.currentQ,ok=match(raw,q.a);
  recordStudy();
  S.stats.answered++;S.stats.dailyCount++;
  const ts=S.topicStats[q.topic]||(S.topicStats[q.topic]={correct:0,total:0});
  ts.total++;
  $('q-input').disabled=true;
  $('check-btn').hidden=true;$('hint-btn').hidden=true;$('skip-btn').hidden=true;
  let html;
  if(ok){
    S.stats.correct++;ts.correct++;S.stats.streak++;
    if(S.stats.streak>S.stats.bestStreak)S.stats.bestStreak=S.stats.streak;
    const run=S.stats.streak>=3?` <span class="muted">· ${S.stats.streak} in a row</span>`:'';
    html=`<div class="fb fb-ok"><div class="fb-head"><svg class="ico"><use href="#i-check"/></svg>Correct${run}</div>
      <div class="fb-exp"><b>Working:</b> ${esc(q.explain)}</div>
      <button class="btn btn-primary" id="next-btn">Next question<svg class="ico"><use href="#i-arrow"/></svg></button></div>`;
  }else{
    S.stats.streak=0;
    html=`<div class="fb fb-no"><div class="fb-head"><svg class="ico"><use href="#i-x"/></svg>Not quite</div>
      You answered <span class="ans">${esc(raw)}</span>. The answer is <span class="ans">${showAns(q.a)}</span>.
      <div class="fb-exp"><b>How to do it:</b> ${esc(q.explain)}</div>
      <button class="btn btn-primary" id="next-btn">Next question<svg class="ico"><use href="#i-arrow"/></svg></button></div>`;
  }
  $('feedback-area').innerHTML=html;
  $('next-btn').addEventListener('click',nextQuestion);
  $('next-btn').focus({preventScroll:true});
  S.questionNum++;save();updateHeader();
  if(ok&&S.stats.dailyCount===(S.settings.goal||10))toast('Daily goal reached — nice work');
  else if(ok&&S.stats.streak>0&&S.stats.streak%5===0)toast(S.stats.streak+' correct in a row');
}
function nextQuestion(){newQuestion();}
function skipQuestion(){if(S.answered)return;S.stats.streak=0;updateHeader();save();newQuestion();}
function getHint(){
  if(!S.currentQ||S.answered)return;
  $('feedback-area').innerHTML=`<div class="fb fb-hint"><div class="fb-head"><svg class="ico"><use href="#i-bulb"/></svg>Hint</div>${esc(S.currentQ.hint)}</div>`;
  $('q-input').focus({preventScroll:true});
}
function updateHeader(){
  rollDay();
  const g=S.settings.goal||10,dc=S.stats.dailyCount||0,pct=Math.min(100,dc/g*100);
  $('hdr-days').textContent=S.stats.dayStreak||0;
  $('hdr-daily').textContent=dc;$('hdr-goal').textContent=g;
  $('goal-ring').setAttribute('stroke-dasharray',pct+' 100');
  document.querySelector('.chip-goal').classList.toggle('done',dc>=g);
  $('daily-count').textContent=dc;$('daily-goal-lbl').textContent=g;
  $('goal-fill').style.width=pct+'%';
  $('run-streak').textContent=S.stats.streak;$('best-streak').textContent=S.stats.bestStreak;
}
function setTopic(k){S.currentTopic=k;$('topic-select').value=k;newQuestion();}

$('answer-form').addEventListener('submit',e=>{e.preventDefault();checkAnswer();});
$('hint-btn').addEventListener('click',getHint);
$('skip-btn').addEventListener('click',skipQuestion);
$('topic-select').addEventListener('change',e=>setTopic(e.target.value));
$('diff-seg').addEventListener('click',e=>{
  const b=e.target.closest('[data-diff]');if(!b)return;
  S.currentDiff=b.dataset.diff;
  $('diff-seg').querySelectorAll('[data-diff]').forEach(x=>x.setAttribute('aria-checked',x===b));
  newQuestion();
});
// Enter moves on after an answer has been marked
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&S.panel==='practice'&&S.answered&&document.activeElement?.id!=='next-btn'&&!e.target.closest('select,textarea')){e.preventDefault();nextQuestion();}
});

// ---------------- Topics ----------------
function accClass(pct,total){return !total?'':pct<50?'acc-low':pct<75?'acc-mid':'acc-high';}
function renderTopics(){
  const g=$('topic-grid');g.innerHTML='';
  [['National 5',false],['Higher',true]].forEach(([label,higher])=>{
    const sec=document.createElement('div');sec.className='topic-section';
    sec.innerHTML=`<h2 class="section-title">${label}</h2><div class="topic-grid"></div>`;
    const grid=sec.lastElementChild;
    topicKeys(higher).forEach(k=>{
      const t=TOPICS[k],ts=S.topicStats[k]||{correct:0,total:0};
      const pct=ts.total?Math.round(ts.correct/ts.total*100):0;
      const b=document.createElement('button');b.className='tile '+accClass(pct,ts.total);
      b.innerHTML=`<div class="tile-top"><span class="glyph">${esc(GLYPH[k]||t.icon)}</span><span class="tag ${t.calc?'tag-calc':'tag-nocalc'}">${t.calc?'Calc':'No calc'}</span></div>
        <h3>${esc(t.name)}</h3>
        <div class="tile-meta">${ts.total?`${pct}% correct · ${ts.total} answered`:`${t.questions.length} questions · not started`}</div>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>`;
      b.addEventListener('click',()=>{setTopic(k);go('practice');});
      grid.append(b);
    });
    g.append(sec);
  });
}

// ---------------- Worksheets ----------------
const DIFF_TAG={Easy:'tag-lvl-1',Medium:'tag-lvl-2',Hard:'tag-lvl-3',Mixed:'tag-topic'};
function renderWS(){
  const el=$('sheet-list');el.innerHTML='';
  WORKSHEETS.forEach((ws,i)=>{
    const t=TOPICS[ws.topic];
    const b=document.createElement('button');b.className='tile';
    b.innerHTML=`<div class="tile-top"><span class="glyph">${esc(GLYPH[ws.topic]||t.icon)}</span><span class="tag ${DIFF_TAG[ws.diff]||'tag-topic'}">${ws.diff}</span></div>
      <h3>${esc(ws.title)}</h3><div class="tile-meta">${ws.qs.length} questions · ${t.calc?'calculator allowed':'no calculator'}</div>`;
    b.addEventListener('click',()=>openWS(i));el.append(b);
  });
}
function openWS(idx){
  const ws=WORKSHEETS[idx],t=TOPICS[ws.topic];
  const qs=ws.qs.map(i=>t.questions[i]).filter(Boolean);
  $('ws-list').hidden=true;
  const av=$('ws-active');av.hidden=false;
  av.innerHTML=`<div class="card">
    <div class="ws-head">
      <div><h2 class="card-title" style="margin-bottom:6px">${esc(ws.title)}</h2>
        <span class="tag ${t.calc?'tag-calc':'tag-nocalc'}">${t.calc?'Calculator allowed':'No calculator'}</span> <span class="tag ${DIFF_TAG[ws.diff]}">${ws.diff}</span></div>
      <button class="btn btn-ghost btn-sm" data-ws-back><svg class="ico"><use href="#i-back"/></svg>All worksheets</button>
    </div>
    <form id="ws-form" autocomplete="off">
    ${qs.map((q,i)=>`<div class="ws-q"><p><span class="num">${i+1}</span>${esc(q.q)}</p>
      <label class="sr-only" for="wsq${i}">Answer to question ${i+1}</label>
      <input class="input" type="text" id="wsq${i}" data-i="${i}" placeholder="Your answer" spellcheck="false" autocapitalize="off">
      <div class="ws-fb" id="wsfb${i}"></div></div>`).join('')}
    <div class="btn-row" style="margin-top:16px">
      <button type="submit" class="btn btn-primary">Check all answers</button>
      <button type="button" class="btn btn-ghost" data-ws-reset>Clear</button>
      <span class="ws-score" id="ws-score"></span>
    </div></form></div>`;
  const form=$('ws-form');
  const checkOne=i=>{
    const q=qs[i],user=$('wsq'+i).value.trim(),fb=$('wsfb'+i);
    if(!user){fb.innerHTML='<span class="muted">Not answered.</span> Answer: <b>'+showAns(q.a)+'</b>';return false;}
    const ok=match(user,q.a);
    fb.innerHTML=ok?`<span class="ok">Correct.</span> <span class="muted">${esc(q.explain)}</span>`
      :`<span class="no">Answer: ${showAns(q.a)}</span> <span class="muted">— ${esc(q.explain)}</span>`;
    return ok;
  };
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const n=qs.reduce((a,_,i)=>a+(checkOne(i)?1:0),0);
    $('ws-score').textContent=`${n} / ${qs.length} correct`;
  });
  form.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!e.target.dataset.i)return;
    e.preventDefault();const i=+e.target.dataset.i;
    if(e.target.value.trim())checkOne(i);
    const next=$('wsq'+(i+1));if(next)next.focus();
  });
  av.querySelector('[data-ws-back]').addEventListener('click',closeWS);
  av.querySelector('[data-ws-reset]').addEventListener('click',()=>openWS(idx));
  window.scrollTo(0,0);$('wsq0')?.focus({preventScroll:true});
}
function closeWS(){$('ws-list').hidden=false;$('ws-active').hidden=true;$('ws-active').innerHTML='';}

// ---------------- Flashcards ----------------
function loadFC(){S.fcCards=[...(FLASHCARDS[$('fc-topic').value]||FLASHCARDS.all)];S.fcIdx=0;showFC();}
function showFC(){
  const c=S.fcCards[S.fcIdx];if(!c)return;
  $('flashcard').classList.remove('flipped');
  $('fc-term').textContent=c.term;$('fc-term-back').textContent=c.term;$('fc-def').textContent=c.def;
  $('fc-idx').textContent=S.fcIdx+1;$('fc-tot').textContent=S.fcCards.length;
}
function flipCard(){$('flashcard').classList.toggle('flipped');}
function stepFC(d){S.fcIdx=(S.fcIdx+d+S.fcCards.length)%S.fcCards.length;showFC();}
function shuffleFC(){for(let i=S.fcCards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[S.fcCards[i],S.fcCards[j]]=[S.fcCards[j],S.fcCards[i]];}S.fcIdx=0;showFC();toast('Deck shuffled');}
$('fc-topic').addEventListener('change',loadFC);
$('flashcard').addEventListener('click',flipCard);
$('fc-prev').addEventListener('click',()=>stepFC(-1));
$('fc-next').addEventListener('click',()=>stepFC(1));
$('fc-shuffle').addEventListener('click',shuffleFC);
document.addEventListener('keydown',e=>{
  if(S.panel!=='flashcards'||e.target.closest('input,select,textarea'))return;
  if(e.key==='ArrowRight')stepFC(1);else if(e.key==='ArrowLeft')stepFC(-1);
  else if(e.key===' '&&e.target.id!=='flashcard'){e.preventDefault();flipCard();}
});

// ---------------- Timed challenge ----------------
const timer={interval:null,left:0,secs:0,score:0,topic:'random',q:null,token:0,locked:false};
function startTimer(secs){
  timer.topic=$('timer-topic').value;timer.secs=secs;timer.left=secs;timer.score=0;
  $('timer-setup').hidden=true;$('timer-result').hidden=true;$('timer-game').hidden=false;
  $('timer-score-lbl').textContent='0';
  const d=$('timer-display');d.textContent=secs;d.classList.remove('urgent');
  newTimerQ();
  clearInterval(timer.interval);
  timer.interval=setInterval(()=>{
    timer.left--;d.textContent=timer.left;
    if(timer.left<=10)d.classList.add('urgent');
    if(timer.left<=0)endTimer();
  },1000);
}
function newTimerQ(){
  timer.token++;timer.locked=false;
  const t=pickTopic(timer.topic);
  timer.q=pickQuestion(t,q=>q.level<=2);
  $('timer-q').textContent=timer.q.q;
  const inp=$('timer-input');inp.value='';inp.disabled=false;inp.focus({preventScroll:true});
}
function checkTimerAnswer(){
  const raw=$('timer-input').value.trim();
  if(!raw||!timer.q||timer.locked)return;
  const fb=$('timer-fb');
  if(match(raw,timer.q.a)){
    timer.score++;$('timer-score-lbl').textContent=timer.score;
    fb.innerHTML='<span class="ok">Correct</span>';newTimerQ();
  }else{
    timer.locked=true;$('timer-input').disabled=true;
    fb.innerHTML=`<span class="no">Answer: ${showAns(timer.q.a)}</span>`;
    const tk=timer.token;setTimeout(()=>{if(tk===timer.token&&timer.interval)newTimerQ();},1200);
  }
}
function endTimer(){
  clearInterval(timer.interval);timer.interval=null;timer.token++;
  $('timer-game').hidden=true;$('timer-result').hidden=false;$('timer-fb').textContent='';
  $('timer-final').textContent=timer.score+' correct';
  const best=S.timerScores.filter(s=>s.secs===timer.secs).reduce((m,s)=>Math.max(m,s.score),0);
  const mins=timer.secs/60;
  $('timer-msg').textContent=timer.score>best?`New personal best for the ${mins}-minute challenge.`:
    `Your best for ${mins} minute${mins>1?'s':''} is ${best}. `+(timer.score>=best*0.8?'Close!':'Keep practising.');
  S.timerScores.push({score:timer.score,secs:timer.secs,date:new Date().toLocaleDateString('en-GB')});
  if(S.timerScores.length>30)S.timerScores=S.timerScores.slice(-30);
  save();
}
function resetTimer(){clearInterval(timer.interval);timer.interval=null;timer.token++;$('timer-setup').hidden=false;$('timer-game').hidden=true;$('timer-result').hidden=true;}
document.querySelectorAll('#timer-setup [data-secs]').forEach(b=>b.addEventListener('click',()=>startTimer(+b.dataset.secs)));
$('timer-form').addEventListener('submit',e=>{e.preventDefault();checkTimerAnswer();});
$('timer-skip').addEventListener('click',()=>{if(!timer.locked){$('timer-fb').textContent='';newTimerQ();}});
$('timer-stop').addEventListener('click',endTimer);
$('timer-again').addEventListener('click',resetTimer);

// ---------------- Mock exams ----------------
const mock={active:false,paper:null,questions:[],idx:0,answers:[],correct:[],score:0,left:0,interval:null,locked:false};
const fmtTime=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
function renderMockHome(){
  const el=$('mock-papers');el.innerHTML='';
  Object.entries(MOCK_PAPERS).forEach(([n,p])=>{
    const d=document.createElement('div');d.className='tile paper';
    d.innerHTML=`<div class="tile-top"><span class="glyph">${p.short.startsWith('Higher')?'H'+p.short.slice(-1):'P'+n}</span></div>
      <h3>${esc(p.title)}</h3>
      <div class="paper-facts"><span class="tag">${p.questions.length} questions</span><span class="tag">${p.totalMarks} marks</span><span class="tag">${p.duration/60} min</span>
      <span class="tag ${p.calcAllowed?'tag-calc':'tag-nocalc'}">${p.calcAllowed?'Calculator':'No calculator'}</span></div>
      <button class="btn btn-primary">Start paper</button>`;
    d.querySelector('button').addEventListener('click',()=>startMock(+n));
    el.append(d);
  });
  const prev=$('mock-prev-scores');
  if(S.mockScores.length){prev.hidden=false;prev.innerHTML='<h2 class="card-title">Recent attempts</h2>'+mockHistoryHTML(5);}
  else prev.hidden=true;
}
function mockHistoryHTML(n){
  if(!S.mockScores.length)return '<p class="empty">No mock exams yet. Try one from the Mock exams page.</p>';
  return [...S.mockScores].slice(-n).reverse().map(s=>`<div class="list-row">
    <span class="rank">${esc(s.grade==='No Award'?'–':s.grade)}</span>
    <span class="grow">${esc((MOCK_PAPERS[s.paper]&&MOCK_PAPERS[s.paper].short)||'Paper '+s.paper)} · ${s.score}/${s.total} (${s.pct}%)</span>
    <span class="muted small">${esc(s.date)}</span></div>`).join('');
}
function startMock(n){
  const p=MOCK_PAPERS[n];
  Object.assign(mock,{active:true,paper:n,questions:[...p.questions],idx:0,answers:new Array(p.questions.length).fill(''),correct:new Array(p.questions.length).fill(false),score:0,left:p.duration,locked:false});
  $('mock-home').hidden=true;$('mock-results').hidden=true;$('mock-exam').hidden=false;
  $('mock-paper-title').textContent=p.title;
  calcTag($('mock-calc-status'),p.calcAllowed);
  $('mock-marks-so-far').textContent='0';
  const clock=$('mock-timer-display');clock.textContent=fmtTime(mock.left);clock.classList.remove('low');
  clearInterval(mock.interval);mock.interval=setInterval(mockTick,1000);
  showMockQ();window.scrollTo(0,0);
}
function mockTick(){
  mock.left--;
  const clock=$('mock-timer-display');clock.textContent=fmtTime(Math.max(0,mock.left));
  if(mock.left<=300)clock.classList.add('low');
  if(mock.left<=0)endMock();
}
function showMockQ(){
  const q=mock.questions[mock.idx],total=mock.questions.length;
  mock.locked=false;
  $('mock-q-counter').textContent=`Question ${mock.idx+1} of ${total}`;
  $('mock-topic-label').textContent=q.topic;
  $('mock-marks-label').textContent=q.marks+(q.marks===1?' mark':' marks');
  $('mock-q-text').textContent=q.q;
  const inp=$('mock-answer');inp.value='';inp.disabled=false;inp.focus({preventScroll:true});
  $('mock-fb').innerHTML='';$('mock-submit').disabled=false;$('mock-skip').disabled=false;
  $('mock-prog-bar').style.width=(mock.idx/total*100)+'%';
}
function advanceMock(){mock.idx++;if(mock.idx>=mock.questions.length)endMock();else showMockQ();}
function submitMockAnswer(){
  if(!mock.active||mock.locked)return;
  const raw=$('mock-answer').value.trim();
  if(!raw){$('mock-answer').focus();return;}
  mock.locked=true;
  const q=mock.questions[mock.idx],ok=match(raw,q.a);
  mock.answers[mock.idx]=raw;mock.correct[mock.idx]=ok;
  if(ok)mock.score+=q.marks;
  $('mock-marks-so-far').textContent=mock.score;
  $('mock-answer').disabled=true;$('mock-submit').disabled=true;$('mock-skip').disabled=true;
  $('mock-fb').innerHTML=ok
    ?`<div class="fb fb-ok"><div class="fb-head"><svg class="ico"><use href="#i-check"/></svg>Correct — ${q.marks} mark${q.marks>1?'s':''}</div></div>`
    :`<div class="fb fb-no"><div class="fb-head"><svg class="ico"><use href="#i-x"/></svg>Answer: ${showAns(q.a)}</div>${esc(q.explain)}</div>`;
  const at=mock.idx;
  setTimeout(()=>{if(mock.active&&mock.idx===at)advanceMock();},ok?1200:3000);
}
function skipMockQ(){if(!mock.active||mock.locked)return;mock.answers[mock.idx]='';advanceMock();}
function endMock(){
  if(!mock.active)return;
  clearInterval(mock.interval);mock.interval=null;mock.active=false;
  $('mock-exam').hidden=true;$('mock-results').hidden=false;$('mock-review-section').hidden=true;
  const p=MOCK_PAPERS[mock.paper],total=p.totalMarks,score=mock.score,pct=Math.round(score/total*100);
  let grade,msg;
  if(pct>=70){grade='A';msg="That's A-grade standard. Excellent work.";}
  else if(pct>=60){grade='B';msg='A solid B. Review the questions you dropped to push for an A.';}
  else if(pct>=50){grade='C';msg='A pass at C. Target your weakest topics to move up a grade.';}
  else if(pct>=40){grade='D';msg='Close to a pass. Use Smart Mix to work on the topics you found hardest.';}
  else{grade='No Award';msg='Not there yet — that is what practice is for. Review your answers, then try again.';}
  $('mock-grade-icon').textContent=grade==='No Award'?'–':grade;
  $('mock-grade-title').textContent=grade==='No Award'?'Keep practising':'Grade '+grade;
  $('mock-score-display').textContent=`${score} / ${total}`;
  $('mock-grade-band').textContent=`${pct}% · ${p.title}`;
  $('mock-grade-msg').textContent=msg;
  S.mockScores.push({paper:mock.paper,score,total,pct,grade,date:new Date().toLocaleDateString('en-GB')});
  if(S.mockScores.length>50)S.mockScores=S.mockScores.slice(-50);
  save();window.scrollTo(0,0);
}
function showMockReview(){
  const sec=$('mock-review-section');sec.hidden=false;
  $('mock-review-list').innerHTML=mock.questions.map((q,i)=>{
    const given=mock.answers[i],ok=mock.correct[i];
    return `<div class="review-item ${ok?'ok':'no'}">
      <div class="meta">${i+1}. ${esc(q.topic)} · ${q.marks} mark${q.marks>1?'s':''}</div>
      <div class="q">${esc(q.q)}</div>
      <div>Your answer: <b>${given?esc(given):'<span class="muted">blank</span>'}</b>${ok?'':` · Correct: <b>${showAns(q.a)}</b>`}</div>
      ${ok?'':`<div class="exp">${esc(q.explain)}</div>`}</div>`;
  }).join('');
  sec.scrollIntoView({behavior:'smooth'});
}
function resetMock(){
  clearInterval(mock.interval);mock.interval=null;mock.active=false;
  $('mock-home').hidden=false;$('mock-exam').hidden=true;$('mock-results').hidden=true;
  renderMockHome();window.scrollTo(0,0);
}
$('mock-form').addEventListener('submit',e=>{e.preventDefault();submitMockAnswer();});
$('mock-skip').addEventListener('click',skipMockQ);
$('mock-end').addEventListener('click',()=>{if(confirm('End the exam now? Unanswered questions score zero.'))endMock();});
$('mock-review-btn').addEventListener('click',showMockReview);
$('mock-back').addEventListener('click',resetMock);
window.addEventListener('beforeunload',e=>{if(mock.active){e.preventDefault();e.returnValue='';}});

// ---------------- Progress ----------------
function renderProg(){
  rollDay();
  const st=S.stats,acc=st.answered?Math.round(st.correct/st.answered*100)+'%':'–';
  $('stats-grid').innerHTML=[
    [st.answered,'Questions answered'],[acc,'Accuracy'],[st.dayStreak||0,'Day streak'],
    [st.bestStreak,'Best run in a row'],[st.dailyCount+' / '+(S.settings.goal||10),'Today'],[S.mockScores.length,'Mock exams taken']
  ].map(([n,l])=>`<div class="stat"><div class="stat-num">${n}</div><div class="stat-lbl">${l}</div></div>`).join('');
  const rows=Object.entries(TOPICS).map(([k,t])=>{const ts=S.topicStats[k]||{correct:0,total:0};return {k,t,ts,pct:ts.total?Math.round(ts.correct/ts.total*100):null};});
  rows.sort((a,b)=>(a.pct===null)-(b.pct===null)||(a.pct??0)-(b.pct??0));
  const list=$('topic-prog');list.innerHTML='';
  rows.forEach(({k,t,ts,pct})=>{
    const r=document.createElement('div');r.className='prog-row '+accClass(pct??0,ts.total);
    r.innerHTML=`<div class="name">${esc(t.name)}<small>${t.higher?'Higher · ':''}${ts.total?`${ts.correct}/${ts.total} correct · ${pct}%`:'Not started'}</small></div>
      <div class="bar"><div class="bar-fill" style="width:${pct??0}%"></div></div>
      <button class="btn btn-ghost">Practise</button>`;
    r.querySelector('button').addEventListener('click',()=>{setTopic(k);go('practice');});
    list.append(r);
  });
  const lb=$('leaderboard');
  if(S.timerScores.length){
    lb.innerHTML=[...S.timerScores].sort((a,b)=>b.score-a.score).slice(0,5).map((s,i)=>`<div class="list-row">
      <span class="rank ${i===0?'r1':''}">${i+1}</span><span class="grow">${s.secs/60}-minute challenge</span>
      <b>${s.score}</b><span class="muted small">${esc(s.date)}</span></div>`).join('');
  }else lb.innerHTML='<p class="empty">No scores yet — try the Timed challenge.</p>';
  $('mock-history').innerHTML=mockHistoryHTML(8);
}
function resetProg(){
  if(!confirm('Reset all progress? This cannot be undone.'))return;
  S.stats={answered:0,correct:0,streak:0,bestStreak:0,dailyCount:0,dailyDate:todayStr(),dayStreak:0,lastStudyDate:''};
  S.topicStats={};S.questionNum=1;S.timerScores=[];S.mockScores=[];
  save();renderProg();updateHeader();toast('Progress reset');
}
$('reset-prog').addEventListener('click',resetProg);

// ---------------- Calculator ----------------
// Small recursive-descent parser — no eval. Angles in degrees.
const RAD=Math.PI/180;
const CALC_FNS=[['sin⁻¹(',x=>Math.asin(x)/RAD],['cos⁻¹(',x=>Math.acos(x)/RAD],['tan⁻¹(',x=>Math.atan(x)/RAD],
  ['sin(',x=>Math.sin(x*RAD)],['cos(',x=>Math.cos(x*RAD)],['tan(',x=>Math.tan(x*RAD)],
  ['√(',Math.sqrt],['log(',Math.log10],['ln(',Math.log]];
function calcEval(src){
  const s=src.replace(/\s+/g,'').replace(/\*/g,'×').replace(/\//g,'÷').replace(/−/g,'-');
  let i=0;
  const startsPrimary=()=>i<s.length&&(/[\d.(πe√]/.test(s[i])||CALC_FNS.some(([n])=>s.startsWith(n,i))||s.startsWith('Ans',i));
  function primary(){
    for(const [n,fn] of CALC_FNS)if(s.startsWith(n,i)){i+=n.length;const v=expr();if(s[i]===')')i++;return fn(v);}
    if(s[i]==='('){i++;const v=expr();if(s[i]===')')i++;return v;}
    if(s[i]==='π'){i++;return Math.PI;}
    if(s.startsWith('Ans',i)){i+=3;return calc.ans;}
    if(s[i]==='e'){i++;return Math.E;}
    const m=s.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
    if(m){i+=m[0].length;return parseFloat(m[0]);}
    throw new Error('syntax');
  }
  function postfix(){
    let v=primary();
    for(;;){
      if(s[i]==='²'){i++;v=v*v;}else if(s[i]==='³'){i++;v=v*v*v;}
      else if(s[i]==='%'){i++;v=v/100;}else break;
    }
    return v;
  }
  function power(){const b=postfix();if(s[i]==='^'){i++;return Math.pow(b,unary());}return b;}
  function unary(){if(s[i]==='-'){i++;return -unary();}if(s[i]==='+'){i++;return unary();}return power();}
  function term(){
    let v=unary();
    for(;;){
      if(s[i]==='×'){i++;v*=unary();}
      else if(s[i]==='÷'){i++;v/=unary();}
      else if(startsPrimary())v*=unary(); // implicit multiplication: 2π, 3(4), 2sin(30)
      else return v;
    }
  }
  function expr(){let v=term();for(;;){if(s[i]==='+'){i++;v+=term();}else if(s[i]==='-'){i++;v-=term();}else return v;}}
  const v=expr();
  if(i<s.length)throw new Error('syntax');
  if(!isFinite(v))throw new Error('math');
  return v;
}
const calc={expr:'',ans:0,done:false};
const CALC_KEYS=[
  ['sin(','cfn','sin'],['cos(','cfn','cos'],['tan(','cfn','tan'],['(','cfn'],[')','cfn'],
  ['sin⁻¹(','cfn','sin⁻¹'],['cos⁻¹(','cfn','cos⁻¹'],['tan⁻¹(','cfn','tan⁻¹'],['π','cfn'],['√(','cfn','√'],
  ['²','cfn','x²'],['^','cfn','xʸ'],['log(','cfn','log'],['ln(','cfn','ln'],['Ans','cfn'],
  ['7','cnum'],['8','cnum'],['9','cnum'],['÷','cop'],['DEL','cclr','⌫'],
  ['4','cnum'],['5','cnum'],['6','cnum'],['×','cop'],['AC','cclr'],
  ['1','cnum'],['2','cnum'],['3','cnum'],['-','cop','−'],['%','cfn'],
  ['0','cnum'],['.','cnum'],['e','cfn'],['+','cop'],['=','ceq'],
];
function buildCalc(){
  const g=$('calc-btns');
  CALC_KEYS.forEach(([v,cls,label])=>{
    const b=document.createElement('button');b.className='cbtn '+cls;b.textContent=label||v;b.type='button';
    b.addEventListener('click',()=>calcPress(v));g.append(b);
  });
}
function calcRender(){$('calc-main').textContent=calc.expr||'0';}
function calcPress(v){
  if(v==='AC'){calc.expr='';calc.done=false;$('calc-prev').textContent='';return calcRender();}
  if(v==='DEL'){
    if(calc.done){calc.expr='';calc.done=false;return calcRender();}
    const fn=CALC_FNS.find(([n])=>calc.expr.endsWith(n));
    calc.expr=calc.expr.slice(0,fn?-fn[0].length:(calc.expr.endsWith('Ans')?-3:-1));return calcRender();
  }
  if(v==='='){
    if(!calc.expr)return;
    try{
      const r=calcEval(calc.expr);
      $('calc-prev').textContent=calc.expr+' =';
      calc.ans=r;calc.expr=String(parseFloat(r.toPrecision(12)));calc.done=true;
    }catch(e){$('calc-prev').textContent=calc.expr;calc.expr='';calc.done=false;$('calc-main').textContent='Error';return;}
    return calcRender();
  }
  // after a result, typing a number starts fresh; an operator carries on from the answer
  if(calc.done){calc.done=false;if(!/^[+\-×÷^²%]/.test(v))calc.expr='';}
  calc.expr+=v;calcRender();
}
document.addEventListener('keydown',e=>{
  if(S.panel!=='calculator'||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea'))return;
  const map={'*':'×','/':'÷',Enter:'=','=':'=',Backspace:'DEL',Escape:'AC',Delete:'AC','^':'^','p':'π','s':'sin(','c':'cos(','t':'tan(','r':'√(','l':'log(','n':'ln('};
  let v=map[e.key]??(/^[\d.+\-()%e]$/.test(e.key)?e.key:null);
  if(v===null)return;
  e.preventDefault();
  if(e.target.closest?.('.cbtn')&&e.key==='Enter')v='=';
  calcPress(v);
});

// ---------------- Notepad ----------------
let noteTimer;
$('notepad-text').addEventListener('input',e=>{
  S.notepadContent=e.target.value;$('note-status').textContent='Saving…';
  clearTimeout(noteTimer);noteTimer=setTimeout(()=>{save();$('note-status').textContent='Saved on this device';},400);
});
$('note-clear').addEventListener('click',()=>{if(confirm('Clear all notes?')){$('notepad-text').value='';S.notepadContent='';save();}});
$('note-copy').addEventListener('click',()=>{
  const txt=$('notepad-text').value;
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Notes copied'),()=>{$('notepad-text').select();toast('Press Ctrl+C to copy');});
});
$('note-download').addEventListener('click',()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([$('notepad-text').value],{type:'text/plain'}));
  a.download='nat5-maths-notes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

// ---------------- Shop ----------------
const TAG='cazza09-21';
const SHOP=[
  ['Revision books',[
    ['Nat 5 Maths revision guide','Complete coverage of the SQA course with worked examples','national+5+maths+revision+scotland'],
    ['Nat 5 practice papers','Exam-style papers with full marking schemes','national+5+maths+practice+papers+scotland'],
    ['Hodder Gibson Nat 5 Maths','Textbooks used in many Scottish schools','hodder+national+5+maths+scotland'],
    ['Higher Maths revision','Guides and practice papers for Higher','higher+maths+revision+scotland+sqa'],
  ]],
  ['Calculators',[
    ['Casio fx-85GTX','The standard scientific calculator for Scottish exams','casio+fx-85gtx+scientific+calculator'],
    ['Casio fx-991EX','More advanced model — useful for Higher too','casio+fx-991ex+scientific+calculator'],
  ]],
  ['Stationery',[
    ['Geometry set','Compass, protractor, ruler and set squares','maths+geometry+set+compass+protractor'],
    ['Graph paper notebook','For graphs, sketches and working','graph+paper+notebook+maths'],
    ['Revision flashcards','Make your own formula cards','revision+flashcards+blank+cards'],
    ['Highlighters and pens','Colour-code notes and key formulas','highlighter+pens+set+revision'],
  ]],
];
function renderShop(){
  $('shop-sections').innerHTML=SHOP.map(([title,items])=>`<div class="shop-section"><h2 class="section-title">${title}</h2><div class="grid-cards">
    ${items.map(([n,d,q])=>`<a class="tile shop-card" href="https://www.amazon.co.uk/s?k=${q}&tag=${TAG}" target="_blank" rel="noopener sponsored"><h3>${esc(n)}</h3><small>${esc(d)}</small><span class="cta">View on Amazon<svg class="ico"><use href="#i-external"/></svg></span></a>`).join('')}
  </div></div>`).join('');
}

// ---------------- Settings ----------------
function setSeg(id,attr,val){$(id).querySelectorAll(`[data-${attr}]`).forEach(b=>b.setAttribute('aria-checked',b.dataset[attr]===String(val)));}
function applySettings(){
  const st=S.settings,root=document.documentElement;
  if(st.mode==='light'||st.mode==='dark')root.dataset.theme=st.mode;else delete root.dataset.theme;
  if(st.accent&&st.accent!=='saltire')root.dataset.accent=st.accent;else delete root.dataset.accent;
  setSeg('goal-seg','goal',st.goal||10);setSeg('mode-seg','mode',st.mode||'system');setSeg('accent-seg','accent',st.accent||'saltire');
  $('student-name').value=st.name||'';
  $('greeting').textContent=st.name?`Hi ${st.name} — let's get some practice in.`:'';
  const meta=document.querySelector('meta[name="theme-color"]');
  meta.content=getComputedStyle(root).getPropertyValue('--bg').trim()||'#0065bd';
  updateHeader();
}
$('student-name').addEventListener('input',e=>{S.settings.name=e.target.value.trim();save();$('greeting').textContent=S.settings.name?`Hi ${S.settings.name} — let's get some practice in.`:'';});
$('goal-seg').addEventListener('click',e=>{const b=e.target.closest('[data-goal]');if(!b)return;S.settings.goal=+b.dataset.goal;save();applySettings();});
$('mode-seg').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;S.settings.mode=b.dataset.mode;save();applySettings();});
$('accent-seg').addEventListener('click',e=>{const b=e.target.closest('[data-accent]');if(!b)return;S.settings.accent=b.dataset.accent;save();applySettings();});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applySettings);

// ---------------- PWA ----------------
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;
  let dismissed=false;try{dismissed=localStorage.getItem('nat5_install_dismissed')==='1';}catch(_){}
  if(!dismissed)setTimeout(()=>{$('install-banner').hidden=false;},30000);
});
$('install-btn').addEventListener('click',()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();deferredPrompt.userChoice.finally(()=>{deferredPrompt=null;$('install-banner').hidden=true;});
});
$('dismiss-install').addEventListener('click',()=>{$('install-banner').hidden=true;try{localStorage.setItem('nat5_install_dismissed','1');}catch(_){}});

// ---------------- Init ----------------
fillTopicSelect($('topic-select'));
fillTopicSelect($('timer-topic'),{smart:false});
buildCalc();renderWS();renderShop();loadFC();
rollDay();applySettings();save();
newQuestion();
route();
