"""Read-only login/privacy smoke tests through the public Sites proxy using stock curl.

Credentials enter through hidden stdin and are never put in argv or printed.
No User-Agent override, Cloudflare bypass, account creation or password changes.
"""
import getpass,json,subprocess,tempfile
cfg=json.loads(getpass.getpass('Privacy verification configuration (hidden): '))
base=cfg['url'];passed=0
with tempfile.TemporaryDirectory(prefix='c360-privacy-') as tmp:
 jar=tmp+'/cookies'
 def call(body):
  r=subprocess.run(['curl','--silent','--show-error','--max-time','45','--cookie',jar,'--cookie-jar',jar,'--header','Content-Type: application/json','--header','Origin: '+base,'--data-binary','@-','--write-out','\n%{http_code}',base+'/api/portal'],input=json.dumps(body),capture_output=True,text=True,timeout=50)
  if r.returncode:raise RuntimeError('API transport failed; no retry attempted')
  payload,status=r.stdout.rsplit('\n',1)
  try:data=json.loads(payload)
  except ValueError:raise RuntimeError('Hosting returned non-JSON HTTP '+status+'; stopped without bypass or retry')
  return int(status),data
 def check(value,label):
  global passed
  if not value:raise AssertionError(label)
  passed+=1;print('PASS',label,flush=True)
 status,data=call({'action':'login','role':'student','login':cfg['login'],'password':cfg['password']})
 check(status==200 and data.get('user',{}).get('login')==cfg['login'],'Student password login')
 try:
  status,data=call({'action':'me'});check(status==200 and data['user']['login']==cfg['login'],'Session restores decrypted profile')
  status,data=call({'action':'list'});check(status==200 and data['viewer']['login']==cfg['login'],'Feed loads with decrypted own profile')
  issue='06563462-7d9c-4575-bac8-91b13bc3e87b'
  status,data=call({'action':'detail','id':issue});check(status==200 and 'reporter' not in data,'Campus issue remains readable without reporter fields')
  status,data=call({'action':'identity','id':issue,'reason':'Synthetic student access check'});check(status in [400,403] and 'reporter' not in data,'Student reporter reveal denied')
  status,data=call({'action':'accounts'});check(status==403,'Student account directory denied')
 finally:
  status,data=call({'action':'logout'});check(status==200,'Logout')
 status,data=call({'action':'list'});check(status==401,'Logged-out issue access denied')
print(json.dumps({'checks_passed':passed}),flush=True)
