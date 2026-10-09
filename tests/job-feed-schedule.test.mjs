import test from 'node:test';
import assert from 'node:assert/strict';
import { runJobFeeds } from '../worker/prospecting/jobFeeds.js';

function dbWithInterruptedSlot() {
  const writes=[];
  return {writes,prepare(sql){return {bind(...args){return {async run(){
    writes.push({sql,args});
    return {meta:{changes:sql.startsWith('INSERT OR IGNORE')?0:1}};
  }}}}}};
}

test('interrupted morning feed slot retries instead of staying silent',async()=>{
  const DB=dbWithInterruptedSlot();
  let fetched=0;
  const result=await runJobFeeds({DB},Date.parse('2026-10-09T12:15:00Z'),{
    fetcher:async()=>{fetched++;return [{url:'https://example.org/job',title:'Automation consultant'}]},
    ingest:async()=>({received:1,A:1,B:0,C:0,prepared:1,duplicates:0})
  });
  assert.equal(fetched,1);
  assert.equal(result.prepared,1);
  assert.ok(DB.writes.some(x=>x.sql.includes("value='running'")));
});

test('feed failure records error so the next slot can retry',async()=>{
  const DB=dbWithInterruptedSlot();
  const result=await runJobFeeds({DB},Date.parse('2026-10-09T12:15:00Z'),{
    fetcher:async()=>{throw Error('temporary_source_failure')},
    ingest:async()=>{throw Error('should_not_run')}
  });
  assert.equal(result.error,'temporary_source_failure');
  assert.ok(DB.writes.some(x=>x.args[0]==='error:temporary_source_failure'));
});
