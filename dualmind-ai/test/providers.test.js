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

test('Gemini free-tier request uses server-side API key, conversation roles, and SSE', () => {
 const ms=[{role:'user',text:'Hello',attachments:[{name:'x.png',type:'image/png',base64:'YWJj'}]},{role:'assistant',text:'Hi'},{role:'user',text:'Continue'}];
 const p={provider:'gemini',model:'gemini-3.5-flash-lite',messages:ms,webSearch:false};
 assert.equal(validateRequest(p),true);
 const call=providerRequest(p,{GEMINI_API_KEY:'fixture'});
 assert.match(call.url,/gemini-3\.5-flash-lite:streamGenerateContent\?alt=sse$/);
 assert.equal(call.headers['x-goog-api-key'],'fixture');
 assert.equal(call.body.contents[1].role,'model');
 assert.equal(call.body.contents[0].parts[1].inlineData.mimeType,'image/png');
 assert.equal(call.body.systemInstruction.parts[0].text.length>0,true);
});
test('Groq free-tier uses valid prefixed model, no browser credentials and textual SSE', () => {
 const p={provider:'groq',model:'openai/gpt-oss-20b',messages:[{role:'user',text:'Hi'}],webSearch:false};
 assert.equal(validateRequest(p),true);
 const call=providerRequest(p,{GROQ_API_KEY:'fixture'});
 assert.equal(call.url,'https://api.groq.com/openai/v1/chat/completions');
 assert.equal(call.headers.Authorization,'Bearer fixture');
 assert.equal(call.body.stream,true);
 assert.equal(call.body.messages[1].content,'Hi');
 assert.deepEqual(extractEvent('groq',{choices:[{delta:{content:'Hello'}}]}),{delta:'Hello'});
});
test('Gemini streaming emits text but does not leak thought parts', () => {
 const response={candidates:[{content:{parts:[{text:'internal',thought:true},{text:'answer'}]}}]};
 assert.deepEqual(extractEvent('gemini',response),{delta:'answer'});
});
test('Free-tier integration rejects unsupported expensive tools and attachments', () => {
 const p={provider:'groq',model:'openai/gpt-oss-20b',messages:[{role:'user',text:'Hi',attachments:[{name:'x.pdf',type:'application/pdf',base64:'YWJj'}]}]};
 assert.throws(()=>providerRequest(p,{GROQ_API_KEY:'key'}),/do not support file attachments/);
 assert.throws(()=>providerRequest({provider:'gemini',model:'gemini-3.5-flash-lite',messages:[{role:'user',text:'Hi'}],webSearch:true},{GEMINI_API_KEY:'key'}),/Disable web search/);
});
