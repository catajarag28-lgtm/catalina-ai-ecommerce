import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchN8nJobs } from '../worker/prospecting/n8nJobs.js';

test('public community feed keeps recent buyers and explicit email routes',async()=>{
  const now=Date.parse('2026-10-09T15:00:00Z');
  const fetcher=async url=>({ok:true,json:async()=>url.endsWith('/c/jobs/13.json')?
    {topic_list:{topics:[
      {id:1,slug:'buyer',title:'Buscamos freelancer n8n',created_at:'2026-10-08T12:00:00Z'},
      {id:2,slug:'seller',title:'[FOR HIRE] n8n builder',created_at:'2026-10-08T12:00:00Z'},
      {id:3,slug:'old',title:'Looking for n8n expert',created_at:'2026-08-01T12:00:00Z'}]}}:
    {post_stream:{posts:[{username:'buyer',cooked:'<p>Buscamos freelancer para automatización de WhatsApp y CRM. Candidaturas: team@example.com</p>'}]}}});
  const rows=await fetchN8nJobs({fetcher,now});
  assert.equal(rows.length,1);
  assert.equal(rows[0].applicationRoute,'email');
  assert.equal(rows[0].platform,'n8n community');
});
