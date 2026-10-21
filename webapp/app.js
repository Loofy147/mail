(function () {
"use strict";
var KEY="mailroom-web-workspace-v1", palette=["teal","violet","blue","amber","rose","slate"];
var seed=[
{id:"m-001",folder:"inbox",sender:"Maya Chen",email:"maya.chen@example.test",to:"Hichem",subject:"A few thoughts on the next release",snippet:"I pulled together the notes from our last review and highlighted three things worth keeping simple.",body:"Hi Hichem,\n\nI pulled together the notes from our last review and highlighted three things worth keeping simple.\n\nFirst, keep the primary action obvious. Second, make empty states teach people what to do next. Third, give users a clear record of what happened after they click.\n\nI added a short checklist below the notes so we can work through it one decision at a time.\n\nLet me know what you would change.\n\nMaya",date:"2026-10-21T09:42:00+01:00",unread:true,starred:true,labels:["Work"],color:"teal",attachments:[]},
{id:"m-002",folder:"inbox",sender:"Yanis B.",email:"yanis.b@example.test",to:"Hichem",subject:"Local launch checklist",snippet:"The first version should feel complete in one region before we try to cover everywhere.",body:"Salam Hichem,\n\nThe first version should feel complete in one region before we try to cover everywhere. I think the strongest checklist is the one that a real operator can use without asking what the next step means.\n\nI would test the whole journey with a few realistic cases and record where the process gets stuck.\n\nTalk soon,\nYanis",date:"2026-10-21T08:18:00+01:00",unread:true,starred:false,labels:["Work"],color:"violet",attachments:[]},
{id:"m-003",folder:"inbox",sender:"Noor Haddad",email:"noor.haddad@example.test",to:"Hichem",subject:"Sunday lunch plans",snippet:"I found a quiet place near the old square. Does 13:00 work for everyone?",body:"Hi!\n\nI found a quiet place near the old square. Does 13:00 work for everyone? If not, we can move it a little later.\n\nNo need to decide everything now — just tell me whether the time works.\n\nNoor",date:"2026-10-20T17:26:00+01:00",unread:false,starred:false,labels:["Personal"],color:"amber",attachments:[]},
{id:"m-004",folder:"inbox",sender:"Product Notes",email:"digest@example.test",to:"Hichem",subject:"The small details that build trust",snippet:"A useful product explains what happened, what did not happen, and why.",body:"THE WEEKLY PRODUCT NOTE\n\nA useful product does more than complete a task: it explains what happened, what did not happen, and why.\n\nA few principles worth revisiting:\n\n• Prefer a visible result over a button that merely looks active.\n• Make destructive actions reversible where possible.\n• Preserve user work when a connection fails.\n• Treat privacy as a default, not a settings page.\n\nSmall details are often the difference between a tool people try and a tool they trust.",date:"2026-10-20T11:03:00+01:00",unread:false,starred:true,labels:["Work"],color:"blue",attachments:[{name:"product-notes-oct.pdf",size:"248 KB"}]},
{id:"m-005",folder:"inbox",sender:"Amine K.",email:"amine.k@example.test",to:"Hichem",subject:"Re: workshop outline",snippet:"I reordered the outline so the real example comes before the framework.",body:"Thanks for sharing the outline.\n\nI reordered the sections so the real example comes before the framework. It reads more naturally now, and it gives people a concrete case to evaluate before they see the abstractions.\n\nThe revised file is attached. I kept the original version unchanged, just in case.\n\nAmine",date:"2026-10-19T15:47:00+01:00",unread:false,starred:false,labels:["Work"],color:"rose",attachments:[{name:"workshop-outline-v2.docx",size:"72 KB"}]},
{id:"m-006",folder:"inbox",sender:"Lina",email:"lina@example.test",to:"Hichem",subject:"The book you mentioned",snippet:"I found it at the neighborhood library. You can borrow my copy after Thursday.",body:"Hey Hichem,\n\nI found the book you mentioned at the neighborhood library. You can borrow my copy after Thursday if that is easier.\n\nThere are a few notes on the inside cover, but nothing important.\n\nLina",date:"2026-10-19T10:14:00+01:00",unread:false,starred:false,labels:["Personal"],color:"amber",attachments:[]},
{id:"m-007",folder:"inbox",sender:"GitHub",email:"notifications@example.test",to:"Hichem",subject:"Your weekly repository summary",snippet:"Review changes and checks before merging anything.",body:"Weekly repository summary\n\nThere was activity across several repositories this week. Before merging changes, verify the diff, check the automated run results, and confirm the actual deployed artifact.\n\nThis is synthetic demonstration content. It is not a real GitHub notification.",date:"2026-10-18T19:02:00+01:00",unread:false,starred:false,labels:["Work"],color:"slate",attachments:[]},
{id:"m-008",folder:"inbox",sender:"Samira B.",email:"samira.b@example.test",to:"Hichem",subject:"Photo from the garden",snippet:"This was from the afternoon when the light came through the trees.",body:"Salam,\n\nThis was from the afternoon when the light came through the trees. Thought you might like it.\n\nHope your week is going well.\nSamira",date:"2026-10-17T16:31:00+01:00",unread:false,starred:false,labels:["Personal"],color:"rose",attachments:[{name:"garden-afternoon.jpg",size:"1.8 MB"}]},
{id:"m-009",folder:"inbox",sender:"Open Source Brief",email:"brief@example.test",to:"Hichem",subject:"Three patterns from this month's releases",snippet:"Smaller defaults, explicit boundaries, and better recovery paths.",body:"OPEN SOURCE BRIEF\n\nThree patterns worth watching in recent releases:\n\n1. Smaller default installations, with expensive capabilities added only when needed.\n2. Clearer security boundaries between content, tools, and user approval.\n3. Better recovery paths for partially completed operations.\n\nThe common thread is that a feature is more useful when its limits are observable and its failures are recoverable.",date:"2026-10-16T09:08:00+01:00",unread:false,starred:false,labels:["Work"],color:"blue",attachments:[]},
{id:"m-010",folder:"sent",sender:"You",email:"me@example.test",to:"Yanis B.",subject:"Re: Local launch checklist",snippet:"Let’s verify the full flow with real operators before expanding the scope.",body:"Hi Yanis,\n\nAgreed. Let’s verify the full flow with real operators before expanding the scope. I’ll keep the acceptance checks tied to observable outcomes rather than a list of screens.\n\nThanks,\nHichem",date:"2026-10-20T19:10:00+01:00",unread:false,starred:false,labels:["Work"],color:"teal",attachments:[]},
{id:"m-011",folder:"archive",sender:"Design Research",email:"research@example.test",to:"Hichem",subject:"Notes from the usability review",snippet:"The most common hesitation happened after a user could not see confirmation.",body:"Research notes\n\nThe most common hesitation happened after a user completed an action but could not see confirmation. The interface should report the outcome, not simply close the dialog.\n\nThis is sample content for the local workspace prototype.",date:"2026-10-15T14:20:00+01:00",unread:false,starred:false,labels:["Work"],color:"violet",attachments:[]},
{id:"m-012",folder:"trash",sender:"Old Newsletter",email:"newsletter@example.test",to:"Hichem",subject:"October updates",snippet:"A sample message in Trash.",body:"This is a sample message in the Trash folder. Restore it or delete it permanently from the local demo.",date:"2026-10-12T08:00:00+01:00",unread:false,starred:false,labels:[],color:"slate",attachments:[]}
];
function clone(value){return JSON.parse(JSON.stringify(value))}
function loadState(){try{var raw=localStorage.getItem(KEY);if(!raw)return{messages:clone(seed),activeFolder:"inbox",filter:"all",theme:"dark",newestFirst:true};var s=JSON.parse(raw);if(!s||!Array.isArray(s.messages))throw Error("invalid");return{messages:s.messages.filter(function(m){return m&&typeof m.id==="string"&&typeof m.subject==="string"&&typeof m.folder==="string"}),activeFolder:typeof s.activeFolder==="string"?s.activeFolder:"inbox",filter:["all","unread","starred"].indexOf(s.filter)>=0?s.filter:"all",theme:s.theme==="light"?"light":"dark",newestFirst:s.newestFirst!==false}}catch(e){return{messages:clone(seed),activeFolder:"inbox",filter:"all",theme:"dark",newestFirst:true}}}
var state=loadState(), selectedId=null, editingId=null, toastTimer=null;
var remoteMode=false, remoteMessages=[], remoteNextPageToken=null, remoteLoading=false, remoteAccountEmail=null, oauthConfigured=false, remoteSequence=0, activeSendRequestId=null, replyContext=null, searchTimer=null;
var searchInput=document.getElementById("searchInput"), messageList=document.getElementById("messageList"), readerContent=document.getElementById("readerContent"), composeBackdrop=document.getElementById("composeBackdrop"), composeForm=document.getElementById("composeForm"), sidebar=document.getElementById("sidebar"), sidebarScrim=document.getElementById("sidebarScrim");
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast("Browser storage is unavailable. Changes may not persist after reload.")}}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function byDate(a,b){return new Date(b.date||0).getTime()-new Date(a.date||0).getTime()}
function mailboxMessages(){return remoteMode?remoteMessages:state.messages}
function findMessage(id){return mailboxMessages().find(function(m){return m.id===id})||null}

function initials(name){return String(name||"?").trim().split(/\s+/).slice(0,2).map(function(p){return p.charAt(0)}).join("").toUpperCase()||"?"}
function displayDate(value,full){var d=new Date(value||"");if(Number.isNaN(d.getTime()))return"";var now=new Date(),yesterday=new Date(now);yesterday.setDate(now.getDate()-1);if(!full&&d.toDateString()===now.toDateString())return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});if(!full&&d.toDateString()===yesterday.toDateString())return"Yesterday";if(!full&&d.getFullYear()===now.getFullYear())return d.toLocaleDateString([],{month:"short",day:"numeric"});return d.toLocaleDateString([],full?{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}:{year:"2-digit",month:"numeric",day:"numeric"})}
function folderName(f){return({inbox:"Inbox",starred:"Starred",sent:"Sent",drafts:"Drafts",archive:"Archive",trash:"Trash",work:"Work",personal:"Personal"})[f]||"Inbox"}
function visibleMessages(){
 var f=state.activeFolder,items=mailboxMessages().filter(function(m){if(f==="starred")return m.starred&&m.folder!=="trash";if(f==="work"||f==="personal")return remoteMode?m.folder===f:((m.labels||[]).indexOf(f==="work"?"Work":"Personal")>=0&&m.folder!=="trash");return m.folder===f});
 if(state.filter==="unread")items=items.filter(function(m){return m.unread});if(state.filter==="starred")items=items.filter(function(m){return m.starred});
 var q=searchInput.value.trim().toLowerCase();if(q)items=items.filter(function(m){return[m.sender,m.email,m.to,m.subject,m.snippet,m.body].join(" ").toLowerCase().indexOf(q)>=0});
 items.sort(byDate);if(!state.newestFirst)items.reverse();return items
}

function toast(message){var region=document.getElementById("toastRegion");region.innerHTML="";var el=document.createElement("div");el.className="toast";el.textContent=message;region.appendChild(el);if(toastTimer)window.clearTimeout(toastTimer);toastTimer=window.setTimeout(function(){region.innerHTML=""},3400)}
function renderSidebar(){
 document.querySelectorAll("[data-nav]").forEach(function(b){var active=b.getAttribute("data-nav")===state.activeFolder;b.classList.toggle("is-active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
 var messages=mailboxMessages(),counts=remoteMode?{inbox:0,starred:0,sent:0,drafts:0}:{inbox:messages.filter(function(m){return m.folder==="inbox"&&m.unread}).length,starred:messages.filter(function(m){return m.starred&&m.folder!=="trash"}).length,sent:messages.filter(function(m){return m.folder==="sent"}).length,drafts:messages.filter(function(m){return m.folder==="drafts"}).length};
 Object.keys(counts).forEach(function(f){var el=document.getElementById("count-"+f);if(el)el.textContent=counts[f]?String(counts[f]):""})
}

function renderHeader(items){
 document.getElementById("pageTitle").textContent=folderName(state.activeFolder);
 document.getElementById("mailEyebrow").textContent=remoteMode?"CONNECTED MAIL / GMAIL":(state.activeFolder==="inbox"?"YOUR SPACE / MAIL":"YOUR SPACE / "+state.activeFolder.toUpperCase());
 document.getElementById("pageSubtitle").textContent=remoteMode?("Live Gmail mailbox · "+(remoteAccountEmail||"connected account")):({inbox:"Your conversations, in one place.",starred:"The messages you kept close.",sent:"Messages saved from this local demo.",drafts:"Unfinished messages saved on this device.",archive:"Out of the way, still within reach.",trash:"Deleted messages from this local demo.",work:"Conversations tagged for work.",personal:"Conversations tagged personal."})[state.activeFolder]||"Your conversations, in one place.";
 document.getElementById("resultCount").textContent=items.length+(items.length===1?" message":" messages");
 var load=document.getElementById("loadMore");load.hidden=!remoteMode||!remoteNextPageToken;load.disabled=remoteLoading;load.textContent=remoteLoading?"Loading…":"Load more";
 document.getElementById("listBottomText").textContent=remoteLoading?"Syncing mailbox…":(remoteMode?(remoteNextPageToken?"More messages available":(items.length?"End of this view":"No messages in this view")):(items.length?"That’s everything in this view":"Nothing else here"));
 document.querySelectorAll("[data-filter]").forEach(function(b){var active=b.getAttribute("data-filter")===state.filter;b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",String(active))})
}

function renderCard(m){var labels=(m.labels||[]).map(function(l){return'<span class="tag '+(l==="Work"?"tag-work":"tag-personal")+'">'+esc(l)+"</span>"}).join("");var attachment=(m.attachments||[]).length?'<span class="tag tag-attachment">⌁ Attachment</span>':"";var sender=m.folder==="sent"?"To: "+(m.to||""):(m.sender||"Unknown sender");return'<article class="message-card'+(m.id===selectedId?" is-selected":"")+(m.unread?" is-unread":"")+'" role="button" tabindex="0" data-open-email="'+esc(m.id)+'" aria-label="Open '+esc(m.subject)+'"><div class="avatar avatar-'+(palette.indexOf(m.color)>=0?m.color:"slate")+'">'+esc(initials(m.folder==="sent"?(m.to||"Recipient"):(m.sender||"?")))+'</div><div class="message-main"><div class="message-topline"><span class="sender-name">'+esc(sender)+'</span><span class="message-date">'+esc(displayDate(m.date,false))+'</span></div><div class="message-subject">'+esc(m.subject||"(no subject)")+'</div><div class="message-snippet">'+esc(m.snippet||(m.body||"").slice(0,110))+'</div><div class="message-bottom">'+labels+attachment+(m.folder==="drafts"?'<span class="tag">Draft</span>':"")+'<button class="star-button'+(m.starred?" is-starred":"")+'" data-action="star" data-id="'+esc(m.id)+'" aria-label="'+(m.starred?"Remove star":"Add star")+'" title="'+(m.starred?"Remove star":"Add star")+'">'+(m.starred?"★":"☆")+'</button></div></div></article>'}
function renderList(items){if(!items.length){var search=!!searchInput.value.trim();messageList.innerHTML='<div class="empty-list"><div class="empty-list-icon">'+(search?"⌕":"✉")+'</div><h3>'+(search?"No matching messages":"This view is quiet")+'</h3><p>'+(search?"Try a different sender, subject, or phrase.":"Messages that belong here will appear in this list. You can also compose a local demo message.")+'</p>'+(!search&&state.activeFolder==="drafts"?'<button class="button button-quiet" data-open-compose="new">Start a draft</button>':"")+'</div>';return}messageList.innerHTML=items.map(renderCard).join("")}
function renderEmptyReader(){readerContent.innerHTML='<div class="reader-empty"><div class="empty-art"><span>✉</span><i></i><b></b></div><h2>Your space to think.</h2><p>Choose a message to read it here, or start a new conversation.</p><button class="button button-primary" data-open-compose="new">＋ Compose a message</button><span class="reader-empty-foot">Tip: press <kbd>c</kbd> to compose</span></div>'}
function renderReader(m){
 if(!m){renderEmptyReader();return}
 var draft=m.folder==="drafts",labels=(m.labels||[]).map(function(l){return'<span class="tag '+(l==="Work"?"tag-work":"tag-personal")+'">'+esc(l)+"</span>"}).join("");
 var from=m.folder==="sent"?"You":(m.sender||"Unknown sender"),email=remoteMode?(m.folder==="sent"?(remoteAccountEmail||""):(m.email||"")):(m.folder==="sent"?"me@example.test":(m.email||""));
 var recipient=m.folder==="sent"?"To "+(m.to||"unknown recipient"):"to "+(m.to||"you");
 var toolbar='<div class="reader-toolbar"><div class="reader-toolbar-group"><button class="reader-action reader-back" data-action="back">← Back</button><button class="reader-action" data-action="archive" data-id="'+esc(m.id)+'">▱ Archive</button><button class="reader-action danger" data-action="delete" data-id="'+esc(m.id)+'">⌫ Delete</button></div><div class="reader-toolbar-group"><button class="reader-action" data-action="unread" data-id="'+esc(m.id)+'">'+(m.unread?"● Mark read":"○ Mark unread")+'</button></div></div>';
 if(draft)toolbar='<div class="reader-toolbar"><div class="reader-toolbar-group"><button class="reader-action reader-back" data-action="back">← Back</button><button class="reader-action" data-action="edit-draft" data-id="'+esc(m.id)+'">✎ Continue draft</button></div><div class="reader-toolbar-group"><button class="reader-action danger" data-action="delete" data-id="'+esc(m.id)+'">⌫ Delete</button></div></div>';
 if(m.folder==="trash")toolbar='<div class="reader-toolbar"><div class="reader-toolbar-group"><button class="reader-action reader-back" data-action="back">← Back</button><button class="reader-action" data-action="restore" data-id="'+esc(m.id)+'">↶ Restore</button></div><div class="reader-toolbar-group">'+(remoteMode?'<span class="reader-demo-label"><span>ⓘ</span> Permanent deletion disabled</span>':'<button class="reader-action danger" data-action="permanent-delete" data-id="'+esc(m.id)+'">Delete permanently</button>')+'</div></div>';
 var body=m.bodyLoaded===false?(remoteMode?"Loading message…":(m.body||"")):esc(m.body||"").replace(/\n/g,"<br>");if(m.bodyLoaded===false)body='<span class="reader-loading">'+esc(body)+'</span>';
 var attachments=(m.attachments||[]).map(function(a){return'<div class="reader-attachment"><div class="attachment-icon">⌁</div><div class="attachment-copy"><strong>'+esc(a.name||"Attachment")+'</strong><small>'+esc(a.size||"File attachment")+'</small></div><span class="attachment-label">'+(remoteMode?"Download not enabled":"Sample file")+'</span></div>'}).join("");
 var footer=draft?'<button class="reply-button" data-action="edit-draft" data-id="'+esc(m.id)+'">✎ Continue writing</button>':'<button class="reply-button" data-action="reply" data-id="'+esc(m.id)+'">↩ Reply</button><span class="reader-demo-label"><span>ⓘ</span> '+(remoteMode?"Connected to Gmail · actions affect your mailbox":"Demo action — no message is delivered")+'</span>';
 readerContent.innerHTML='<header class="reader-header">'+toolbar+'<div class="reader-subject-row"><h2 class="reader-subject">'+esc(m.subject||"(no subject)")+'</h2><button class="reader-star'+(m.starred?" is-starred":"")+'" data-action="star" data-id="'+esc(m.id)+'" aria-label="'+(m.starred?"Remove star":"Add star")+'">'+(m.starred?"★":"☆")+'</button></div><div class="reader-tags">'+labels+(draft?'<span class="tag">Draft</span>':"")+(m.folder==="sent"?(remoteMode?'<span class="tag">Gmail · Sent</span>':'<span class="tag">Sent · local demo</span>'):"")+'</div></header><div class="reader-meta"><div class="avatar avatar-'+(palette.indexOf(m.color)>=0?m.color:"slate")+'">'+esc(initials(from))+'</div><div><div class="reader-sender"><strong>'+esc(from)+'</strong><span>'+esc(email)+'</span></div><div class="reader-recipient">'+esc(recipient)+'</div></div><div class="reader-time">'+esc(displayDate(m.date,false))+'<small>'+esc(displayDate(m.date,true))+'</small></div></div><div class="reader-body">'+body+'</div>'+attachments+'<div class="reader-reply">'+footer+'</div>'
}

function render(){document.body.classList.toggle("light",state.theme==="light");updateConnectionUi();renderSidebar();var items=visibleMessages();if(!items.some(function(m){return m.id===selectedId}))selectedId=items.length?items[0].id:null;renderHeader(items);renderList(items);renderReader(selectedId?findMessage(selectedId):null);persist()}

function closeSidebar(){sidebar.classList.remove("is-open");sidebarScrim.classList.remove("is-visible")}function openSidebar(){sidebar.classList.add("is-open");sidebarScrim.classList.add("is-visible")}
function openCompose(existing,reply){
 editingId=existing?existing.id:null;replyContext=reply?{threadId:reply.threadId||null,inReplyTo:reply.rfcMessageId||reply.inReplyTo||null}:(existing?{threadId:existing.threadId||null,inReplyTo:existing.inReplyTo||existing.rfcMessageId||null}:null);
 composeForm.reset();document.getElementById("composeTitle").textContent=existing?"Edit draft":(reply?"Reply":"Compose");document.getElementById("composeTo").value=existing?(existing.to||""):(reply?(reply.email||""):"");document.getElementById("composeSubject").value=existing?(existing.subject||""):(reply?(/^re:/i.test(reply.subject||"")?reply.subject:"Re: "+(reply.subject||"")):"");document.getElementById("composeBody").value=existing?(existing.body||""):(reply?"\n\n\n— Original message —\n"+(reply.body||""):"");
 document.getElementById("demoWarning").innerHTML=remoteMode?'<span>✓</span><p><strong>Connected to Gmail.</strong> Sending will deliver real email. Saving a draft writes to your Gmail account.</p>':'<span>ⓘ</span><p><strong>Local demo mode.</strong> Saving to Sent only stores a sample message in this browser. It does not deliver email.</p>';
 document.getElementById("composeSubmitLabel").textContent=remoteMode?"Send email":"Save to Sent";document.getElementById("sendDemoTag").hidden=remoteMode;document.querySelector(".compose-footer-note").innerHTML=remoteMode?'<span class="lock-glyph">⌑</span> Stored in Gmail':'<span class="lock-glyph">⌑</span> Stored on this device';
 composeBackdrop.hidden=false;window.setTimeout(function(){document.getElementById("composeTo").focus()},20)
}

function closeCompose(){composeBackdrop.hidden=true;editingId=null;replyContext=null}

async function saveComposer(asDraft){
 var to=document.getElementById("composeTo").value.trim(),subject=document.getElementById("composeSubject").value.trim(),body=document.getElementById("composeBody").value.trim();
 if(asDraft){if(!to&&!subject&&!body){toast("Write something before saving a draft.");return}}else if(!to||!subject||!body){composeForm.reportValidity();return}
 if(remoteMode){
  if(!to||!subject||!body){toast("Gmail drafts need a recipient, subject and message body before saving.");composeForm.reportValidity();return}
  var submit=document.querySelector('#composeForm button[type="submit"]');if(submit)submit.disabled=true;
  try{
   var context=replyContext||{};
   if(asDraft){
    var dp={to:to,subject:subject,body:body};if(editingId)dp.id=editingId;if(context.threadId)dp.threadId=context.threadId;if(context.inReplyTo)dp.inReplyTo=context.inReplyTo;
    var saved=await apiJson("/api/drafts",{method:editingId?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(dp)});
    closeCompose();state.activeFolder="drafts";state.filter="all";selectedId=saved.id||null;searchInput.value="";await syncRemote(false);toast("Draft saved to Gmail.");return
   }
   if(!activeSendRequestId)activeSendRequestId=crypto.randomUUID();
   var sp={requestId:activeSendRequestId,to:to,subject:subject,body:body};if(editingId)sp.draftId=editingId;if(context.threadId)sp.threadId=context.threadId;if(context.inReplyTo)sp.inReplyTo=context.inReplyTo;
   var sent=await apiJson("/api/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sp)});
   activeSendRequestId=null;closeCompose();state.activeFolder="sent";state.filter="all";selectedId=null;searchInput.value="";await syncRemote(false);toast(sent.duplicate?"This send request was already processed.":"Email sent through Gmail.");return
  }catch(error){if(error.code!=="send_status_unknown"&&error.code!=="provider_unavailable")activeSendRequestId=null;remoteError(error)}finally{if(submit)submit.disabled=false}
  return
 }
 var m=editingId?findMessage(editingId):null;
 if(m){m.folder=asDraft?"drafts":"sent";m.sender="You";m.email="me@example.test";m.to=to;m.subject=subject;m.body=body;m.snippet=body.replace(/\s+/g," ").slice(0,135);m.date=new Date().toISOString();m.unread=false;m.color="teal";m.attachments=[];m.labels=[]}
 else{m={id:"local-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),folder:asDraft?"drafts":"sent",sender:"You",email:"me@example.test",to:to,subject:subject,snippet:body.replace(/\s+/g," ").slice(0,135),body:body,date:new Date().toISOString(),unread:false,starred:false,labels:[],color:"teal",attachments:[]};state.messages.push(m);selectedId=m.id}
 state.activeFolder=asDraft?"drafts":"sent";state.filter="all";searchInput.value="";closeCompose();render();toast(asDraft?"Draft saved on this device.":"Saved in local Sent. No email was delivered.")
}

function mutate(id,action){var m=findMessage(id);if(!m)return;if(remoteMode){remoteMutate(id,action,m);return}if(action==="star"){m.starred=!m.starred;toast(m.starred?"Added to Starred.":"Removed from Starred.")}else if(action==="unread"){m.unread=!m.unread;toast(m.unread?"Marked unread.":"Marked read.")}else if(action==="archive"){m.folder="archive";m.unread=false;toast("Moved to Archive. If needed, you can find it there.");if(selectedId===id)selectedId=null}else if(action==="delete"){m.folder="trash";m.unread=false;toast("Moved to Trash. You can restore it.");if(selectedId===id)selectedId=null}else if(action==="restore"){m.folder="inbox";toast("Restored to Inbox.")}else if(action==="permanent-delete"){if(window.confirm("Permanently delete this sample message from this browser?")){state.messages=state.messages.filter(function(x){return x.id!==id});selectedId=null;toast("Removed from this browser.")}}render()}

function selectFolder(f){state.activeFolder=f;state.filter="all";searchInput.value="";selectedId=null;closeSidebar();document.body.classList.remove("show-reader");if(remoteMode){remoteMessages=[];remoteNextPageToken=null;render();syncRemote(false);return}render()}
function updateConnectionUi(){
 var status=document.getElementById("accountStatusText"),button=document.getElementById("connectButton");
 status.textContent=remoteMode?(remoteAccountEmail||"Gmail connected"):"Local demo";button.textContent=remoteMode?"Disconnect":"Connect Gmail";
 button.title=remoteMode?"Disconnect this Gmail account":(oauthConfigured?"Connect a real Gmail mailbox":"Configure server OAuth and database settings before connecting Gmail");button.setAttribute("aria-label",button.title)
}
async function apiJson(url,options){
 var opts=Object.assign({credentials:"same-origin",cache:"no-store"},options||{});opts.headers=Object.assign({Accept:"application/json"},opts.headers||{});
 var response=await fetch(url,opts),data={};try{data=await response.json()}catch{}
 if(!response.ok){var error=new Error(data&&data.error&&data.error.message||"The mail request failed.");error.code=data&&data.error&&data.error.code||"request_failed";error.status=response.status;throw error}
 return data
}
function remoteError(error){
 if(error&&(error.code==="not_connected"||error.code==="reauth_required"||error.code==="session_expired")){
  remoteMode=false;remoteMessages=[];remoteNextPageToken=null;remoteAccountEmail=null;selectedId=null;updateConnectionUi();render();toast("The Gmail session has expired. Connect the account again.");return
 }
 toast(error&&error.message||"The mail request could not be completed.")
}
async function syncRemote(append){
 if(!remoteMode)return;if(append&&(!remoteNextPageToken||remoteLoading))return;
 var seq=++remoteSequence,params=new URLSearchParams({folder:state.activeFolder}),queries=[],q=searchInput.value.trim();if(q)queries.push(q);if(state.filter==="unread")queries.push("is:unread");if(state.filter==="starred")queries.push("is:starred");if(queries.length)params.set("q",queries.join(" "));
 if(append)params.set("pageToken",remoteNextPageToken||"");else{remoteNextPageToken=null;remoteMessages=[];selectedId=null}
 remoteLoading=true;render();
 try{var data=await apiJson("/api/messages?"+params.toString());if(seq!==remoteSequence)return;
  remoteMessages=append?remoteMessages.concat(data.messages||[]):(data.messages||[]);remoteNextPageToken=data.nextPageToken||null;remoteLoading=false;render();
  if(!append&&selectedId)loadRemoteDetail(selectedId)
 }catch(error){if(seq===remoteSequence){remoteLoading=false;render();remoteError(error)}}
}
async function loadRemoteDetail(id){
 if(!remoteMode||!id)return;var item=remoteMessages.find(function(m){return m.id===id});if(!item||item.bodyLoaded!==false||item.folder==="drafts")return;
 var seq=remoteSequence,params=new URLSearchParams({id:id,folder:state.activeFolder});
 try{var data=await apiJson("/api/messages?"+params.toString());if(!remoteMode||seq!==remoteSequence||selectedId!==id)return;var index=remoteMessages.findIndex(function(m){return m.id===id});if(index>=0)remoteMessages[index]=Object.assign({},remoteMessages[index],data.message,{bodyLoaded:true});render()}
 catch(error){if(seq===remoteSequence)remoteError(error)}
}
async function remoteMutate(id,action,item){
 if(action==="permanent-delete"){toast("Permanent deletion is disabled to avoid requesting broader Gmail permissions. Empty Trash in Gmail instead.");return}
 var actual=action;if(action==="unread")actual=item.unread?"mark-read":"mark-unread";
 if(action==="archive"||action==="delete"||action==="restore")selectedId=null;
 try{await apiJson("/api/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id,action:actual,folder:item.folder})});
  toast(({star:"Star updated.",unread:item.unread?"Marked read.":"Marked unread.","mark-read":"Marked read.","mark-unread":"Marked unread.",archive:"Moved to Archive.",delete:item.folder==="drafts"?"Draft deleted from Gmail.":"Moved to Gmail Trash.",restore:"Restored from Gmail Trash."})[action]||"Gmail updated.");await syncRemote(false)
 }catch(error){remoteError(error)}
}
async function initialize(){
 render();var params=new URLSearchParams(location.search),authError=params.get("auth_error"),connected=params.get("connected");
 if(authError){var messages={setup:"Gmail connection is not configured on the server yet.",rate_limit:"Too many connection attempts. Try again later.",cancelled:"Google sign-in was cancelled.",scope_missing:"Gmail permissions were not fully granted.",identity_failed:"Google could not confirm the account identity.",oauth_failed:"Gmail sign-in could not be completed."};toast(messages[authError]||"Gmail sign-in did not complete.")}
 if(authError||connected)history.replaceState(null,"",location.pathname);
 try{var result=await apiJson("/api/auth/status");oauthConfigured=Boolean(result.configured);
  if(result.connected){remoteMode=true;remoteAccountEmail=result.email||null;remoteMessages=[];state.filter="all";await syncRemote(false)}
  updateConnectionUi();render();if(connected&&remoteMode)toast("Connected to Gmail. Mail actions now affect the live account.")
 }catch{updateConnectionUi()}
}

document.addEventListener("click",function(e){
 var nav=e.target.closest("[data-nav]");if(nav){selectFolder(nav.getAttribute("data-nav"));return}
 var filter=e.target.closest("[data-filter]");if(filter){state.filter=filter.getAttribute("data-filter");render();if(remoteMode)syncRemote(false);return}
 if(e.target.closest("[data-open-compose]")){openCompose(null,null);return}
 var action=e.target.closest("[data-action]");if(action){var name=action.getAttribute("data-action"),id=action.getAttribute("data-id"),m=findMessage(id);if(name==="back"){document.body.classList.remove("show-reader");return}if(name==="edit-draft"&&m){openCompose(m,null);return}if(name==="reply"&&m){openCompose(null,m);return}mutate(id,name);return}
 if(e.target.closest("#loadMore")){syncRemote(true);return}
 if(e.target.closest("#connectButton")){
  if(remoteMode){apiJson("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).catch(function(){});remoteMode=false;remoteMessages=[];remoteNextPageToken=null;remoteAccountEmail=null;selectedId=null;state.activeFolder="inbox";updateConnectionUi();render();toast("Disconnected this browser from Gmail.");return}
  if(!oauthConfigured){toast("Gmail is not configured yet. Follow the server setup guide in webapp/README.md.");return}location.href="/api/auth/start";return
 }
 if(e.target.closest("#refreshButton")){if(remoteMode)syncRemote(false);else{render();toast("Local view refreshed.")}return}
 var card=e.target.closest("[data-open-email]");if(card){if(e.target.closest("button[data-action]"))return;var msg=findMessage(card.getAttribute("data-open-email"));if(msg){selectedId=msg.id;if(remoteMode){if(msg.unread){msg.unread=false;apiJson("/api/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:msg.id,action:"mark-read",folder:msg.folder})}).catch(remoteError)}render();loadRemoteDetail(msg.id)}else{if(msg.unread)msg.unread=false;render()}if(window.matchMedia("(max-width:980px)").matches)document.body.classList.add("show-reader")}}
});

messageList.addEventListener("keydown",function(e){var card=e.target.closest("[data-open-email]");if(e.target.closest("button[data-action]"))return;if(card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();var m=findMessage(card.getAttribute("data-open-email"));if(m){selectedId=m.id;m.unread=false;render();if(window.matchMedia("(max-width: 980px)").matches)document.body.classList.add("show-reader")}}});
searchInput.addEventListener("input",function(){render();if(remoteMode){if(searchTimer)window.clearTimeout(searchTimer);searchTimer=window.setTimeout(function(){syncRemote(false)},300)}});document.getElementById("composeButton").addEventListener("click",function(){openCompose(null,null)});document.getElementById("sidebarCompose").addEventListener("click",function(){closeSidebar();openCompose(null,null)});document.getElementById("emptyCompose").addEventListener("click",function(){openCompose(null,null)});document.getElementById("closeCompose").addEventListener("click",closeCompose);composeBackdrop.addEventListener("click",function(e){if(e.target===composeBackdrop)closeCompose()});composeForm.addEventListener("submit",function(e){e.preventDefault();saveComposer(false)});document.getElementById("saveDraft").addEventListener("click",function(){saveComposer(true)});document.getElementById("themeButton").addEventListener("click",function(){state.theme=state.theme==="light"?"dark":"light";render();toast(state.theme==="light"?"Light theme enabled.":"Dark theme enabled.")});document.getElementById("refreshButton").addEventListener("click",function(){if(remoteMode)syncRemote(false);else{render();toast("Local view refreshed.")}});document.getElementById("sortButton").addEventListener("click",function(){state.newestFirst=!state.newestFirst;render();toast(state.newestFirst?"Newest messages first.":"Oldest messages first.")});document.getElementById("loadMore").addEventListener("click",function(){syncRemote(true)});document.getElementById("mobileMenu").addEventListener("click",openSidebar);sidebarScrim.addEventListener("click",closeSidebar);
document.addEventListener("keydown",function(e){var t=e.target,typing=t&&(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable);if(e.key==="Escape"){if(!composeBackdrop.hidden)closeCompose();else{closeSidebar();document.body.classList.remove("show-reader")}return}if(typing||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==="/"){e.preventDefault();searchInput.focus()}if(e.key.toLowerCase()==="c"){e.preventDefault();openCompose(null,null)}});
window.addEventListener("storage",function(e){if(e.key===KEY){state=loadState();render()}});
if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"))window.addEventListener("load",function(){navigator.serviceWorker.register("./sw.js").catch(function() {})});
var inboxFirst=state.messages.filter(function(m){return m.folder==="inbox"}).sort(byDate)[0];selectedId=inboxFirst?inboxFirst.id:null;initialize();

})();