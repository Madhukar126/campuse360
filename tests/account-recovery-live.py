"""Run against the hosted API with hidden stdin configuration, never log secrets.
Creates three clearly labelled test accounts; disable them after the run.
"""
import copy, getpass, http.cookiejar, json, secrets, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

cfg=json.loads(getpass.getpass('Recovery test configuration (hidden): '))
base=cfg['url'].rstrip('/')
prefix=cfg['prefix']
checks=0
def client():
    jar=http.cookiejar.CookieJar()
    return jar,urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(opener,body):
    req=urllib.request.Request(base+'/api/portal',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':base,'User-Agent':'CAMPUS360 account validation'})
    try:
        with opener.open(req,timeout=45) as r: return r.status,json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read())
def ok(condition,label):
    global checks
    if not condition: raise AssertionError(label)
    checks+=1
    print('PASS',checks,label,flush=True)
def success(opener,body,label):
    status,d=call(opener,body)
    ok(status==200,label)
    return d
jar,admin=client()
success(admin,{'action':'login','role':'admin','login':cfg['admin'],'password':cfg['password']},'Administrator login')
ok(success(admin,{'action':'me'},'Administrator session persists')['user']['role']=='admin','Administrator role')
_,anon=client()
ok(call(anon,{'action':'accounts'})[0]==401,'Anonymous account export denied')
password='Validation!'+secrets.token_hex(12)
newpassword='Reset!'+secrets.token_hex(14)
newerpassword='Change!'+secrets.token_hex(14)
rows=[{'login':prefix+s,'name':'Validation only '+s,'role':r} for s,r in [('STUDENT','student'),('OTHER','student'),('STAFF','staff')]]
codes=success(admin,{'action':'roster','rows':rows},'Import test roster')['codes']
code_map={c['login']:c['code'] for c in codes}
ok(len(codes)==3,'Three distinct activation codes')
student_id,other_id,staff_id=[r['login'] for r in rows]
activation=lambda login,role,code:{'action':'activate','login':login,'role':role,'code':code,'password':password,'confirmPassword':password}
ok(call(anon,activation(student_id,'staff',code_map[student_id]))[0]==400,'Wrong activation role denied without consuming code')
ok(call(anon,activation(student_id,'student','invalid'))[0]==400,'Invalid activation code denied')
with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda _:call(client()[1],activation(student_id,'student',code_map[student_id])),range(2)))
ok(sorted(r[0] for r in results)==[200,400],'Concurrent activation succeeds exactly once')
success(anon,activation(other_id,'student',code_map[other_id]),'Second student activation')
success(anon,activation(staff_id,'staff',code_map[staff_id]),'Staff activation')
student_jar,student=client();_,other=client();_,staff=client()
for opener,login,role in [(student,student_id,'student'),(other,other_id,'student'),(staff,staff_id,'staff')]:
    success(opener,{'action':'login','role':role,'login':login,'password':password},role+' login')
ok(call(student,{'action':'accounts'})[0]==403,'Student cannot list identities')
ok(call(staff,{'action':'accounts'})[0]==403,'Staff cannot list identities')
issue=success(student,{'action':'create','title':'[VALIDATION ONLY] Account workflow','description':'Private validation fixture, no real campus problem.','category':'Other','location':'Validation','visibility':'private'},'Private issue submission')['id']
ok(call(other,{'action':'detail','id':issue})[0]==403,'Another student cannot view private issue')
ok(call(staff,{'action':'detail','id':issue})[0]==403,'Staff cannot view private issue')
ok(call(staff,{'action':'update','id':issue,'operation':'resolve','message':'Validation'})[0]==403,'Staff cannot resolve private issue')
for op,who in [('start',admin),('resolve',admin),('reopen',student),('resolve',admin),('confirm',student)]:
    success(who,{'action':'update','id':issue,'operation':op,'message':'Validation only'},'Issue workflow '+op)
ok(success(student,{'action':'detail','id':issue},'Read final issue')['complaint']['status']=='Closed','Student confirms issue closure')
reason='College ID checked for validation fixture'
request={'action':'issue-recovery','login':student_id,'reason':reason,'currentPassword':cfg['password']}
ok(call(staff,request)[0]==403,'Staff cannot issue recovery codes')
ok(call(student,request)[0]==403,'Student cannot issue recovery codes')
ok(call(admin,{**request,'currentPassword':'invalid'})[0]==400,'Admin step-up password required')
ok(call(admin,{**request,'login':cfg['admin']})[0]==400,'Student recovery cannot reset admin')
oldcode=success(admin,request,'Issue first recovery code')['code']
code=success(admin,request,'Replacement code issued')['code']
reset=lambda c:{'action':'reset-password','login':student_id,'code':c,'password':newpassword,'confirmPassword':newpassword}
ok(call(anon,reset(oldcode))[0]==400,'Superseded recovery code denied')
ok(call(anon,{**reset(code),'confirmPassword':'mismatch'})[0]==400,'Password confirmation required')
ok(call(anon,reset('invalid'))[0]==400,'Invalid recovery code denied')
stale_jar,stale=client()
for cookie in student_jar: stale_jar.set_cookie(copy.copy(cookie))
with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda _:call(client()[1],reset(code)),range(2)))
ok(sorted(r[0] for r in results)==[200,400],'Concurrent recovery succeeds exactly once')
ok(call(stale,{'action':'list'})[0]==401,'All pre-reset portal sessions revoked')
ok(call(anon,reset(code))[0]==400,'Recovery code reuse denied')
ok(call(anon,{'action':'login','login':student_id,'role':'student','password':password})[0]==401,'Old password rejected')
success(student,{'action':'login','login':student_id,'role':'student','password':newpassword},'New password login')
ok(call(student,{'action':'change-password','currentPassword':'wrong','password':newerpassword,'confirmPassword':newerpassword})[0]==400,'Own password change requires current password')
success(student,{'action':'change-password','currentPassword':newpassword,'password':newerpassword,'confirmPassword':newerpassword},'Own password change')
ok(call(student,{'action':'list'})[0]==401,'Password change signs out current device')
success(student,{'action':'login','login':student_id,'role':'student','password':newerpassword},'Changed password login')
shared=success(other,{'action':'detail','id':'06563462-7d9c-4575-bac8-91b13bc3e87b'},'Campus sample visible to another account')
ok('SAMPLE001' not in json.dumps(shared) and 'Sample Student One' not in json.dumps(shared),'Campus reporter identity absent')
ok(call(staff,{'action':'identity','id':'06563462-7d9c-4575-bac8-91b13bc3e87b','reason':reason})[0]==403,'Reporter identity admin-only')
ok(call(staff,{'action':'update','id':'06563462-7d9c-4575-bac8-91b13bc3e87b','operation':'resolve','message':'Validation only'})[0]!=200,'Staff cannot resolve campus issue')
accounts=success(admin,{'action':'accounts'},'Admin account directory')['accounts']
ok(all(set(a)=={'login','name','role','active'} for a in accounts),'Account list excludes secrets and codes')
success(admin,{'action':'logout'},'Admin logout')
ok(call(admin,{'action':'accounts'})[0]==401,'Logged-out session denied')
print(json.dumps({'assertions_passed':checks,'test_prefix':prefix,'private_closed_issue':issue}),flush=True)
