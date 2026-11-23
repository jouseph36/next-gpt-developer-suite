import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const password=process.env.APP_PASSWORD||'';
if(process.env.NODE_ENV==='production' && password.length<20){console.error('APP_PASSWORD must have at least 20 characters in production');process.exit(1);}
const models={openai:[process.env.OPENAI_MODEL||'gpt-6.1-sol',process.env.OPENAI_SMALL_MODEL||'gpt-6-luna'],anthropic:[process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5',process.env.ANTHROPIC_SMALL_MODEL||'claude-haiku-5-5']};
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"};
function reply(res,code,data){res.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
function authorized(req){if(!password)return process.env.NODE_ENV!=='production';const value=(req.headers.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(value), b=Buffer.from(password);return a.length===b.length&&timingSafeEqual(a,b);}
async function body(req){const parts=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>350000){throw new Error('Request too large');}parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
function clean(messages){if(!Array.isArray(messages)||!messages.length||messages.length>24)throw new Error('Invalid conversation length');return messages.map(m=>{if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>20000)throw new Error('Invalid conversation content');return {role:m.role,content:m.content};});}
async function ask(which,model,messages){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),110000);
  try{
    if(which==='openai'){
      const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('OPENAI_API_KEY is not configured');
      const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,input:messages.map(m=>({role:m.role,content:m.content})),store:false}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'OpenAI API error '+response.status);
      return (data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||data.output_text||'[No text returned]';
    }
    if(which==='anthropic'){
      const key=process.env.ANTHROPIC_API_KEY;if(!key)throw new Error('ANTHROPIC_API_KEY is not configured');
      const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:4096,messages}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Anthropic API error '+response.status);
      return (data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n')||'[No text returned]';
    }
    throw new Error('Unknown provider');
  }finally{clearTimeout(timer);}
}
const visits=new Map();
function limit(req){const ip=(req.socket.remoteAddress||'unknown');const now=Date.now();const list=(visits.get(ip)||[]).filter(t=>now-t<60000);if(list.length>=12)return false;list.push(now);visits.set(ip,list);if(visits.size>3000)visits.clear();return true;}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost').pathname;
  if(url==='/api/health')return reply(res,200,{ok:true});
  if(url==='/api/config')return reply(res,200,{providers:{openai:!!process.env.OPENAI_API_KEY,anthropic:!!process.env.ANTHROPIC_API_KEY},models,secured:!!password});
  if(url==='/api/chat'&&req.method==='POST'){
    if(!authorized(req))return reply(res,401,{error:'Incorrect password'});
    if(!limit(req))return reply(res,429,{error:'Too many requests; try again later'});
    try{
      const input=await body(req);
      const messages=clean(input.messages);
      const provider=input.provider;
      if(!['openai','anthropic'].includes(provider)||!models[provider].includes(input.model))return reply(res,400,{error:'Invalid provider/model'});
      if(messages.at(-1).role!=='user')return reply(res,400,{error:'Last message must be from user'});
      const answer=await ask(provider,input.model,messages);return reply(res,200,{answer,provider,model:input.model});
    }catch(e){return reply(res,400,{error:String(e.message||e).slice(0,400)});}
  }
  const files={'/':['public','index.html','text/html; charset=utf-8'],'/app.js':['public','app.js','text/javascript; charset=utf-8'],'/style.css':['public','style.css','text/css; charset=utf-8']};
  if(files[url]&&req.method==='GET'){
    const [folder,file,mime]=files[url];
    try{const data=await readFile(path.join(ROOT,folder,file));res.writeHead(200,{...headers,'Content-Type':mime});return res.end(data);}
    catch{return reply(res,500,{error:'UI file missing'});}
  }
  return reply(res,404,{error:'Not found'});
});
server.listen(PORT,'0.0.0.0',()=>console.log('DualMind listening on '+PORT));
