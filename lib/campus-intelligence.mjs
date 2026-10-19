import {trainingExamples} from './campus-training.mjs';
const stop=new Set('a an the is are was were be been to for of in on at and or with this that it my your our please since from can cannot not no needs need issue problem college campus'.split(' '));
const aliases={hostal:'hostel',hostle:'hostel',dorm:'hostel',dorms:'hostel',dormitory:'hostel',dormitories:'hostel',faucet:'tap',faucets:'tap',restroom:'washroom',restrooms:'washroom',bathroom:'washroom',bathrooms:'washroom',online:'internet',wireless:'wifi',wiifi:'wifi',wifii:'wifi',pc:'computer',pcs:'computer',gymnasium:'gym',elevator:'lift',elevators:'lift',grades:'marks',grade:'marks',grading:'marks',meals:'food',meal:'food',unhygienic:'hygiene',hygienic:'hygiene',coach:'bus',coaches:'bus',taps:'tap',fans:'fan',lights:'light',boys:'boy',girls:'girl',exams:'exam',sports:'sport',desks:'desk',windows:'window',chairs:'chair',timings:'timing'};
export function tokens(text){return String(text||'').normalize('NFKC').toLowerCase().replace(/wi[ -]+fi/g,'wifi').match(/[a-z0-9]+/g)?.map(t=>aliases[t]||t).filter(t=>t.length>1&&!stop.has(t)).slice(0,1500)||[];}
export const intelligenceVersion='2';
let model;
function fittedModel(){if(model)return model;const vocabulary=new Set(),classes=[];for(const [category,examples] of Object.entries(trainingExamples)){const counts=new Map();let total=0;for(const text of examples)for(const token of tokens(text)){vocabulary.add(token);counts.set(token,(counts.get(token)||0)+1);total++;}classes.push({category,counts,total});}return model={vocabulary,classes};}
export function classifyIssue(text){
 const {vocabulary,classes}=fittedModel(),all=tokens(text),hasHostel=all.includes('hostel');
 const words=[...new Set(all.filter(t=>vocabulary.has(t)&&(hasHostel||!['boy','girl','male','female'].includes(t))))];
 const empty={category:'Other',alternatives:[],uncertain:true,evidence:[],note:'Not enough familiar category information. Choose a category manually.',method:'Local multinomial Naive Bayes v2'};
 if(!words.length)return empty;
 const ranked=classes.map(c=>({category:c.category,score:words.reduce((n,t)=>{const spread=classes.filter(x=>x.counts.has(t)).length,weight=1+Math.log((classes.length+1)/(spread+1));return n+weight*Math.log(((c.counts.get(t)||0)+1)/(c.total+vocabulary.size));},0)})).sort((a,b)=>b.score-a.score);
 let category=ranked[0].category,contextRule=false;
 if(hasHostel){const boys=all.some(t=>['boy','male'].includes(t)),girls=all.some(t=>['girl','female'].includes(t));if(boys!==girls){category=boys?'Boys’ hostel':'Girls’ hostel';contextRule=true;}}
 const target=classes.find(c=>c.category===category);
 const evidence=words.filter(t=>target.counts.has(t)).sort((a,b)=>classes.filter(c=>c.counts.has(a)).length-classes.filter(c=>c.counts.has(b)).length).slice(0,5);
 const distinctive=evidence.filter(t=>classes.filter(c=>c.counts.has(t)).length<=3);
 const uncertain=!contextRule&&(ranked[0].score-ranked[1].score<0.65||!distinctive.length);
 return {category:uncertain?'Other':category,alternatives:(uncertain?ranked:ranked.filter(r=>r.category!==category)).slice(0,2).map(r=>r.category),uncertain,evidence,note:uncertain?'Several categories may fit. Choose the best match yourself.':contextRule?'Specific hostel context determines the suggestion.':'Suggestion based on matching terms in our fictional training examples.',method:'Local multinomial Naive Bayes v2'};
}
export function similarCampusIssues(text,issues){
 // A private issue is never a matching candidate, even when it is present in the viewer's feed.
 const candidates=issues.filter(i=>i.visibility==='campus'&&!['Resolved','Closed'].includes(i.status));
 const query=tokens(text),querySet=new Set(query);if(querySet.size<2)return [];
 const docs=candidates.map(i=>tokens(`${i.title} ${i.description} ${i.location}`));
 const frequencies=new Map();for(const doc of docs)for(const t of new Set(doc))frequencies.set(t,(frequencies.get(t)||0)+1);
 function vector(words){const v=new Map();for(const t of words)v.set(t,(v.get(t)||0)+1);for(const [t,n]of v)v.set(t,(1+Math.log(n))*(1+Math.log((docs.length+1)/((frequencies.get(t)||0)+1))));return v;}
 const q=vector(query),length=v=>Math.sqrt([...v.values()].reduce((s,n)=>s+n*n,0)),qLen=length(q);
 return candidates.map((issue,i)=>{const words=docs[i],shared=[...new Set(words)].filter(t=>querySet.has(t));if(shared.length<2)return null;const d=vector(words),score=[...q].reduce((s,[t,n])=>s+n*(d.get(t)||0),0)/(qLen*length(d)||1);return score>=0.18?{id:issue.id,title:issue.title,category:issue.category,status:issue.status,shared:shared.slice(0,5),score}:null;}).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,3);
}
export function queueBrief(issues,today){
 const active=issues.filter(i=>!['Resolved','Closed'].includes(i.status)),overdue=active.filter(i=>i.deadline&&i.deadline<today),counts=new Map();for(const issue of active)counts.set(issue.category,(counts.get(issue.category)||0)+1);
 const categories=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([category,count])=>({category,count}));
 return {total:issues.length,active:active.length,overdue:overdue.length,reopened:issues.filter(i=>i.status==='Reopened').length,categories};
}
export function extractSummary(text,maxSentences=3){
 const limit=Math.max(1,Math.min(5,Math.floor(maxSentences)||3));
 const sentences=String(text).slice(0,15000).split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
 const unique=sentences.filter((s,i)=>sentences.findIndex(t=>t.toLowerCase()===s.toLowerCase())===i);
 if(unique.length<=limit)return unique;
 const frequencies=new Map();for(const token of tokens(text))frequencies.set(token,(frequencies.get(token)||0)+1);
 const ranked=unique.slice(1).map((sentence,i)=>({sentence,index:i+1,words:new Set(tokens(sentence)),score:tokens(sentence).reduce((n,t)=>n+(frequencies.get(t)||0),0)/Math.max(1,Math.sqrt(tokens(sentence).length))}));
 const selected=[{sentence:unique[0],index:0,words:new Set(tokens(unique[0]))}];
 while(selected.length<limit&&ranked.length){ranked.sort((a,b)=>{const score=x=>{const redundancy=Math.max(...selected.map(y=>[...x.words].filter(t=>y.words.has(t)).length/Math.max(1,new Set([...x.words,...y.words]).size)));return x.score*(1-0.6*redundancy);};return score(b)-score(a)||a.index-b.index;});selected.push(ranked.shift());}
 return selected.sort((a,b)=>a.index-b.index).map(s=>s.sentence);
}
export function draftingQuestions(category,text){
 const questions=[];
 if(!/\b(?:today|yesterday|since|days?|weeks?|months?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2})\b/i.test(text))questions.push('When did the issue start, and how often does it happen?');
 if(!/\b(?:block|room|floor|building|ground|library|hostel|gate|court|lab|canteen|route|stop)\b/i.test(text))questions.push('Which building, room or campus area is affected?');
 const categoryQuestions={'Water & sanitation':'Is it a supply, cleanliness, leakage or equipment problem?', 'IT & connectivity':'Which connection or device is affected, and what error appears?',Infrastructure:'Which equipment or part of the building needs attention?',Academics:'Which course or academic process needs clarification?',Hostel:'Which shared hostel facility is affected?', 'Boys’ hostel':'Which hostel block and shared facility are affected?', 'Girls’ hostel':'Which hostel block and shared facility are affected?', 'Sports & recreation':'Which court, ground or sports equipment is affected?', Transport:'Which bus route or pickup stop is affected?'};
 if(categoryQuestions[category])questions.push(categoryQuestions[category]);
 return questions.slice(0,3);
}
