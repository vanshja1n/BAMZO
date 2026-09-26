(() => {
  const $ = s => document.querySelector(s);
  const promptEl = $('#aiPrompt');
  const button = $('#aiFind');
  const resultsEl = $('#aiResults');
  const statusEl = $('#aiStatus');
  if (!promptEl || !button || !resultsEl || !statusEl) return;

  let games = [];
  const endpoint = String(window.AI_GAME_FINDER_ENDPOINT || '').trim();
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = x => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}\s.+-]/gu,' ').replace(/\s+/g,' ').trim();

  function score(g, q){
    const name=norm(g.name),cat=norm(g.category),genre=norm(g.genre),about=norm(g.about),hay=`${name} ${cat} ${genre} ${about}`;
    let z=0;
    if(name===q)z+=120;
    if(name.includes(q)&&q.length>2)z+=55;
    for(const t of q.split(' ').filter(x=>x.length>1)){
      if(name.includes(t))z+=22;
      if(genre.includes(t))z+=14;
      if(cat.includes(t))z+=12;
      if(about.includes(t))z+=5;
    }
    if(/(2 player|two player|multiplayer|pvp|versus)/.test(q)&&/(multiplayer|2 player|two player|versus|pvp)/.test(hay))z+=30;
    if(/(race|racing|car|driv|moto|bike)/.test(q)&&/(driv|rac|car|moto|bike|vehicle)/.test(hay))z+=30;
    if(/(shoot|gun|fps|battle)/.test(q)&&/(shoot|gun|fps|battle|weapon)/.test(hay))z+=30;
    if(/(sport|football|soccer|basketball)/.test(q)&&/(sport|football|soccer|basketball)/.test(hay))z+=30;
    if(/(puzzle|logic|brain|strategy)/.test(q)&&/(puzzle|logic|brain|strategy)/.test(hay))z+=26;
    if(/(easy|casual|relax|simple)/.test(q)&&/(casual|idle|click|simple|easy)/.test(hay))z+=18;
    if(/(like slope|similar to slope|slope)/.test(q)&&/(slope|run|tunnel|parkour|platform|speed)/.test(hay))z+=24;
    return z;
  }

  function card(g, reason=''){
    return `<article class="game-card"><a href="games/${encodeURIComponent(g.slug)}.html"><div class="cover-wrap"><img class="cover" src="${esc(g.localThumb||g.link+g.thumb)}" alt="${esc(g.name)}" width="320" height="320" loading="lazy" decoding="async" fetchpriority="low" onerror="this.src='assets/logo.svg'"></div><div class="card-text"><strong>${esc(g.name)}</strong>${reason?`<span class="ai-reason">${esc(reason)}</span>`:`<span>${esc(g.genre||g.category||'Game')}</span>`}</div></a></article>`;
  }

  function localCandidates(raw, limit=30){
    const q=norm(raw);
    return games.map(g=>({g,sc:score(g,q)})).sort((a,b)=>b.sc-a.sc).slice(0,limit).map(x=>x.g);
  }

  function localFallback(raw){
    const q=norm(raw);
    const out=games.map(g=>({g,sc:score(g,q)})).filter(x=>x.sc>4).sort((a,b)=>b.sc-a.sc).slice(0,6);
    if(!out.length){
      statusEl.textContent='No strong match. Try a game name, racing, shooter, sports, multiplayer or puzzle.';
      resultsEl.hidden=true;
      return;
    }
    resultsEl.innerHTML=out.map(x=>card(x.g)).join('');
    resultsEl.hidden=false;
    statusEl.textContent=`Smart Finder picked ${out.length} games for “${promptEl.value.trim()}”.`;
  }

  async function run(){
    const raw=promptEl.value.trim();
    if(!raw){
      statusEl.textContent='Describe the kind of game you want first.';
      resultsEl.hidden=true;
      return;
    }
    if(!games.length){
      statusEl.textContent='Game catalog is still loading…';
      return;
    }

    if(!endpoint){
      localFallback(raw);
      return;
    }

    const candidates=localCandidates(raw,30).map(g=>({
      id:g.id,
      name:g.name,
      category:g.category,
      genre:g.genre,
      popularity:g.popularity,
      about:String(g.about||'').slice(0,420)
    }));

    button.disabled=true;
    button.textContent='Thinking…';
    statusEl.textContent='AI is choosing the best games…';

    try{
      const res=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prompt:raw,candidates})
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      const picks=Array.isArray(data.picks)?data.picks:[];
      const byId=new Map(games.map(g=>[String(g.id),g]));
      const chosen=picks.map(p=>({g:byId.get(String(p.id)),reason:String(p.reason||'')})).filter(x=>x.g).slice(0,6);
      if(!chosen.length) throw new Error('No valid AI picks');
      resultsEl.innerHTML=chosen.map(x=>card(x.g,x.reason)).join('');
      resultsEl.hidden=false;
      statusEl.textContent=`AI picked ${chosen.length} games for “${raw}”.`;
    }catch(err){
      console.warn('AI Game Finder fallback:',err);
      statusEl.textContent='AI service is unavailable right now — showing smart local matches instead.';
      localFallback(raw);
    }finally{
      button.disabled=false;
      button.textContent='Find games ✨';
    }
  }

  button.addEventListener('click',run);
  promptEl.addEventListener('keydown',e=>{if(e.key==='Enter')run()});
  document.querySelectorAll('[data-ai-example]').forEach(x=>x.addEventListener('click',()=>{promptEl.value=x.dataset.aiExample;run()}));
  fetch('data/games.json').then(x=>x.json()).then(d=>games=Array.isArray(d)?d:(d.games||[])).catch(()=>statusEl.textContent='AI Finder could not load the game catalog.');
})();
