import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest,providerRequest,extractEvent,SSEParser} from '../providers.js';
const messages=[{role:'user',text:'مرحبا'}];
test('both providers format valid requests',()=>{
 for(const provider of ['openai','anthropic']){
  const model=provider==='openai'?'gpt-6.1-sol':'claude-sonnet-5';
  const p={provider,model,messages,webSearch:false};
  assert.equal(validateRequest(p),true);
  const c=providerRequest(p,{OPENAI_API_KEY:'test-openai',ANTHROPIC_API_KEY:'test-anthropic'});
  assert.equal(c.body.model,model);assert.equal(c.body.stream,true);
  assert.equal(c.body.messages?.[0]?.role==='user'||c.body.input?.[0]?.role==='user',true);
 }
});
test('image and PDF attachments are formatted correctly',()=>{
 const ms=[{role:'user',text:'summarize',attachments:[{name:'x.pdf',type:'application/pdf',base64:'YWJj'}]}];
 assert.equal(validateRequest({provider:'anthropic',model:'claude-sonnet-5',messages:ms}),true);
 assert.equal(providerRequest({provider:'anthropic',model:'claude-sonnet-5',messages:ms},{ANTHROPIC_API_KEY:'key'}).body.messages[0].content[1].type,'document');
 assert.equal(providerRequest({provider:'openai',model:'gpt-6.1-sol',messages:ms},{OPENAI_API_KEY:'key'}).body.input[0].content[1].type,'input_file');
});
test('SSE chunk splitter handles fragmented events',()=>{
 const events=[];const p=new SSEParser(x=>events.push(x));
 p.feed('event: delta\ndata: {"type":"response.output_');p.feed('text.delta","delta":"hello"}\n\n');
 assert.equal(events.length,1);assert.deepEqual(extractEvent('openai',events[0]),{delta:'hello'});
});
test('malformed requests are rejected',()=>{
 assert.throws(()=>validateRequest({provider:'bad',model:'a',messages}),/Invalid provider/);
});
test('prior assistant replies are sent as conversation history in Responses', () => {
 const history = [{role:'user',text:'hello'}, {role:'assistant',text:'hi'}, {role:'user',text:'continue'}];
 const request = providerRequest({provider:'openai',model:'gpt-6.1-sol',messages:history},{OPENAI_API_KEY:'fixture'});
 assert.deepEqual(request.body.input[1], {role:'assistant',content:'hi'});
});
test('SSE delimiters can be split between carriage return and line feed', () => {
 const events = [];
 const parser = new SSEParser(event => events.push(event));
 for (const chunk of ['data: {"n":1}\r', '\n\r', '\ndata: {"n":2}\r\n\r', '\n']) parser.feed(chunk);
 parser.end();
 assert.deepEqual(events, [{n:1},{n:2}]);
});
