const categories=[['Water & sanitation',/water|tap|purifier|toilet|washroom|drinking/i],['IT & connectivity',/wifi|wi-fi|internet|network|computer/i],['Infrastructure',/fan|light|chair|ceiling|door|building|broken/i],['Academics',/class|exam|lecture|syllabus|marks/i],['Hostel',/hostel|dorm/i],['Transport',/bus|transport/i]];
export function inspect(text){
 const findings=[];
 for(const [label,pattern] of [['USN',/\b\d[A-Z]{2}\d{2}[A-Z]{2}\d{3}\b/gi],['Email',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],['Phone number',/(?<!\d)(?:\+91[ -]?)?[6-9]\d{9}(?!\d)/g],['Possible name',/\b(?:my name is|i am|i'm)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/gi]]){
  for(const match of text.matchAll(pattern))findings.push({label,value:match[0]});
 }
 let redacted=text;for(const f of findings)redacted=redacted.split(f.value).join(`[${f.label} removed]`);
 const category=categories.find(([,pattern])=>pattern.test(text))?.[0]||'Other';
 return {findings,redacted,category};
}
export function suggest(text){
 const report=inspect(text),clean=report.redacted.trim();
 const known=[[/water.*(?:not coming|unavailable|no water)|no water/i,'Water supply interruption','Please investigate the water supply interruption and restore access.'],[/wifi|wi-fi|internet/i,'Campus connectivity problem','Please check the affected connection and restore reliable access.'],[/fan|light/i,'Classroom maintenance needed','Please inspect the affected equipment and arrange repairs.']].find(([p])=>p.test(clean));
 return {...report,title:known?.[1]||`${report.category}: concern for review`,description:`${clean.charAt(0).toUpperCase()+clean.slice(1)}${/[.!?]$/.test(clean)?'':'.'}\n\n${known?.[2]||'Please review this concern and provide an update on the next steps.'}`};
}
