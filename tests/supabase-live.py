import getpass,json,urllib.request,urllib.error,uuid
cfg=json.loads(getpass.getpass('Live test configuration (hidden): '))
url='https://amtjrfkwbwsihhjzhorv.supabase.co/functions/v1/campus-portal'
checks=0

def call(body,cookie='',extra=None,raw=False):
    headers={'User-Agent':'Mozilla/5.0','Content-Type':'application/json','x-campus-gateway':cfg['gateway'],'Cookie':cookie}
    headers.update(extra or {})
    try:
        r=urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(body).encode(),headers=headers),timeout=45)
        data=r.read()
        return r.status, (data if raw else json.loads(data)),r.headers.get('Set-Cookie','').split(';')[0]
    except urllib.error.HTTPError as e:
        return e.code,json.loads(e.read()),''

def ok(test,label):
    global checks
    if not test: raise AssertionError(label)
    checks+=1
    print("PASS",checks,label.split(":")[0],flush=True)

status,d,_=call({'action':'provision-student','login':'1DI24DS002','name':'Darshan','password':cfg['password']},extra={'x-campus-provision':'yes'})
ok(status==200 or 'already exists' in str(d),'Existing student migration: '+str(d))
status,d,cookie=call({'action':'login','role':'student','login':'1DI24DS002','password':cfg['password']})
ok(status==200 and d['user']['role']=='student','Supabase Auth login: '+str(d))
ok(call({'action':'login','role':'admin','login':'1DI24DS002','password':cfg['password']})[0]==401,'Role mismatch')
ok(call({'action':'me'},cookie)[1]['user']['login']=='1DI24DS002','Session persists')
ok(call({'action':'logout'},cookie)[0]==200,'Logout')
ok(call({'action':'list'},cookie)[0]==401,'Session revoked')
student='campus_session='+cfg['student'];staff='campus_session='+cfg['staff'];admin='campus_session='+cfg['admin'];other='campus_session='+cfg['other']
status,d,_=call({'action':'create','title':'[integration] private repair','description':'A test fixture','category':'Other','location':'Test','visibility':'private'},student)
ok(status==200,'Create private: '+str(d)); private=d['id']
ok(call({'action':'detail','id':private},staff)[0]==403,'Staff private denial')
ok(call({'action':'detail','id':private},other)[0]==403,'Other student private denial')
ok(all(c['id']!=private for c in call({'action':'list'},staff)[1]['complaints']),'Private excluded from list')
status,d,_=call({'action':'create','title':'[integration] campus repair','description':'A test fixture','category':'Other','location':'Test','visibility':'campus'},student)
ok(status==200,'Create campus'); campus=d['id']
status,d,_=call({'action':'detail','id':campus},staff)
ok(status==200,'Staff campus view');ok('QA_STUDENT' not in json.dumps(d) and 'QA Student' not in json.dumps(d),'Identity excluded')
ok(call({'action':'identity','id':campus,'reason':'Test'},staff)[0]==403,'Identity admin-only')
ok(call({'action':'update','id':campus,'operation':'resolve','message':'Done'},staff)[0]!=200,'Staff cannot resolve')
ok(call({'action':'update','id':campus,'operation':'comment','message':'Reply'},staff)[0]==403,'Staff read-only')
ok(call({'action':'identity','id':campus,'reason':'Integration validation'},admin)[1]['reporter']['login']=='QA_STUDENT','Admin identity')
ok(any(a['action'].startswith('identity-access') for a in call({'action':'audits'},admin)[1]['audits']),'Identity audited')
for op,c in [('start',admin),('ask',admin),('comment',student),('resolve',admin),('reopen',student),('resolve',admin),('confirm',student)]:
    status,d,_=call({'action':'update','id':private,'operation':op,'message':'Integration update'},c)
    ok(status==200,'Workflow '+op+': '+str(d))
status,d,_=call({'action':'detail','id':private},student)
ok(d['complaint']['status']=='Closed','Student confirms closure');ok(len(d['events'])==8,'History retained')
ok(call({'action':'list'})[0]==401,'Anonymous access rejected')
# File upload and download stay behind the same complaint permissions.
boundary='campus'+uuid.uuid4().hex
pdf=b'%PDF-1.4\nIntegration evidence\n%%EOF'
body=(f'--{boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n{private}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="evidence.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+pdf+f'\r\n--{boundary}--\r\n'.encode())
headers={'User-Agent':'Mozilla/5.0','x-campus-gateway':cfg['gateway'],'Cookie':student,'Content-Type':'multipart/form-data; boundary='+boundary}
r=urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers),timeout=45)
ok(r.status==200,'Private Storage upload')
attachment=call({'action':'detail','id':private},student)[1]['attachments'][0]['id']
status,d,_=call({'action':'download','id':private,'attachment':attachment},student,raw=True);ok(status==200 and d==pdf,'Private Storage download')
ok(call({'action':'download','id':private,'attachment':attachment},staff)[0]==403,'Private Storage access denied')
print(json.dumps({'assertions_passed':checks,'private_fixture':private,'campus_fixture':campus}))
