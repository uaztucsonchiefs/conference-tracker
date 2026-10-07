/* Conference Tracker: static shell + public vendor assets only.
 * API POSTs, credentials, credits and admin responses never enter this cache.
 * Increment VERSION whenever the frontend changes. */
'use strict';
const VERSION='OCT06-DESK1';
const SHELL='uaim-tracker-shell-'+VERSION;
const ASSETS='uaim-tracker-assets-v1';
const QR='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
function validPage(response,text){return response.ok&&response.type!=='opaque'&&text.includes('data-tracker-build="'+VERSION+'"');}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL),response=await fetch('/index.html',{cache:'no-store'}),text=await response.clone().text();
    if(!validPage(response,text))throw new Error('Expected tracker build was not served.');
    await cache.put('/index.html',response);
    // QR is optional; failure never prevents the page from installing.
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
    try{const r=await fetch(QR,{mode:'cors',signal:controller.signal});if(r.ok)await(await caches.open(ASSETS)).put(QR,r);}catch(ignore){}finally{clearTimeout(timer);}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('uaim-tracker-shell-')&&key!==SHELL)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='CHECK_VERSION'&&event.source)event.source.postMessage({type:'WORKER_VERSION',version:VERSION});
});
async function savedPage(){
  const cached=await(await caches.open(SHELL)).match('/index.html');
  if(!cached)return new Response('Connect once to prepare Conference Tracker for offline access.',{status:503,headers:{'Content-Type':'text/plain'}});
  const text=(await cached.text()).replace('<html ','<html data-offline-shell="true" ');
  return new Response(text,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
async function navigate(request){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(request,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('Page unavailable');
    // The latest online page is always returned, including a newer build. Only
    // a matching shell is cached under this worker's build-specific key.
    const text=await response.clone().text();
    if(validPage(response,text))await(await caches.open(SHELL)).put('/index.html',response.clone());
    return response;
  }catch(error){return savedPage();}
  finally{clearTimeout(timer);}
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET')return;
  if(/(?:^|\.)google(?:usercontent)?\.com$/.test(url.hostname))return;
  if(request.mode==='navigate'&&url.origin===self.location.origin&&(url.pathname==='/'||url.pathname==='/index.html')){
    event.respondWith(navigate(request));return;
  }
  const vendor=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'||request.url===QR;
  if(!vendor)return;
  event.respondWith((async()=>{
    const cache=await caches.open(ASSETS),hit=await cache.match(request);if(hit)return hit;
    const response=await fetch(request);if(response.ok||response.type==='opaque')await cache.put(request,response.clone());return response;
  })());
});
