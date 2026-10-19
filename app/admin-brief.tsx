'use client';
import {useState} from 'react';
import {queueBrief,extractSummary} from '../lib/campus-intelligence.mjs';
import {inspect} from '../lib/report-assistance.mjs';
export default function AdminBrief({issues,description}:{issues?:any[],description?:string}){
 const [expanded,Expanded]=useState(false);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const brief=queueBrief(issues||[],today),sentences=description?extractSummary(inspect(description).redacted):[];
 return <section className="panel local-brief"><span className="eyebrow">BUILT-IN ASSISTANCE</span><h3>{description?'Quick issue summary':'Your administration brief'}</h3><p className="muted">{description?'Extracts sentences from this description. It does not infer facts or summarize attachments.':'Computed from the current issue feed. Counts cover all loaded issues, independent of chart filters.'} No external AI service.</p><button type="button" className="secondary" aria-expanded={expanded} onClick={()=>Expanded(!expanded)}>{expanded?'Hide brief':description?'Summarize description':'Show queue brief'}</button>{expanded&&(description?<div><ul>{sentences.map((sentence,i)=><li key={i}>{sentence}</li>)}</ul><p className="muted">Pattern redaction can miss identifying details. Read the full report before acting.</p></div>:<div><p><strong>{brief.active}</strong> active concerns from {brief.total} issues. <strong>{brief.overdue}</strong> overdue and <strong>{brief.reopened}</strong> reopened.</p>{brief.categories.length>0?<><h3>Largest active categories</h3><ul>{brief.categories.map(c=><li key={c.category}>{c.category}: {c.count} active</li>)}</ul></>:<p>No active concerns.</p>}<p className="muted">Admins choose priorities and resolutions. Counts alone do not establish severity.</p></div>)}</section>;
}
