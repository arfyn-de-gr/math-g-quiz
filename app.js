'use strict';
(() => {
  const FIELDS=['id','chapter','section','statement','answer','explanation','source','source_url','origin','status'];
  const $=id=>document.getElementById(id);
  const state={all:[],pool:[],deck:[],cursor:0,answers:{},mode:'study',finished:false};
  const studyTab=$('mode-study'),quizTab=$('mode-quiz'),panel=$('question-panel'),results=$('result-panel'),empty=$('empty-panel');
  const answerButtons=[...document.querySelectorAll('[data-answer]')];
  const normalized=s=>String(s??'').trim();
  const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

  function detectDelimiter(raw){
    const first=raw.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0];
    const count=d=>{let n=0,q=false;for(const ch of first){if(ch==='"')q=!q;else if(!q && ch===d)n++;}return n;};
    return count(';')>=count(',')?';':',';
  }
  function parseCSV(raw){
    const text=raw.replace(/^\uFEFF/,'');const delimiter=detectDelimiter(text);let data=[],row=[],value='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted && text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
      else if(c===delimiter && !quoted){row.push(value);value='';}
      else if((c==='\n'||c==='\r') && !quoted){if(c==='\r' && text[i+1]==='\n')i++;row.push(value);value='';if(row.some(v=>v.length))data.push(row);row=[];}
      else value+=c;
    }
    if(quoted)throw new Error('Υπάρχουν εισαγωγικά που δεν έχουν κλείσει στο αρχείο CSV.');
    if(value || row.length){row.push(value);if(row.some(v=>v.length))data.push(row);}
    if(data.length<2)throw new Error('Το CSV δεν περιλαμβάνει ερωτήσεις.');
    const head=data.shift().map(v=>v.trim().replace(/^\uFEFF/,''));
    for(const key of FIELDS)if(!head.includes(key))throw new Error('Λείπει η στήλη «'+key+'».');
    return data.map((cells,idx)=>{
      const entry=Object.fromEntries(FIELDS.map(k=>[k,normalized(cells[head.indexOf(k)])]));
      if(!entry.id || !entry.statement || !['Σ','Λ'].includes(entry.answer) || !entry.explanation || !entry.chapter || !entry.section)
        throw new Error('Ελλιπή δεδομένα ή μη έγκυρη απάντηση στη γραμμή '+(idx+2)+'.');
      return entry;
    });
  }
  function validate(rows){
    const ids=new Set();for(const q of rows){if(ids.has(q.id))throw new Error('Διπλός κωδικός ερώτησης «'+q.id+'».');ids.add(q.id);}
    return rows;
  }
  function published(q){return !['πρόχειρη','draft','ανενεργή','inactive'].includes(normalized(q.status).toLowerCase());}
  function setQuestions(rows){state.all=validate(rows);$('total-count').textContent=String(rows.filter(published).length);fillFilters();start();}
  function fillFilters(){
    const initial=$('chapter-select').value;
    const chapters=[...new Set(state.all.filter(published).map(q=>q.chapter))].sort();
    makeOptions($('chapter-select'),chapters,'Όλα τα κεφάλαια');
    if(chapters.includes(initial))$('chapter-select').value=initial;
    refreshSections();
  }
  function makeOptions(select,values,allLabel){select.replaceChildren(new Option(allLabel,'all'),...values.map(v=>new Option(v,v)));}
  function refreshSections(){
    const chapter=$('chapter-select').value,current=$('section-select').value;
    const secs=[...new Set(state.all.filter(q=>published(q)&&(chapter==='all'||q.chapter===chapter)).map(q=>q.section))].sort();
    makeOptions($('section-select'),secs,'Όλες οι παράγραφοι');
    if(secs.includes(current))$('section-select').value=current;
  }
  function getPool(){
    const chapter=$('chapter-select').value,section=$('section-select').value,term=$('search-input').value.toLocaleLowerCase('el').trim();
    return state.all.filter(q=>published(q)&&(chapter==='all'||q.chapter===chapter)&&(section==='all'||q.section===section)&&(!term||(q.statement+' '+q.explanation+' '+q.id).toLocaleLowerCase('el').includes(term)));
  }
  function start(){
    state.pool=getPool();state.answers={};state.cursor=0;state.finished=false;
    for (const opt of $('quiz-count').options) { if (opt.value !== 'all') opt.disabled = Number(opt.value) > state.pool.length; }
    if ($('quiz-count').selectedOptions[0]?.disabled) $('quiz-count').value='all';
    const count=$('quiz-count').value;
    state.deck=state.mode==='quiz'?shuffle(state.pool).slice(0,count==='all'?state.pool.length:Math.min(+count,state.pool.length)):[...state.pool];
    results.hidden=true;empty.hidden=state.deck.length!==0;panel.hidden=state.deck.length===0;
    if(state.deck.length)render();
  }
  function render(){
    if(state.finished)return;
    const q=state.deck[state.cursor],answer=state.answers[q.id],hasAnswer=answer!==undefined;
    $('statement').textContent=q.statement;
    $('current-section').textContent=q.section;
    $('question-index').textContent=`Ερώτηση ${state.cursor+1} από ${state.deck.length}`;
    $('question-origin').textContent=q.origin||'';
    const completed=Object.keys(state.answers).length;
    const percent=Math.round(100*completed/state.deck.length);
    $('progress-fill').style.width=percent+'%';$('progressbar').setAttribute('aria-valuenow',percent);
    for(const b of answerButtons){
      const val=b.dataset.answer;b.classList.remove('selected','correct','incorrect');
      b.disabled=state.mode==='study'&&hasAnswer;
      if(answer===val)b.classList.add('selected');
      if(state.mode==='study'&&hasAnswer){if(val===q.answer)b.classList.add('correct');else if(val===answer)b.classList.add('incorrect');}
      b.setAttribute('aria-pressed',String(answer===val));
    }
    if(state.mode==='study'&&hasAnswer){
      const good=answer===q.answer;const feedback=$('feedback');feedback.hidden=false;feedback.className='feedback '+(good?'good':'bad');
      $('feedback-symbol').textContent=good?'✓':'×';
      $('feedback-title').textContent=good?'Σωστή απάντηση':`Η σωστή απάντηση είναι «${q.answer==='Σ'?'Σωστό':'Λάθος'}»`;
      $('feedback-body').textContent=q.explanation;
      $('source-label').textContent=q.source||'Σχολικό βιβλίο';
      const link=$('source-link');link.hidden=!safeUrl(q.source_url);if(!link.hidden)link.href=q.source_url;
    }else $('feedback').hidden=true;
    $('next-btn').disabled=state.mode==='study'&&!hasAnswer;
    $('next-btn').innerHTML=state.cursor===state.deck.length-1?'Ολοκλήρωση <span aria-hidden="true">✓</span>':'Επόμενη ερώτηση <span aria-hidden="true">→</span>';
    if(state.mode==='quiz')$('next-btn').disabled=false;
  }
  function safeUrl(url){try{return ['https:','http:'].includes(new URL(url).protocol)}catch{return false}}
  function answer(value){
    const q=state.deck[state.cursor];if(!q)return;
    if(state.mode==='study'&&state.answers[q.id]!==undefined)return;
    state.answers[q.id]=value;render();
  }
  function next(){
    if(state.cursor+1<state.deck.length){state.cursor++;render();}
    else finish();
  }
  function finish(){
    state.finished=true;panel.hidden=true;results.hidden=false;empty.hidden=true;
    const total=state.deck.length,correct=state.deck.filter(q=>state.answers[q.id]===q.answer).length;
    const unanswered=state.deck.filter(q=>state.answers[q.id]===undefined).length;
    $('result-title').textContent=state.mode==='quiz'?'Αποτελέσματα αυτοαξιολόγησης':'Ολοκλήρωσες τη μελέτη';
    $('result-score').textContent=correct+' / '+total;
    $('result-description').textContent=state.mode==='quiz'?
      `Σωστές απαντήσεις ${correct} στις ${total}. ${unanswered?'Δεν απαντήθηκαν '+unanswered+' ερωτήσεις.':''}`:
      `Απάντησες σωστά σε ${correct} από τις ${total} ερωτήσεις.`;
    const review=$('mistake-review');review.replaceChildren();
    const items=state.deck.filter(q=>state.mode==='quiz'||state.answers[q.id]!==q.answer);
    if(items.length){
      const title=document.createElement('h3');title.className='review-title';title.textContent=state.mode==='quiz'?'Αιτιολογήσεις για όλες τις ερωτήσεις':'Ερωτήσεις που χρειάζονται επανάληψη';review.append(title);
      items.forEach((q,i)=>{
        const card=document.createElement('article');card.className='review-card';
        const h=document.createElement('h3');h.textContent=(i+1)+'. '+q.statement;
        const correctText=document.createElement('p');correctText.className='review-answer';
        const userAnswer=state.answers[q.id];
        correctText.textContent=`Απάντησή σου: ${userAnswer?(userAnswer==='Σ'?'Σωστό':'Λάθος'):'Δεν απαντήθηκε'}. Σωστός χαρακτηρισμός: ${q.answer==='Σ'?'Σωστό':'Λάθος'}.`;
        const explan=document.createElement('p');explan.textContent=q.explanation;
        card.append(h,correctText,explan);
        if(safeUrl(q.source_url)){const a=document.createElement('a');a.href=q.source_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=q.source||'Σχολικό βιβλίο';card.append(a);}
        review.append(card);
      });
    }
    results.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function csvEscape(s){const t=String(s??'');return '"'+t.replace(/"/g,'""')+'"';}
  function makeCSV(rows){return '\uFEFF'+FIELDS.map(csvEscape).join(';')+'\r\n'+rows.map(q=>FIELDS.map(k=>csvEscape(q[k])).join(';')).join('\r\n')+'\r\n';}
  function download(data,filename,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function events(){
    answerButtons.forEach(b=>b.addEventListener('click',()=>answer(b.dataset.answer)));
    $('next-btn').addEventListener('click',next);
    $('restart-btn').addEventListener('click',start);$('retry-btn').addEventListener('click',()=>{start();$('question-section').scrollIntoView({block:'start'});});
    studyTab.addEventListener('click',()=>setMode('study'));quizTab.addEventListener('click',()=>setMode('quiz'));
    $('chapter-select').addEventListener('change',()=>{refreshSections();start()});
    $('section-select').addEventListener('change',start);
    $('search-input').addEventListener('input',start);
    $('quiz-count').addEventListener('change',start);
    $('teacher-open').addEventListener('click',()=>$('teacher-dialog').showModal());
    $('teacher-close').addEventListener('click',()=>$('teacher-dialog').close());
    $('teacher-dialog').addEventListener('click',e=>{if(e.target===$('teacher-dialog'))$('teacher-dialog').close();});
    $('csv-file').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{const rows=validate(parseCSV(await file.text()));setQuestions(rows);$('import-status').className='import-status';$('import-status').textContent=`Φορτώθηκαν ${rows.length} ερωτήσεις για τοπική δοκιμή. Οι αλλαγές δεν έχουν δημοσιευθεί.`;}
      catch(err){$('import-status').className='import-status error';$('import-status').textContent='Σφάλμα. '+err.message;}
    });
    $('download-csv').addEventListener('click',()=>download(makeCSV(state.all),'questions.csv','text/csv;charset=utf-8'));
  }
  function setMode(mode){state.mode=mode;studyTab.classList.toggle('active',mode==='study');quizTab.classList.toggle('active',mode==='quiz');studyTab.setAttribute('aria-selected',String(mode==='study'));quizTab.setAttribute('aria-selected',String(mode==='quiz'));$('quiz-count-wrap').hidden=mode!=='quiz';start();}
  async function init(){
    events();
    try{
      const res=await fetch('./questions.csv?updated='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('Δεν διαβάστηκε το CSV.');
      setQuestions(parseCSV(await res.text()));
    }catch(err){
      if(Array.isArray(window.QUIZ_FALLBACK)&&window.QUIZ_FALLBACK.length)setQuestions(window.QUIZ_FALLBACK);
      else {panel.hidden=true;empty.hidden=false;$('empty-panel').querySelector('h2').textContent='Αδυναμία φόρτωσης ερωτήσεων.';}
    }
  }
  init();
})();
