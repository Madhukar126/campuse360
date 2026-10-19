const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
export function auditDay(value){const date=new Date(value);return Number.isFinite(date.getTime())?dayFormatter.format(date):null;}
export function eventGroup(action){const name=String(action||'').split(':')[0];if(name==='login-failed')return 'Failed sign-ins';if(name==='identity-access')return 'Identity access';if(/account-activated|password-|issue-recovery|reissue-activation|student-provisioned/.test(name))return 'Account changes';return 'Other events';}
export function auditLabel(action){const type=String(action||'').split(':')[0];return ({'login-failed':'Sign-in unsuccessful','identity-access':'Reporter identity viewed','account-activated':'Account activated','password-changed':'Password changed','password-reset-started':'Password recovery started','issue-recovery':'Recovery code issued','reissue-activation':'Invitation replaced','student-provisioned':'Student account provisioned'})[type]||type.replaceAll('-',' ')||'Audit event';}
export function auditSeries(events,days=14,group='All events',now=Date.now()){
 const today=auditDay(now),anchor=Date.parse(today+'T12:00:00Z');
 const series=Array.from({length:days},(_,i)=>{const key=new Date(anchor-(days-1-i)*86400000).toISOString().slice(0,10);return {day:key,label:new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(key+'T12:00:00Z')),count:0};});
 const byDay=new Map(series.map(item=>[item.day,item]));
 for(const event of events){const bucket=byDay.get(auditDay(event.created));if(bucket&&(group==='All events'||eventGroup(event.action)===group))bucket.count++;}
 return series;
}
export function auditRange(events,series){const keys=new Set(series.map(item=>item.day));return events.filter(e=>keys.has(auditDay(e.created)));}
