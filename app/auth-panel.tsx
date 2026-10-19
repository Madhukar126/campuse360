'use client';
import {useEffect,useState} from 'react';
import CampusBanner from './campus-banner';
import {readInvitation} from '../lib/invitations.mjs';
import {GraduationCap,ShieldCheck,Clock,CheckCircle2,LockKeyhole,ArrowUpRight} from 'lucide-react';
type Props={api:(data:any)=>Promise<any>,setup:boolean,role:string,mode:string,setRole:(r:string)=>void,setMode:(m:string)=>void,onLogin:(user:any)=>void,onSetup:()=>void};
export default function AuthPanel({api,setup,role,mode,setRole,setMode,onLogin,onSetup}:Props){
 const [busy,B]=useState(false),[error,E]=useState(''),[message,M]=useState('');
 const [invitation,Invitation]=useState<any>(null);
 useEffect(()=>{const data=readInvitation(window.location.hash);if(data){Invitation(data);setRole(data.role||'student');setMode('activate');window.history.replaceState(null,'',window.location.pathname+window.location.search);}},[]);
 const creating=mode!=='login';
 function switchMode(m:string){setMode(m);E('');M('');}
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget,body=Object.fromEntries(new FormData(form));B(true);E('');M('');
  try{
   if(creating&&body.password!==body.confirmPassword)throw new Error('Passwords do not match.');
   if(mode==='setup'){await api({action:'bootstrap',...body});onSetup();setRole('admin');setMode('login');M('Administrator created. Sign in to continue.');}
   else if(mode==='activate'){await api({action:'activate',role,...body});Invitation(null);setMode('login');M('Account activated. Sign in with your new password.');}
   else if(mode==='reset'){await api({action:'reset-password',...body});setMode('login');M('Password changed. Your old sessions have been signed out. Sign in again.');}
   else{await api({action:'login',role,...body});const d=await api({action:'me'});if(!d.user)throw new Error('Your browser did not retain the login session. Please allow cookies for this site and sign in again.');onLogin(d.user);}
   form.reset();
  }catch(e:any){E(e.message)}finally{B(false)}
 }
 return <div className="auth"><section className="auth-story"><CampusBanner login/><div className="brand"><span><GraduationCap size={25}/></span><strong>CAMPUS<span>360</span></strong></div><div><span className="eyebrow light">A BETTER CAMPUS STARTS WITH YOU</span><h1>Your voice.<br/>Real change.</h1><p>A clear path from raising a concern to seeing it resolved. Together, we make campus better.</p><div className="story-points"><span><ShieldCheck/> Protected identity</span><span><Clock/> Transparent progress</span><span><CheckCircle2/> Admin-led action</span></div></div><small>Aditya College of Engineering and Technology · CAMPUS360</small></section><section className="auth-form"><div className="auth-box"><span className="eyebrow">WELCOME TO CAMPUS360</span><h2>{mode==='setup'?'Set up your administration':mode==='activate'?'Activate your account':mode==='reset'?'Reset your password':'Good to see you.'}</h2><p className="muted">{mode==='setup'?'Create the first college administrator account.':mode==='activate'?'Use your college-issued activation code within seven days.':mode==='reset'?'Contact your college administrator to verify your identity and receive a recovery code. It expires after 30 minutes.':'Sign in to your college community.'}</p><div className="role-tabs">{['student','staff','admin'].map(r=><button disabled={busy} key={r} className={r===role?'selected':''} onClick={()=>{setRole(r);switchMode('login')}}>{r[0].toUpperCase()+r.slice(1)}</button>)}</div>{error&&<div className="error" role="alert">{error}</div>}{message&&<div className="notice" role="status">{message}</div>}<form key={mode+role} onSubmit={submit}>
 {mode==='setup'&&<label>Your name<input name="name" required maxLength={100} autoComplete="name"/></label>}
 <label>{role==='student'?'USN':role==='staff'?'Employee ID or college email':'Admin email'}<input name="login" defaultValue={invitation?.login||''} required maxLength={150} placeholder={role==='student'?'Enter your USN':'Enter your login ID'} autoComplete="username"/></label>
 {(mode==='activate'||mode==='reset')&&<label>{mode==='reset'?'Recovery code':'College activation code'}<input name="code" defaultValue={mode==='activate'?invitation?.code||'':''} required maxLength={128} autoComplete="one-time-code" spellCheck={false}/></label>}
 <label>{creating?'New password':'Password'}<input name="password" type="password" required minLength={creating?12:1} maxLength={128} placeholder={creating?'12–128 characters':'Enter your password'} autoComplete={creating?'new-password':'current-password'}/></label>
 {creating&&<label>Confirm new password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>}
 <button className="primary wide" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='setup'?'Create administrator':mode==='reset'?'Reset password':'Activate account'} <ArrowUpRight size={18}/></button></form>
 <div className="auth-links">{role==='admin'&&!setup&&<a className="text-btn" href="/signin-with-chatgpt?return_to=%2F%3Fadmin-setup%3D1" target="_top">First administrator? Verify site owner</a>}{role!=='admin'&&<><button disabled={busy} onClick={()=>switchMode(mode==='activate'?'login':'activate')}>{mode==='activate'?'Already activated? Sign in':'First time here? Activate account'}</button><button disabled={busy} onClick={()=>switchMode(mode==='reset'?'login':'reset')}>{mode==='reset'?'Back to sign in':'Forgot password?'}</button></>}{role==='admin'&&<button onClick={()=>M('For a lost administrator password, contact the Supabase project owner. A student or staff recovery code cannot reset an administrator account.')}>Need help signing in?</button>}{setup&&<button disabled={busy} onClick={()=>{setRole('admin');switchMode('setup')}}>Set up first administrator</button>}</div><div className="privacy-note"><LockKeyhole size={19}/><span>Your identity is hidden from students and staff. Only authorized admins can access it.</span></div><footer>CAMPUS360 v1.0</footer></div></section></div>;
}
