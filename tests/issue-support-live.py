"""Hosted API checks. Hidden stdin config supplies the two existing sample passwords."""
import getpass,http.cookiejar,json,urllib.request,urllib.error
from concurrent.futures import ThreadPoolExecutor
cfg=json.loads(getpass.getpass('Support validation configuration (hidden): '))
base=cfg['url'];issue='06563462-7d9c-4575-bac8-91b13bc3e87b';checks=0
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(opener,body):
 req=urllib.request.Request(base+'/api/portal',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':base})
 try:
  with opener.open(req,timeout=45) as r:return r.status,json.loads(r.read())
 except urllib.error.HTTPError as e:
  try:data=json.loads(e.read())
  except (ValueError,TypeError):data={'error':'Non-JSON response from hosting or network'}
  return e.code,data
def ok(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS',checks,label,flush=True)
student=client();observer=client();anon=client()
status,data=call(student,{'action':'login','login':'SAMPLE002','role':'student','password':cfg['password2']})
ok(status==200,'Supporting student login: HTTP '+str(status)+' '+str(data.get('error','')))
ok(call(observer,{'action':'login','login':'SAMPLE001','role':'student','password':cfg['password1']})[0]==200,'Second account login')
status,before=call(student,{'action':'detail','id':issue});ok(status==200,'Read initial count')
initial=before['complaint']['support_count'];was_supported=before['complaint']['supported']
try:
 with ThreadPoolExecutor(max_workers=2) as pool:
  results=list(pool.map(lambda _:call(student,{'action':'support','id':issue,'supported':True,'user_id':'forged-user'}),range(2)))
 expected=initial+(0 if was_supported else 1)
 ok(all(s==200 and d['support_count']==expected and d['supported'] for s,d in results),'Concurrent duplicate support counted once')
 status,other=call(observer,{'action':'detail','id':issue});ok(status==200 and other['complaint']['support_count']==expected,'Other account receives updated count')
 ok('SAMPLE002' not in json.dumps(other) and 'Sample Student Two' not in json.dumps(other),'Supporter identity absent')
 ok(call(anon,{'action':'support','id':issue,'supported':True})[0]==401,'Anonymous support denied')
finally:
 status,restored=call(student,{'action':'support','id':issue,'supported':was_supported})
 ok(status==200 and restored['support_count']==initial,'Original support state restored')
for opener in [student,observer]:call(opener,{'action':'logout'})
print(json.dumps({'assertions_passed':checks}),flush=True)
