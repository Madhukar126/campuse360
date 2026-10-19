/** Forward only our host-only session cookie, never upstream provider cookies. */
export function portalSessionCookie(combined:string|null):string|null {
 if(!combined)return null;
 const cookies=combined.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
 const session=cookies.map(c=>c.trim()).find(c=>c.startsWith('campus_session='));
 if(!session)return null;
 // A provider's domain must never become the portal cookie's domain.
 return session.replace(/^campus_session=/,'__Host-campus360_session=').replace(/;\s*Domain=[^;]*/gi,'').replace(/;\s*SameSite=[^;]*/gi,'').replace(/;\s*Partitioned/gi,'')+'; SameSite=None; Partitioned';
}
