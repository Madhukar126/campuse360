import {spawnSync} from 'node:child_process';
const tests=['tests/invitations.mjs','tests/issue-refresh.mjs','tests/admin-analytics.mjs','tests/audit-analytics.mjs','tests/campus-intelligence.mjs','tests/intelligence-evaluation.mjs','tests/report-assistance.mjs','tests/student-privacy-edge.mjs'];
for(const test of tests){const result=spawnSync(process.execPath,[test],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
