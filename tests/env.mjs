import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_sour_hulk.sql','utf8'));
const statement=(text,values=[])=>({bind(...v){return statement(text,v)},async first(){return sql.prepare(text).get(...values)||null},async all(){return {results:sql.prepare(text).all(...values)}},async run(){return sql.prepare(text).run(...values)}});
const files=new Map();
export const env={OWNER_EMAIL:'owner@example.test',ACCOUNT_PROVISION_TOKEN:'test-provision-secret',DB:{prepare:statement,async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}},BUCKET:{async put(k,b){files.set(k,b)},async get(k){return files.has(k)?{body:files.get(k)}:null}}};
