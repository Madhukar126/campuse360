import assert from 'node:assert/strict';
import {auditDay,eventGroup,auditLabel,auditSeries,auditRange} from '../lib/audit-analytics.mjs';
const now=Date.parse('2026-10-19T18:45:00Z');
assert.equal(auditDay(now),'2026-10-20');assert.equal(auditDay('invalid'),null);
const events=[{created:'2026-10-19T18:35:00Z',action:'login-failed',target:'PRIVATE_USN'},{created:'2026-10-18T10:00:00Z',action:'identity-access: reason',target:'private'},{created:'2026-10-17T10:00:00Z',action:'account-activated'},{created:'2025-01-01T00:00:00Z',action:'login-failed'}];
const series=auditSeries(events,7,'All events',now);assert.equal(series.length,7);assert.equal(series.at(-1).day,'2026-10-20');assert.equal(series.reduce((s,d)=>s+d.count,0),3);assert.equal(auditRange(events,series).length,3);assert.equal(auditSeries(events,7,'Failed sign-ins',now).reduce((s,d)=>s+d.count,0),1);assert.equal(auditSeries([],14,'All events',now).reduce((s,d)=>s+d.count,0),0);assert.equal(eventGroup('password-changed'),'Account changes');assert.equal(eventGroup('unknown-event'),'Other events');assert.equal(auditLabel('identity-access: private reason'),'Reporter identity viewed');assert.ok(!JSON.stringify(series).includes('PRIVATE_USN'));
assert.equal(auditSeries([],7,'All events',Date.parse('2026-11-01T12:00:00Z'))[0].day,'2026-10-26');
console.log('Audit analytics: India dates, month boundaries, group/range filters, zero counts and identity-free chart data passed.');
