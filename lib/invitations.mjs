export function invitationLink(origin,{login,code,role='student'}){
 const url=new URL('/',origin);url.hash=new URLSearchParams({invite:'1',login,code,role}).toString();return url.href;
}
export function readInvitation(hash){
 const p=new URLSearchParams(hash.replace(/^#/,''));
 if(p.get('invite')!=='1'||!['student','staff'].includes(p.get('role'))||!p.get('login')||!p.get('code'))return null;
 return {login:p.get('login').slice(0,150),code:p.get('code').slice(0,128),role:p.get('role')};
}
export function parseRosterCSV(text){
 const records=[];let row=[],cell='',quoted=false;
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<=source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'&&source[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else if(c===undefined)throw new Error('CSV has an unclosed quoted field.');else cell+=c;}
  else if(c==='"'&&!cell)quoted=true;
  else if(c===','||c==='\n'||c===undefined){row.push(cell.trim());cell='';if(c!==','){if(row.some(Boolean))records.push(row);row=[];}}
  else if(c!=='\r')cell+=c;
 }
 if(records[0]&&['login','usn'].includes(records[0][0].toLowerCase()))records.shift();
 if(!records.length||records.length>100)throw new Error('Upload between 1 and 100 records.');
 const seen=new Set();
 return records.map((r,i)=>{const [login,name,rawRole='student']=r,role=rawRole.toLowerCase();if(r.length>3||!login||login.length>150||!name||name.length>100||!['student','staff'].includes(role))throw new Error(`Check CSV row ${i+1}: use USN or login, full name, student or staff.`);const key=login.toUpperCase();if(seen.has(key))throw new Error(`Duplicate login in CSV: ${login}`);seen.add(key);return {login:key,name,role};});
}
