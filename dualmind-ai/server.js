import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {validateRequest, providerRequest, extractEvent, SSEParser} from './providers.js';

const root=path.dirname(fileURLToPath(import.meta.url));
// Minimal .env loader for local development; production environment variables take precedence.
try {
  const raw=await readFile(path.join(root,'.env'),'utf8');
  for(const line of raw.split(/\r?\n/)){
    const s=line.trim();if(!s||s.startsWith('#'))continue;
    const index=s.indexOf('=');if(index<1)continue;
    const key=s.slice(0,index).trim();let value=s.slice(index+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    if(!process.env[key])process.env[key]=value;
  }
}catch{}
if(process.env.NODE_ENV==='production' && (process.env.APP_PASSWORD || '').length < 20) {
  console.error('APP_PASSWORD must contain at least 20 characters in production.');process.exit(1);
}

const models = {
  openai: [process.env.OPENAI_MODEL || 'gpt-6.1-sol', process.env.OPENAI_SMALL_MODEL || 'gpt-6-luna'],
  anthropic: [...new Set([
    process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    process.env.ANTHROPIC_SMALL_MODEL || 'claude-haiku-5-5',
    process.env.ANTHROPIC_LARGE_MODEL || 'claude-opus-5-5'
  ])],
  gemini: [...new Set([process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',process.env.GEMINI_SECOND_MODEL || 'gemini-3.8-flash'])],
  groq: [...new Set([process.env.GROQ_MODEL || 'openai/gpt-oss-20b',process.env.GROQ_SECOND_MODEL || 'openai/gpt-oss-120b'])]
};
const requestWindows = new Map();
const minute = 60000;
function allowChat(address) {
  const now = Date.now();
  const recent = (requestWindows.get(address) || []).filter(time => now - time < minute);
  if (recent.length >= 12) return false;
  recent.push(now);
  requestWindows.set(address, recent);
  return true;
}
setInterval(() => {
  const cutoff = Date.now() - minute;
  for (const [address, times] of requestWindows) {
    if (times.at(-1) <= cutoff) requestWindows.delete(address);
  }
}, minute).unref();
const secureHeaders={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'"
};
function send(res,status,obj){res.writeHead(status,{...secureHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function authorized(req){
  const expected=process.env.APP_PASSWORD;
  if(!expected)return true;
  const got=req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7):'';
  const a=Buffer.from(got), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function bodyJson(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>14*1024*1024){const e=new Error('Request exceeds 14 MiB');e.status=413;throw e;}chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{const e=new Error('Invalid JSON');e.status=400;throw e;}
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
async function staticFile(req,res,pathname){
  const allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
  if(!allowed[pathname])return send(res,404,{error:'Not found'});
  const file=path.join(root,'public',allowed[pathname]);
  const buf=await readFile(file);
  res.writeHead(200,{...secureHeaders,'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(buf);
}

export const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/health')return send(res,200,{ok:true});
  if(pathname==='/api/config' && req.method==='GET')return send(res,200,{requiresPassword:!!process.env.APP_PASSWORD,secured:!!process.env.APP_PASSWORD,providers:{openai:!!process.env.OPENAI_API_KEY,anthropic:!!process.env.ANTHROPIC_API_KEY,gemini:!!process.env.GEMINI_API_KEY,groq:!!process.env.GROQ_API_KEY},models});
  if(pathname==='/api/auth' && req.method==='POST')return send(res,authorized(req)?200:401,{ok:authorized(req)});
  if(pathname==='/api/chat' && req.method==='POST') {
    if(!authorized(req))return send(res,401,{error:'Incorrect app password'});
    if (!allowChat(req.socket.remoteAddress)) return send(res,429,{error:'Too many requests. Please try again in a minute.'});
    let payload;
    let legacy = false;
    try {
      payload = await bodyJson(req);
      // The original deployed client sends plain content and reads a single JSON answer.
      legacy = Array.isArray(payload?.messages) && payload.messages.length > 0 &&
        payload.messages.every(message => typeof message?.content === 'string' && message.text === undefined);
      if (legacy) payload.messages = payload.messages.map(({role, content}) => ({role, text: content}));
      validateRequest(payload);
    } catch(e) {return send(res,e.status||400,{error:e.message});}
    if(!models[payload.provider].includes(payload.model))return send(res,400,{error:'Model is not enabled in server configuration'});
    let call;try{call=providerRequest(payload);}catch(e){return send(res,400,{error:e.message});}
    const abort=new AbortController();let downstreamClosed=false;
    res.on('close',()=>{downstreamClosed=true;abort.abort();});
    const timer = setTimeout(() => abort.abort(), 110000);
    try {
      if (legacy) {
        if (payload.provider === 'gemini') call.url = call.url.replace(':streamGenerateContent?alt=sse', ':generateContent');
        else call.body.stream = false;
      }
      const upstream=await fetch(call.url,{method:'POST',headers:call.headers,body:JSON.stringify(call.body),signal:abort.signal});
      if(!upstream.ok){
        // Return the upstream error category to the authenticated app without logging or exposing credentials.
        const hints = {400:'الطلب غير صالح أو تم الوصول لحد الإنفاق.',401:'تحقق من مفتاح API في Render.',403:'تحقق من صلاحيات المفتاح والنموذج.',404:'تحقق من اسم النموذج وصلاحية الوصول إليه.',429:'تحقق من الرصيد وحدود الطلبات.'};
        let category = '', detail = '';
        try {
          const raw = await upstream.text();
          const upstreamError = JSON.parse(raw)?.error;
          if(typeof upstreamError?.type === 'string') category = upstreamError.type.slice(0,70);
          if(typeof upstreamError?.message === 'string') detail = upstreamError.message;
        } catch {/* Some providers return non-JSON error bodies. */}
        detail = detail.replace(/sk-(?:proj-)?[a-zA-Z0-9_-]+/g,'[REDACTED]')
          .replace(/(Authorization|x-api-key)\s*[:=]\s*[^\s,;]+/gi,'$1=[REDACTED]')
          .slice(0,280);
        return send(res,upstream.status,{error:`${payload.provider} (${upstream.status})${category ? ' ' + category : ''}: ${detail || hints[upstream.status] || 'تعذّر تنفيذ الطلب لدى المزوّد.'}`});
      }
      if (legacy) {
        const data = await upstream.json();
        const answer = payload.provider === 'openai'
          ? (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n') || data.output_text
          : payload.provider === 'anthropic'
            ? (data.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n')
            : payload.provider === 'groq'
              ? (data.choices?.[0]?.message?.content || '')
              : (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought && part.text).map(part=>part.text).join('\n');
        return send(res,200,{answer: answer || '[No text returned]', provider: payload.provider, model: payload.model});
      }
      if(!upstream.body)throw new Error('Provider returned no stream');
      res.writeHead(200,{...secureHeaders,'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      const emit=obj=>{if(!downstreamClosed)res.write('data: '+JSON.stringify(obj)+'\n\n');};
      emit({type:'ready'});
      const parser=new SSEParser(event=>{
        const out=extractEvent(payload.provider,event);
        if(out?.delta)emit({type:'delta',text:out.delta});
        if(out?.error)emit({type:'error',message:out.error});
      });
      const reader=upstream.body.getReader();const decoder=new TextDecoder();
      while(true){const {done,value}=await reader.read();if(done)break;parser.feed(decoder.decode(value,{stream:true}));}
      parser.feed(decoder.decode());parser.end();emit({type:'done'});res.end();
    }catch(e){if(!downstreamClosed){if(res.headersSent){res.write('data: '+JSON.stringify({type:'error',message:e.message})+'\n\n');res.end();}else send(res,502,{error:e.message});}}
    finally { clearTimeout(timer); }
    return;
  }
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
  try{await staticFile(req,res,pathname);}catch(e){send(res,500,{error:'Static file error'});}
});

if(process.env.NODE_ENV!=='test'){
  const port=Number(process.env.PORT||3000);
  server.listen(port,'0.0.0.0',()=>console.log(`DualMind AI ready at http://localhost:${port}`));
}
