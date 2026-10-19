import assert from 'node:assert/strict';
import {invitationLink,readInvitation,parseRosterCSV} from '../lib/invitations.mjs';
for(const role of ['student','staff']){
 const invitation={login:'TEST +&/001',code:'private&code=123',role};
 const url=new URL(invitationLink('https://campus360.studentvoice.workers.dev',invitation));
 assert.equal(url.search,'');assert.equal(url.pathname,'/');assert.deepEqual(readInvitation(url.hash),invitation);
}
assert.equal(readInvitation('#invite=1&role=admin&login=X&code=Y'),null);
assert.equal(readInvitation('#invite=1&role=student&login=X'),null);
assert.deepEqual(parseRosterCSV('\uFEFFlogin,name,role\r\n1di24ds003,"Rao, Ananya",student\r\nEMP001,Staff Member,staff'),[{login:'1DI24DS003',name:'Rao, Ananya',role:'student'},{login:'EMP001',name:'Staff Member',role:'staff'}]);
assert.equal(parseRosterCSV('USN,name,role\nABC,Student')[0].role,'student');
assert.throws(()=>parseRosterCSV('ABC,Name,admin'));
assert.throws(()=>parseRosterCSV('abc,First,student\nABC,Second,student'));
assert.throws(()=>parseRosterCSV('A,"Unclosed'));
assert.throws(()=>parseRosterCSV(''));
assert.throws(()=>parseRosterCSV(Array.from({length:101},(_,i)=>`${i},Name,student`).join('\n')));
console.log('Invitation links and CSV validation passed.');
