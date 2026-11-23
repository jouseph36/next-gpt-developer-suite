/** API adapters. No SDK or runtime dependencies: Node.js 20+ native fetch. */
export const MAX_ATTACHMENTS = 3;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const VALID_TYPES = new Set(['image/png','image/jpeg','image/webp','image/gif','application/pdf']);

export function validateRequest(payload) {
  if (!payload || !['openai', 'anthropic'].includes(payload.provider)) throw new Error('Invalid provider');
  if (typeof payload.model !== 'string' || !/^[a-zA-Z0-9_.:-]{2,90}$/.test(payload.model)) throw new Error('Invalid model');
  if (!Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > 32) throw new Error('Invalid message history');
  for (const m of payload.messages) {
    if (!m || !['user','assistant'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 40000) throw new Error('Invalid message');
    if (m.attachments !== undefined) {
      if (!Array.isArray(m.attachments) || m.attachments.length > MAX_ATTACHMENTS) throw new Error('Invalid attachments');
      for (const a of m.attachments) {
        if (!a || !VALID_TYPES.has(a.type) || typeof a.name !== 'string' || a.name.length > 150 || typeof a.base64 !== 'string') throw new Error('Invalid attachment');
        if (a.base64.length > Math.ceil(MAX_FILE_BYTES*4/3)+64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64)) throw new Error('Attachment too large or malformed');
      }
    }
  }
  if (payload.messages.at(-1).role !== 'user') throw new Error('Last message must be from user');
  return true;
}

function openaiParts(m) {
  if (m.role === 'assistant') return m.text || ' ';
  const parts = [{type:'input_text',text:m.text||' '}];
  for (const a of m.attachments||[]) {
    if (a.type === 'application/pdf') parts.push({type:'input_file',filename:a.name,file_data:`data:application/pdf;base64,${a.base64}`});
    else parts.push({type:'input_image',image_url:`data:${a.type};base64,${a.base64}`,detail:'auto'});
  }
  return parts;
}

function claudeParts(m) {
  const parts = [{type:'text',text:m.text||' '}];
  if (m.role === 'user') for (const a of m.attachments||[]) {
    if (a.type === 'application/pdf') parts.push({type:'document',source:{type:'base64',media_type:'application/pdf',data:a.base64}});
    else parts.push({type:'image',source:{type:'base64',media_type:a.type,data:a.base64}});
  }
  return parts;
}

export function providerRequest({provider,model,messages,webSearch,system},env=process.env) {
  const commonSystem = (typeof system === 'string' ? system.slice(0,3000) : '') || 'Be accurate, helpful, and transparent about uncertainty. Reply in the user’s language.';
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server');
    return {
      url:env.OPENAI_API_URL||'https://api.openai.com/v1/responses',
      headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:{model,instructions:commonSystem,input:messages.map(m=>({role:m.role,content:openaiParts(m)})),store:false,stream:true,...(webSearch?{tools:[{type:'web_search'}]}:{})}
    };
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured on the server');
  return {
    url:env.ANTHROPIC_API_URL||'https://api.anthropic.com/v1/messages',
    headers:{'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},
    body:{model,system:commonSystem,max_tokens:4096,messages:messages.map(m=>({role:m.role,content:claudeParts(m)})),stream:true,...(webSearch?{tools:[{type:'web_search_20260318',name:'web_search',max_uses:3}]}:{})}
  };
}

export function extractEvent(provider, data) {
  if (!data || typeof data !== 'object') return null;
  if (data.type === 'error' || data.type === 'response.failed') return {error: JSON.stringify(data.error||data.response?.error||data)};
  if (provider === 'openai' && data.type==='response.output_text.delta') return {delta:data.delta||''};
  if (provider === 'anthropic' && data.type==='content_block_delta' && data.delta?.type==='text_delta') return {delta:data.delta.text||''};
  return null;
}

/** Parses arbitrary split chunks of SSE text. */
export class SSEParser {
  constructor(onEvent) {this.buffer='';this.block=[];this.onEvent=onEvent;}
  feed(text) {
    this.buffer += text;
    let at;
    while ((at=this.buffer.indexOf('\n'))>=0) {
      const line=this.buffer.slice(0,at).replace(/\r$/,'');this.buffer=this.buffer.slice(at+1);
      if (!line) {this.flush();continue;}
      if (line.startsWith('data:')) this.block.push(line.slice(5).trimStart());
    }
  }
  flush(){
    if(!this.block.length)return;
    const payload=this.block.join('\n');this.block=[];
    if(payload==='[DONE]')return;
    try{this.onEvent(JSON.parse(payload));}catch{/* Ignore non-JSON or incomplete events */}
  }
  end(){ if(this.buffer.trim().startsWith('data:'))this.block.push(this.buffer.trim().slice(5).trimStart());this.flush(); }
}
