const $=id=>document.getElementById(id);
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const state={chats:[],current:null,config:null,files:[],busy:false,controller:null};
const defaultSystem='أجب بلغة المستخدم، وكن صريحًا عند عدم اليقين، ولا تختلق مصادر.';
let toastTimeout;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),4500);}
const formatTime=date=>new Intl.DateTimeFormat('ar',{dateStyle:'medium'}).format(new Date(date));
function escapeHtml(input){return String(input).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function inlineMd(s){return escapeHtml(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');}
function renderMarkdown(text){
 const lines=String(text||'').split('\n');let html='';let inCode=false,code='',list=false;
 const closeList=()=>{if(list){html+='</ul>';list=false;}};
 for(const line of lines){
  if(line.trim().startsWith('```')){closeList();if(inCode){html+=`<pre><code>${escapeHtml(code.replace(/\n$/,''))}</code></pre>`;code='';inCode=false;}else inCode=true;continue;}
  if(inCode){code+=line+'\n';continue;}
  if(/^\s*[-*] /.test(line)){if(!list){list=true;html+='<ul>';}html+=`<li>${inlineMd(line.replace(/^\s*[-*] /,''))}</li>`;continue;}
  closeList();if(!line.trim()){html+='<p></p>';continue;}
  if(/^#{1,3} /.test(line)){html+=`<h3>${inlineMd(line.replace(/^#{1,3} /,''))}</h3>`;continue;}
  html+=`<p>${inlineMd(line)}</p>`;
 }
 closeList();if(inCode)html+=`<pre><code>${escapeHtml(code)}</code></pre>`;return html;
}
function openDatabase(){return new Promise((resolve,reject)=>{const req=indexedDB.open('dualmind-local',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
let db;
async function loadChats(){try{db=await openDatabase();const result=await new Promise((resolve,reject)=>{const tx=db.transaction('state');const q=tx.objectStore('state').get('chats');q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});state.chats=Array.isArray(result)?result:[];}catch(e){console.warn('IndexedDB unavailable',e);toast('تعذر تشغيل التخزين المحلي');}}
async function saveChats(){if(!db)return false;try{await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state.chats,'chats');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return true;}catch(e){console.warn(e);toast('تعذر حفظ المحادثة؛ مساحة تخزين المتصفح ربما امتلأت');return false;}}
function previousChat(history) {
 if (!Array.isArray(history) || history.length === 0) return null;
 if (!history.every(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')) return null;
 const messages = history.map(item => ({
   id: id(), role: item.role, text: item.content, provider: item.provider, error: Boolean(item.error)
 }));
 return {id: 'dualmind-deployment-history', title: (messages.find(item => item.role === 'user')?.text || 'محادثة سابقة').slice(0,55), updated: Date.now(), messages};
}
async function restorePreviousVersion() {
 const oldPassword = sessionStorage.getItem('dualmind_password');
 if (oldPassword && !sessionStorage.getItem('dm_password')) sessionStorage.setItem('dm_password',oldPassword);
 if (oldPassword) sessionStorage.removeItem('dualmind_password');
 const key = 'dualmind_history_v1';
 const raw = localStorage.getItem(key);
 if (!raw) return;
 let chat;
 try { chat = previousChat(JSON.parse(raw)); } catch { return; }
 if (!chat) return;
 if (!state.chats.some(item => item.id === chat.id)) state.chats.push(chat);
 if (await saveChats()) localStorage.removeItem(key);
}
function freshChat(){return {id:id(),title:'محادثة جديدة',updated:Date.now(),messages:[]};}
function activeChat(){return state.chats.find(x=>x.id===state.current);}
function newChat(){if(state.busy)return;const chat=freshChat();state.chats.unshift(chat);state.current=chat.id;state.files=[];$('prompt').value='';renderAll();saveChats();$('prompt').focus();$('sidebar').classList.remove('open');}
function openChat(chatId){if(state.busy)return;state.current=chatId;state.files=[];renderAll();$('sidebar').classList.remove('open');}
function deleteChat(chatId){if(state.busy)return;const chat=state.chats.find(c=>c.id===chatId);if(!confirm(`حذف المحادثة «${chat?.title||''}» من المتصفح؟`))return;state.chats=state.chats.filter(c=>c.id!==chatId);if(state.current===chatId)state.current=state.chats[0]?.id||null;renderAll();saveChats();}
function renderSidebar(){const list=$('chatList');list.replaceChildren();const query=$('search').value.toLowerCase().trim();const filtered=[...state.chats].sort((a,b)=>b.updated-a.updated).filter(c=>c.title.toLowerCase().includes(query)||c.messages.some(m=>m.text.toLowerCase().includes(query)));
 for(const chat of filtered){const item=document.createElement('div');item.className='chat-item'+(chat.id===state.current?' selected':'');
  const open=document.createElement('button');open.className='chat-open';open.innerHTML='<span>◌</span><span></span>';open.lastElementChild.textContent=chat.title;open.addEventListener('click',()=>openChat(chat.id));
  const remove=document.createElement('button');remove.className='chat-remove';remove.textContent='×';remove.title='حذف';remove.addEventListener('click',()=>deleteChat(chat.id));item.append(open,remove);list.append(item);
 }
}
function renderMessages(){const chat=activeChat();$('conversationTitle').textContent=chat?.title||'محادثة جديدة';$('welcome').style.display=chat?.messages.length?'none':'block';const pane=$('messages');pane.replaceChildren();
 for(const message of chat?.messages||[]){const node=document.createElement('article');node.className='message '+message.role;const meta=document.createElement('div');meta.className='message-meta';const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=message.role==='user'?'أ':({anthropic:'C',openai:'G',gemini:'M',groq:'Q'}[message.provider]||'✦');meta.append(avatar);
 const label=document.createElement('span');label.textContent=message.role==='user'?'أنت':`${({anthropic:'Claude',openai:'OpenAI',gemini:'Gemini',groq:'Groq'}[message.provider]||'AI')} · ${message.model||''}`;meta.append(label);
 if(message.text){const copy=document.createElement('button');copy.textContent='نسخ';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(message.text);toast('تم النسخ');}catch{toast('تعذر النسخ');}});meta.append(copy);}
 const bubble=document.createElement('div');bubble.className='bubble';bubble.innerHTML=message.role==='assistant'?renderMarkdown(message.text):escapeHtml(message.text);if(message.pending&&!message.text){bubble.classList.add('thinking');bubble.textContent='جارٍ التفكير…';}
 node.append(meta,bubble);
 if(message.attachments?.length){const files=document.createElement('div');files.className='message-files';for(const file of message.attachments){const chip=document.createElement('span');chip.className='file-chip';chip.textContent=`📎 ${file.name}`;files.append(chip);}node.append(files);}
 pane.append(node);}
 scrollBottom();}
function scrollBottom(){$('workspace')?.scrollTo({top:$('workspace').scrollHeight,behavior:'instant'});}
function renderAttachments(){const pane=$('attachments');pane.replaceChildren();pane.hidden=state.files.length===0;
 state.files.forEach((file,index)=>{const chip=document.createElement('div');chip.className='attachment';const span=document.createElement('span');span.textContent=`📎 ${file.name}`;const rm=document.createElement('button');rm.textContent='×';rm.ariaLabel='إزالة المرفق';rm.onclick=()=>{state.files.splice(index,1);renderAttachments();};chip.append(span,rm);pane.append(chip);});}
function renderAll(){renderSidebar();renderMessages();renderAttachments();}
function modelsFor(provider){return state.config?.models?.[provider]||[];}
function applyModels(){
 const provider=$('provider').value, select=$('model'), current=select.value;
 select.replaceChildren();
 for(const model of modelsFor(provider)){const option=document.createElement('option');option.value=model;option.textContent=model;select.append(option);}
 if(modelsFor(provider).includes(current))select.value=current;
 const available=state.config?.providers||{};
 $('providerStatus').textContent=['gemini','groq','openai','anthropic'].map(p=>({gemini:'Gemini',groq:'Groq',openai:'GPT',anthropic:'Claude'}[p])+': '+(available[p]?'مفتاح موجود':'يلزم مفتاح')).join(' · ');
 const free=['gemini','groq'].includes(provider);
 if(free)$('webSearch').checked=false;
 $('webSearch').disabled=free;
 $('webSearch').title=free?'بحث الويب غير مفعّل للخطة المجانية':'بحث الويب قد يترتب عليه رسوم';
}
const b64FromFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
async function addAttachments(files){for(const file of files){if(state.files.length>=3){toast('الحد الأعلى 3 ملفات في الرسالة');break;}if(!['image/png','image/jpeg','image/webp','image/gif','application/pdf'].includes(file.type)){toast('مسموح صور وPDF فقط');continue;}if(file.size>3*1024*1024){toast(`${file.name}: الحد الأعلى 3 ميغابايت`);continue;}state.files.push({name:file.name,type:file.type,base64:await b64FromFile(file)});}renderAttachments();}
function setBusy(v){state.busy=v;$('send').hidden=v;$('stop').hidden=!v;$('prompt').disabled=v;$('newChat').disabled=v;}
function contextFor(chat,provider){const msgs=chat.messages.filter(m=>m.role==='user'||(m.role==='assistant'&&m.provider===provider&&!m.pending&&!m.error));
 return msgs.slice(-14).map((m,index,array)=>({role:m.role,text:m.text,attachments: m.role==='user'&&index===array.length-1?m.attachments:[]}));
}
async function runModel(chat,provider,model){const message={id:id(),role:'assistant',provider,model,text:'',pending:true};chat.messages.push(message);renderMessages();
 const payload={provider,model,messages:contextFor(chat,provider),webSearch:$('webSearch').checked,system:localStorage.getItem('dm_system')||defaultSystem};
 try{const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...(sessionStorage.getItem('dm_password')?{'Authorization':'Bearer '+sessionStorage.getItem('dm_password')}:{})},body:JSON.stringify(payload),signal:state.controller.signal});
  if(!res.ok){let data;try{data=await res.json();}catch{}throw new Error(data?.error||`HTTP ${res.status}`);}
  const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
  const parseBlock=block=>{const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');if(!data)return;let obj;try{obj=JSON.parse(data);}catch{return;}
   if(obj.type==='delta'){message.text+=obj.text;renderMessages();}else if(obj.type==='error'){message.error=true;message.text+=`\n[API Error: ${obj.message}]`;renderMessages();}
  };
  while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let at;while((at=buffer.indexOf('\n\n'))>=0){parseBlock(buffer.slice(0,at));buffer=buffer.slice(at+2);}}
  if(buffer)parseBlock(buffer);
 }catch(e){message.error=true;if(e.name==='AbortError'){message.text+='\n[تم إيقاف الاستجابة]';}else{message.text+=`\n⚠ ${e.message}`;if(e.message.includes('Incorrect app password'))toast('تحقق من كلمة مرور التطبيق');}}finally{message.pending=false;chat.updated=Date.now();renderMessages();await saveChats();}
}
async function submit(){if(state.busy)return;const content=$('prompt').value.trim();if(!content&&!state.files.length)return;
 const available=state.config?.providers||{};const compare=$('compare').checked;const primary=$('provider').value;
 if(compare && !['gemini','groq'].includes(primary)){toast('المقارنة التلقائية متاحة بين Gemini وGroq فقط لتجنب استدعاءات API المدفوعة. ألغِ المقارنة لاستخدام GPT أو Claude.');return;}
 const jobs=compare?['gemini','groq']:[primary];
 if(compare && (!available.gemini || !available.groq)){toast('المقارنة المجانية تحتاج GEMINI_API_KEY و GROQ_API_KEY معًا');return;}
 const valid=jobs.filter(p=>available[p]);if(!valid.length){toast('أضف مفتاح '+primary.toUpperCase()+'_API_KEY إلى Render → Environment، ولا ترسله داخل المحادثة.');return;}
 if(state.files.length && valid.includes('groq')){toast('نماذج Groq الحالية تقبل النص فقط. استخدم Gemini للصور أو PDF.');return;}
 let chat=activeChat();if(!chat){chat=freshChat();state.chats.unshift(chat);state.current=chat.id;}
 const msg={id:id(),role:'user',text:content||'حلل المرفقات المضافة',attachments:state.files,created:Date.now()};chat.messages.push(msg);
 if(chat.title==='محادثة جديدة')chat.title=(content||state.files[0]?.name||'مرفق').slice(0,55);
 state.controller=new AbortController();setBusy(true);
 chat.updated=Date.now();$('prompt').value='';state.files=[];renderAll();await saveChats();
 try{await Promise.all(valid.map(p=>runModel(chat,p,p===primary?$('model').value:modelsFor(p)[0])));}finally{setBusy(false);state.controller=null;renderSidebar();$('prompt').focus();}
}
function download(name,value){const blob=new Blob([value],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeChats(data){return Array.isArray(data)&&data.length<300&&data.every(c=>c&&typeof c.id==='string'&&typeof c.title==='string'&&Array.isArray(c.messages)&&c.messages.length<500&&c.messages.every(m=>m&&typeof m.text==='string'&&['user','assistant'].includes(m.role)));}
async function init(){await loadChats();await restorePreviousVersion();
 try{const res=await fetch('/api/config');state.config=await res.json();}catch{toast('تعذر الاتصال بالخادم');}
 $('provider').value=['gemini','groq','anthropic','openai'].find(p=>state.config?.providers?.[p])||'gemini';applyModels();if(state.chats.length)state.current=state.chats[0].id;renderAll();
 $('newChat').onclick=newChat;$('closeSide').onclick=()=>$('sidebar').classList.remove('open');$('openSide').onclick=()=>$('sidebar').classList.toggle('open');
 $('search').oninput=renderSidebar;$('provider').onchange=applyModels;$('send').onclick=submit;$('stop').onclick=()=>state.controller?.abort();
 $('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}};
 $('prompt').oninput=()=>{$('prompt').style.height='auto';$('prompt').style.height=Math.min($('prompt').scrollHeight,170)+'px';};
 $('attachmentInput').onchange=async e=>{await addAttachments([...e.target.files]);e.target.value='';};
 $('themeBtn').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('dm_theme',document.body.classList.contains('light')?'light':'dark');};
 if(localStorage.getItem('dm_theme')==='light')document.body.classList.add('light');
 document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.prompt;$('prompt').focus();});
 $('settingsBtn').onclick=()=>{$('password').value=sessionStorage.getItem('dm_password')||'';$('system').value=localStorage.getItem('dm_system')||defaultSystem;$('settingsDialog').showModal();};
 $('saveSettings').onclick=()=>{sessionStorage.setItem('dm_password',$('password').value);localStorage.setItem('dm_system',$('system').value.slice(0,3000));$('settingsDialog').close();toast('تم حفظ الإعدادات محليًا في المتصفح');};
 $('wipeData').onclick=async()=>{if(!confirm('سيتم حذف جميع المحادثات المحلية نهائيًا من هذا المتصفح. متابعة؟'))return;state.chats=[];state.current=null;localStorage.removeItem('dualmind_history_v1');await saveChats();renderAll();$('settingsDialog').close();toast('تم مسح المحادثات المحلية');};
 $('exportAll').onclick=()=>download('dualmind-chats.json',JSON.stringify({type:'dualmind-export',version:1,chats:state.chats},null,2));
 $('importAll').onclick=()=>$('importFile').click();
 $('importFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>15*1024*1024)throw Error('الملف كبير جدًا');const parsed=JSON.parse(await f.text());const prior=previousChat(parsed);const imported=prior?[prior]:parsed?.chats;if(!safeChats(imported))throw Error('صيغة المحادثات غير معروفة');state.chats=imported;state.current=state.chats[0]?.id||null;await saveChats();renderAll();toast('تم استيراد المحادثات');}catch(err){toast(err.message);}finally{e.target.value='';}};
 $('speechBtn').onclick=()=>{const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){toast('الإملاء الصوتي غير متاح بهذا المتصفح');return;}const recog=new Speech();recog.lang='ar-JO';recog.onresult=e=>{$('prompt').value+=(($('prompt').value?' ':'')+e.results[0][0].transcript);};recog.onerror=()=>toast('تعذر تسجيل الصوت');recog.start();};
 if(state.config?.requiresPassword&&!sessionStorage.getItem('dm_password')){toast('ضبط كلمة مرور التطبيق من الإعدادات قبل إرسال الرسائل');}
}
init();
