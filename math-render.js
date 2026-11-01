'use strict';
/*
  Renderer for the existing question-bank notation (not a TeX editor).
  A limit and its argument are typeset as ONE unbreakable mathematical unit.
  Plain-language content remains plain text and is never interpreted as HTML.
*/
window.QuizMath = (() => {
  const isWord = ch => /[\p{L}\p{N}_₀-₉⁰-⁹⁻]/u.test(ch || '');
  const aliases = [
    ['ημ', '\\sin'], ['συν','\\cos'], ['εφ','\\tan'], ['σφ','\\cot'], ['ln','\\ln']
  ];
  const greek = {
    'α':'\\alpha','β':'\\beta','γ':'\\gamma','δ':'\\delta','ε':'\\varepsilon',
    'ζ':'\\zeta','η':'\\eta','θ':'\\theta','κ':'\\kappa','λ':'\\lambda',
    'μ':'\\mu','ν':'\\nu','ξ':'\\xi','π':'\\pi','ρ':'\\rho',
    'σ':'\\sigma','τ':'\\tau','φ':'\\varphi','χ':'\\chi','ψ':'\\psi','ω':'\\omega',
    'Γ':'\\Gamma','Δ':'\\Delta','Θ':'\\Theta','Λ':'\\Lambda','Π':'\\Pi',
    'Σ':'\\Sigma','Φ':'\\Phi','Ω':'\\Omega',
    'ℝ':'\\mathbb{R}','ℕ':'\\mathbb{N}','ℤ':'\\mathbb{Z}',
    '∞':'\\infty','→':'\\to','⇒':'\\Rightarrow','⇔':'\\Leftrightarrow',
    '≤':'\\leq','≥':'\\geq','≠':'\\ne','∈':'\\in',
    '∉':'\\notin','∩':'\\cap','∪':'\\cup','∅':'\\emptyset',
    '⋅':'\\cdot','±':'\\pm','∓':'\\mp','∖':'\\setminus',
    '−':'-',
    'ℓ':'\\ell',
  };
  const sub={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
  const sup={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+'};

  function balanced(s, at) {
    const open=s[at], close={'(':')','[':']','{':'}'}[open];
    if(!close) return at;
    const stack=[];
    for(let i=at;i<s.length;i++) {
      const c=s[i];
      if('([{'.includes(c)) stack.push(c);
      else if(')]}'.includes(c)) {if(stack.pop()!=={')':'(',']':'[','}':'{'}[c])return at;if(!stack.length)return i+1;}
    }
    return at;
  }
  function operandEnd(s,start) {
    let i=start;
    while(s[i]===' ')i++;
    if(i>=s.length)return start;
    // A whole parenthesized operand and a possible following quotient.
    if('([{'.includes(s[i])) {let j=balanced(s,i);if(j===i)return start;i=j;}
    else if(s[i]==='|' && s.indexOf('|',i+1)>i){i=s.indexOf('|',i+1)+1;}
    else {
      for(;i<s.length;i++){
        const c=s[i];
        if('([{'.includes(c)){const j=balanced(s,i);if(j===i)break;i=j-1;continue;}
        if(c===' ' || /[,;.!?=<>≠≤≥⇔⇒]/u.test(c))break;
      }
      if(i===start)return start;
      // Trigonometric and logarithmic functions can have a separated argument.
      const prefix=s.slice(start,i).trim();
      if(/^(ημ|συν|εφ|σφ|ln)$/.test(prefix)){
        const tail=operandEnd(s,i);
        if(tail>i)i=tail;
      }
    }
    // absorb a possible / denominator, e.g. lim (...) f(x)/g(x)
    if(s[i]==='/' && s[i+1] && s[i+1]!==' '){
      let k=i+1;
      for(;k<s.length;k++){
        const c=s[k];
        if('([{'.includes(c)){const end=balanced(s,k);if(end===k)break;k=end-1;continue;}
        if(c===' ' || /[,;.!?=<>≠≤≥⇔⇒]/u.test(c))break;
      }
      i=k;
    }
    return i;
  }
  function slashAt(expr){
    const stack=[];
    for(let i=0;i<expr.length;i++){
      const c=expr[i];
      if('([{'.includes(c))stack.push(c);
      else if(')]}'.includes(c))stack.pop();
      else if(c==='/' && !stack.length)return i;
    }
    return -1;
  }
  function convert(expr) {
    let t=expr.trim();
    if(t.startsWith('(') && balanced(t,0)===t.length)
      return '\\left('+convert(t.slice(1,-1))+'\\right)';
    const slash=slashAt(t);
    if(slash>0 && slash<t.length-1){
      return '\\frac{'+convert(t.slice(0,slash))+'}{'+convert(t.slice(slash+1))+'}';
    }
    let out='';
    for(let i=0;i<t.length;){
      const a=aliases.find(([s])=>t.startsWith(s,i) && !/\p{L}/u.test(t[i+s.length]||''));
      if(a){out+=a[1]+' ';i+=a[0].length;continue;}
      if(t[i]==='√'){
        let j=i+1,index='';
        if(t[j]==='['){const end=balanced(t,j);if(end>j){index=convert(t.slice(j+1,end-1));j=end;}}
        if(t[j]==='('){const end=balanced(t,j);if(end>j){out+='\\sqrt'+(index?'['+index+']':'')+'{'+convert(t.slice(j+1,end-1))+'}';i=end;continue;}}
        const m=t.slice(j).match(/^[\p{L}\p{N}₀-₉]+/u);
        if(m){out+='\\sqrt'+(index?'['+index+']':'')+'{'+convert(m[0])+'}';i=j+m[0].length;continue;}
      }
      if((t[i]==='ℕ'||t[i]==='ℝ'||t[i]==='ℤ') && t[i+1]==='*'){out+=greek[t[i]]+'^{*}';i+=2;continue;}
      if(t[i]==='^') {
        let j=i+1,body='';
        if(t[j]==='('){const end=balanced(t,j);if(end>j){body=t.slice(j+1,end-1);j=end;}}
        else {while(j<t.length && /[\p{L}\p{N}₀-₉]/u.test(t[j]))j++;body=t.slice(i+1,j);}
        if(body){out+='^{'+convert(body)+'}';i=j;continue;}
      }
      if(sub[t[i]]){let j=i, digits='';while(sub[t[j]])digits+=sub[t[j++]];out+='_{'+digits+'}';i=j;continue;}
      if(sup[t[i]]){let j=i, digits='';while(sup[t[j]])digits+=sup[t[j++]];out+='^{'+digits+'}';i=j;continue;}
      if(greek[t[i]]){out+=greek[t[i]]+' ';i++;continue;}
      out+=t[i++];
    }
    return out;
  }
  // Read a complete mathematical equality, including its right-hand side.
  // Previously only lim + its immediate operand were rendered, leaving =+∞
  // and similar expressions as plain text with incompatible typography.
  function readLimit(text,start){
    const m=/^lim_\(([^()]*)\)/u.exec(text.slice(start));
    if(!m)return null;
    const argEnd=start+m[0].length;
    const opEnd=operandEnd(text,argEnd);
    const operand=text.slice(argEnd,opEnd).trim();
    return {end:opEnd,tex:'\\lim\\limits_{'+convert(m[1])+'}'+(operand?'\\,'+convert(operand):'')};
  }
  function readChain(text,start){
    const first=readLimit(text,start);
    if(!first)return null;
    let {end,tex}=first;
    for(let tries=0;tries<12;tries++){
      const space=/^\s*/u.exec(text.slice(end))[0];
      const at=end+space.length;
      const rel=/^(?:⇔|⇒|=|≠|≤|≥|<|>)/u.exec(text.slice(at));
      if(!rel)break;
      const after=at+rel[0].length;
      const spaces=/^\s*/u.exec(text.slice(after))[0];
      const rightAt=after+spaces.length;
      // The next argument may itself be a second limit.
      const next=readLimit(text,rightAt);
      const newEnd=next?next.end:operandEnd(text,rightAt);
      if(newEnd<=rightAt)break;
      const rhs=next?next.tex:convert(text.slice(rightAt,newEnd));
      tex+='\\,'+convert(rel[0])+'\\,'+rhs;
      end=newEnd;
    }
    return {start,end,tex};
  }
  function findFragments(text){
    const fragments=[];
    const pattern=/lim_\(([^()]*)\)/gu;
    let match;
    while((match=pattern.exec(text))){
      const frag=readChain(text,match.index);
      if(!frag)continue;
      fragments.push(frag);
      pattern.lastIndex=Math.max(frag.end,pattern.lastIndex);
    }
    return fragments;
  }
  function appendMixedText(text,nodes) {
    // Compact powers, roots and graph symbols outside limits. This is strictly
    // presentation logic; it never changes the stored statement or answer.
    const pattern=/[\p{L}₀-₉]+(?:\([^()]*\))?\s*[∈∉]\s*[ℝℕℤ]\*?|√(?:\[[^\]]+\])?\([^()]*\)|\bC_\([^()]*\)|\bC_[fg]\b|[A-Za-zα-ω](?:\([^()]*\))?\^\([^()]*\)|[A-Za-zα-ω](?:\([^()]*\))?\^[\p{L}\p{N}]+|\b\d+\/[A-Za-zα-ω](?:\([^()]*\))?/gu;
    let pos=0,match;
    while((match=pattern.exec(text))!==null){
      if(match.index>pos)nodes.push(document.createTextNode(text.slice(pos,match.index)));
      let t=match[0];
      if(t.startsWith('C_(')) t='C_{'+t.slice(3,-1)+'}';
      else if(t.startsWith('C_'))t='C_{'+t.slice(2)+'}';
      const atom=document.createElement('span');atom.className='math-atom';
      atom.textContent='\\('+convert(t)+'\\)';nodes.push(atom);
      pos=pattern.lastIndex;
    }
    if(pos<text.length)nodes.push(document.createTextNode(text.slice(pos)));
  }
  function set(element,input){
    const txt=String(input??''); const fragments=findFragments(txt); const nodes=[];
    let pos=0;
    for(const {start,end,tex} of fragments){
      if(start>pos)appendMixedText(txt.slice(pos,start),nodes);
      const atom=document.createElement('span');atom.className='math-atom';
      // Text nodes, not HTML; safe with question-bank contents.
      atom.textContent='\\('+tex+'\\)';nodes.push(atom);pos=end;
    }
    if(pos<txt.length)appendMixedText(txt.slice(pos),nodes);
    element.replaceChildren(...nodes);
    typeset(element);
  }
  let queue=Promise.resolve(),scheduled=false,waiting=new Set();
  function typeset(root){
    waiting.add(root);
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      const roots=[...waiting];waiting=new Set();
      const mathjax=window.MathJax;
      if(!mathjax?.typesetPromise){
        if(mathjax?.startup?.promise)mathjax.startup.promise.then(()=>roots.forEach(typeset));
        return;
      }
      queue=queue.then(()=>mathjax.typesetPromise(roots))
        .catch(e=>console.error('Στοιχειοθεσία τύπων:',e));
    });
  }
  return {set,typeset,convert,findFragments};
})();
