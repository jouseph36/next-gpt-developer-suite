const $=id=>document.getElementById(id);
let config={providers:{openai:false,anthropic:false},models:{openai:[],anthropic:[]}};
let history=[];
try{const saved=JSON.parse(localStorage.getItem('dualmind_history_v1')||'[]');if(Array.isArray(saved))history=saved.slice(-120);}catch{}
function save(){try{localStorage.setItem('dualmind_history_v1',JSON.stringify(history.slice(-120)));}catch{}}
function add(role,content,provider,error){const item={role,content,provider,error:!!error};history.push(item);save();draw();return item;}
function draw(){
 const pane=$('messages');pane.replaceChildren();
 if(!history.length){const welcome=document.createElement('div');welcome.className='welcome';const title=document.createElement('h1');title.textContent='مساعد واحد، نموذجان';const info=document.createElement('p');info.textContent='اكتب سؤالك واختر GPT أو Claude أو قارن بينهما.';welcome.append(title,info);pane.append(welcome);}
 for(const item of history){
  const node=document.createElement('article');node.className='message '+(item.role==='user'?'user':'assistant')+(item.error?' error':'');
  const speaker=document.createElement('span');speaker.className='speaker';speaker.textContent=item.role==='user'?'أنت':item.provider==='anthropic'?'Claude':'GPT';
  const text=document.createElement('div');text.textContent=item.content;node.append(speaker,text);pane.append(node);
 }
 pane.scrollTop=pane.scrollHeight;
}
function getModel(provider){return config.models?.[provider]?.[0];}
function updateModels(){const name=$('provider').value;const el=$('model');const preferred=el.value;el.replaceChildren();for(const model of config.models?.[name]||[]){const opt=document.createElement('option');opt.value=model;opt.textContent=model;el.append(opt);}if([...(config.models?.[name]||[])].includes(preferred))el.value=preferred;}
function contextFor(provider){
 const clean=history.filter(m=>!m.error&&(m.role==='user'||m.provider===provider)).slice(-24).map(m=>({role:m.role,content:m.content}));
 while(clean[0]?.role==='assistant')clean.shift();
 return clean;
}
async function one(provider,model){
 const messages=contextFor(provider);
 const pending={role:'assistant',provider,content:'جارٍ استدعاء النموذج…',error:false};history.push(pending);draw();
 try{
  const result=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(sessionStorage.getItem('dualmind_password')||'')},body:JSON.stringify({provider,model,messages})});
  let json={};try{json=await result.json();}catch{throw Error('Invalid server response');}
  if(!result.ok)throw Error(json.error||'HTTP '+result.status);
  pending.content=json.answer||'[No answer]';
 }catch(e){pending.content='⚠ '+(e.message||String(e));pending.error=true;}
 save();draw();
}
async function submit(e){
 e.preventDefault();const text=$('prompt').value.trim();if(!text)return;
 const name=$('provider').value;
 const jobs=$('compare').checked?['openai','anthropic']:[name];
 const ready=jobs.filter(p=>config.providers[p]);
 if(!ready.length){alert('أضف مفتاح API إلى Environment في Render أولًا.');return;}
 $('prompt').value='';add('user',text);
 $('send').disabled=true;
 try{await Promise.all(ready.map(p=>one(p,p===name?$('model').value:getModel(p))))}
 finally{$('send').disabled=false;$('prompt').focus();}
}
async function init(){
 draw();
 $('password').value=sessionStorage.getItem('dualmind_password')||'';
 try{
  const r=await fetch('/api/config');config=await r.json();updateModels();
  const parts=['OpenAI: '+(config.providers.openai?'جاهز':'ينقص مفتاح API'),'Claude: '+(config.providers.anthropic?'جاهز':'ينقص مفتاح API')];
  $('status').textContent=parts.join(' · ');
  if(!config.providers.openai&&!config.providers.anthropic)$('status').classList.add('bad');
 }catch{$('status').textContent='فشل الاتصال بالخادم';$('status').classList.add('bad');}
 $('provider').addEventListener('change',updateModels);
 $('composer').addEventListener('submit',submit);
 $('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit();}});
 $('savePass').onclick=()=>{sessionStorage.setItem('dualmind_password',$('password').value);alert('تم حفظ كلمة المرور في جلسة المتصفح الحالية');};
 $('clear').onclick=()=>{if(confirm('بدء محادثة جديدة؟')){history=[];save();draw();}};
 $('wipe').onclick=()=>{if(confirm('حذف كل سجل المحادثات المحفوظ في هذا المتصفح؟')){history=[];localStorage.removeItem('dualmind_history_v1');draw();}};
 $('export').onclick=()=>{const file=new Blob([JSON.stringify(history,null,2)],{type:'application/json'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='dualmind-chats.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
}
init();
