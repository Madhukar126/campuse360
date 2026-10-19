export function canRead(role:string, own:boolean, visibility:string){return role==='admin'||own||visibility==='campus';}
export function nextStatus(role:string,own:boolean,current:string,action:string){
 if(role==='admin'){
  if(action==='start'&&['Submitted','Reopened','Awaiting information'].includes(current))return 'In progress';
  if(action==='ask'&&['Submitted','In progress','Reopened'].includes(current))return 'Awaiting information';
  if(action==='resolve'&&['Submitted','In progress','Reopened','Awaiting information'].includes(current))return 'Resolved';
 }
 if(role==='student'&&own&&current==='Resolved'){
  if(action==='confirm')return 'Closed'; if(action==='reopen')return 'Reopened';
 }
 throw new Error('This status change is not permitted.');
}
export function publicUser(u:any){return {name:u.name,role:u.role,login:u.login};}
