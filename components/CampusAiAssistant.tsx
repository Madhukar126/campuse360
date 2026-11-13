'use client';
import {useState} from 'react';
import type {FormEvent} from 'react';

type CampusRole='student'|'staff'|'admin';
type Source={id:string;title:string;file_name:string;chunk_index:number;score:number;department?:string|null};
type Message={role:'user'|'assistant';content:string;sources?:Source[]};
const names:Record<CampusRole,string>={student:'Student Assistant',staff:'Staff Assistant',admin:'Admin Copilot'};

export function CampusAiAssistant({role}:{role:CampusRole}){
 const [messages,setMessages]=useState<Message[]>([{role:'assistant',content:`Hello! I am the CAMPUS360 ${names[role]}. Ask about approved campus procedures and information.`}]);
 const [question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(event:FormEvent){
  event.preventDefault();const q=question.trim();if(!q||busy)return;
  setMessages(m=>[...m,{role:'user',content:q}]);setQuestion('');setBusy(true);setError('');
  try{const r=await fetch('/api/ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});const d=await r.json();if(!r.ok)throw new Error(d.error||'AI request failed');setMessages(m=>[...m,{role:'assistant',content:d.answer,sources:d.sources||[]}]);}
  catch(e){setError(e instanceof Error?e.message:'AI request failed');}finally{setBusy(false);}
 }
 return <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label={names[role]}>
  <header className="border-b border-slate-100 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">CAMPUS360 AI</p><h2 className="text-lg font-semibold text-slate-900">{names[role]}</h2><p className="text-sm text-slate-500">Answers are grounded in approved campus documents.</p></header>
  <div className="max-h-[520px] space-y-4 overflow-y-auto p-5" aria-live="polite">{messages.map((m,i)=><div key={i} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm ${m.role==='user'?'ml-auto bg-blue-600 text-white':'bg-slate-100 text-slate-800'}`}><p className="whitespace-pre-wrap">{m.content}</p>{!!m.sources?.length&&<div className="mt-3 border-t border-slate-300/60 pt-2 text-xs"><strong>Sources</strong>{m.sources.map((s,j)=><p key={s.id+'-'+s.chunk_index}>[S{j+1}] {s.title} · {s.file_name} · section {s.chunk_index+1}</p>)}</div>}</div>)}{busy&&<p className="text-sm text-slate-500">Searching approved campus knowledge…</p>}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}</div>
  <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-4"><label className="sr-only" htmlFor="campus360-ai-question">Ask CAMPUS360 AI</label><input id="campus360-ai-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={4000} placeholder="Ask about campus procedures…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"/><button disabled={busy||!question.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Send</button></form>
 </section>;
}

export function CampusAiKnowledgeUpload(){
 const [visibility,setVisibility]=useState<'public'|'staff'|'admin'>('public'),[department,setDepartment]=useState(''),[file,setFile]=useState<File|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 async function upload(event:FormEvent){event.preventDefault();if(!file||busy)return;const f=new FormData();f.set('file',file);f.set('visibility',visibility);f.set('department',department);setBusy(true);setStatus('');try{const r=await fetch('/api/ai/documents',{method:'POST',credentials:'same-origin',body:f});const d=await r.json();if(!r.ok)throw new Error(d.error||'Upload failed');setStatus(`Indexed ${d.chunks_created} chunks. Document ID: ${d.document_id}`);setFile(null);}catch(e){setStatus(e instanceof Error?e.message:'Upload failed');}finally{setBusy(false);}}
 return <form onSubmit={upload} className="mt-5 w-full max-w-3xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Knowledge base · Admin only</h3><input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={e=>setFile(e.target.files?.[0]||null)}/><div className="flex flex-wrap gap-2"><select value={visibility} onChange={e=>setVisibility(e.target.value as typeof visibility)} className="rounded-lg border px-3 py-2 text-sm"><option value="public">All roles</option><option value="staff">Staff and Admin</option><option value="admin">Admin only</option></select><input value={department} onChange={e=>setDepartment(e.target.value)} maxLength={100} placeholder="Department (optional)" className="rounded-lg border px-3 py-2 text-sm"/></div><button disabled={!file||busy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Indexing…':'Upload and index'}</button>{status&&<p role="status" className="text-sm text-slate-600">{status}</p>}</form>;
}
