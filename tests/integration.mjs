import assert from 'node:assert/strict';
import {POST} from './route-built.mjs';
let checks=0;
async function call(body,cookie='',owner=false){const r=await POST(new Request('https://campus.test/api/portal',{method:'POST',headers:{'content-type':'application/json',origin:'https://campus.test',cookie,...(owner?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}:{})},body:JSON.stringify(body)}));return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''}}
function ok(condition){assert.ok(condition);checks++}
ok((await call({action:'list'})).status===401);
ok((await call({action:'bootstrap',login:'ADMIN',name:'College Admin',password:'StrongPassword!42'})).status===400);
ok((await call({action:'bootstrap',login:'ADMIN',name:'College Admin',password:'StrongPassword!42'},'',true)).data.ok);
const admin=(await call({action:'login',login:'ADMIN',password:'StrongPassword!42',role:'admin'})).cookie;ok(admin.length>0);
ok((await call({action:'bootstrap',login:'OTHER',name:'Other',password:'StrongPassword!42'},'',true)).status===400);
const roster=await call({action:'roster',rows:[{login:'USN001',name:'Private Student',role:'student'},{login:'USN002',name:'Other Student',role:'student'},{login:'STAFF01',name:'Faculty',role:'staff'}]},admin);ok(roster.data.codes.length===3);
const cookies=[];
for(const [i,c] of roster.data.codes.entries()){ok((await call({action:'activate',login:c.login,code:'wrong',password:'StudentPassword!42'})).status===400);ok((await call({action:'activate',login:c.login,code:c.code,password:'StudentPassword!42'})).data.ok);cookies.push((await call({action:'login',login:c.login,password:'StudentPassword!42',role:i===2?'staff':'student'})).cookie)}
const [student,other,staff]=cookies;
ok((await call({action:'login',login:'USN001',password:'StudentPassword!42',role:'admin'})).status===401);
const privateIssue=await call({action:'create',title:'Private concern',description:'Sensitive content',category:'Other',location:'Block B',visibility:'private'},student);const id=privateIssue.data.id;ok(!!id);
ok(!(await call({action:'list'},staff)).data.complaints.some(c=>c.id===id));
ok((await call({action:'detail',id},staff)).status===403);ok((await call({action:'detail',id},other)).status===403);
const campus=await call({action:'create',title:'Broken bench',description:'Bench needs repair',category:'Infrastructure',location:'Room 204',visibility:'campus'},student);const cid=campus.data.id;
const publicDetail=await call({action:'detail',id:cid},staff);ok(publicDetail.status===200);ok(!JSON.stringify(publicDetail.data).includes('Private Student'));ok(!JSON.stringify(publicDetail.data).includes('USN001'));
ok((await call({action:'identity',id:cid,reason:'test'},staff)).status===403);
ok((await call({action:'update',id:cid,operation:'resolve',message:'Done'},staff)).status===400);
ok((await call({action:'update',id:cid,operation:'comment',message:'Staff comment'},staff)).status===403);
ok((await call({action:'identity',id,reason:'Investigating complaint'},admin)).data.reporter.login==='USN001');
ok((await call({action:'audits'},admin)).data.audits.some(a=>a.action.startsWith('identity-access')));
ok((await call({action:'update',id,operation:'start',message:'Investigating',priority:'High',deadline:'2026-10-20'},admin)).data.ok);
ok((await call({action:'update',id,operation:'resolve',message:'Repaired and checked'},admin)).data.ok);
ok((await call({action:'update',id,operation:'confirm',message:''},other)).status===403);
ok((await call({action:'update',id,operation:'reopen',message:'Problem remains'},student)).data.ok);
ok((await call({action:'update',id,operation:'resolve',message:'Repaired again'},admin)).data.ok);
ok((await call({action:'update',id,operation:'confirm'},student)).data.ok);
const final=await call({action:'detail',id},student);ok(final.data.complaint.status==='Closed');ok(final.data.events.length===6);
ok((await call({action:'activity'},student)).data.activity.length>=6);
ok((await call({action:'roster',rows:[{login:'BAD',name:'Bad',role:'admin'}]},admin)).status===400);
await call({action:'logout'},student);ok((await call({action:'list'},student)).status===401);
const cross=await POST(new Request('https://campus.test/api/portal',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{"action":"me"}'}));ok(cross.status===403);
const deniedProvision=await call({action:'provision-student',login:'TEST',name:'Test',password:'Password123!'});ok(deniedProvision.status===403);
const pr=await POST(new Request('https://campus.test/api/portal',{method:'POST',headers:{'content-type':'application/json',origin:'https://campus.test','x-provision-token':'test-provision-secret'},body:JSON.stringify({action:'provision-student',login:'TESTPROVISION',name:'Provisioned Student',password:'TestPassword42!'})}));ok(pr.status===200);ok((await call({action:'login',login:'TESTPROVISION',password:'TestPassword42!',role:'student'})).status===200);
console.log(`${checks} integration assertions passed: activation, authentication, privacy, permissions, admin resolution, reopen, confirmation, audit and CSRF.`);
