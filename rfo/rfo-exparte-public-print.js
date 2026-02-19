/* /rfo/rfo-exparte-public-print.js
   Ex Parte Public Print Gate
   Deterministic readiness from ex parte keys
*/

(function(){
"use strict";

const KEYS={
intake:"ss_rfo_exparte_intake_v1",
fl300:"ss_rfo_exparte_fl300_v1",
fl305:"ss_rfo_exparte_fl305_v1",
notice:"ss_rfo_exparte_notice_v1",
decl:"ss_rfo_exparte_decl_v1",
prop:"ss_rfo_exparte_proposed_v1"
};

function $(id){return document.getElementById(id);}
function load(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(_){return null}}
function ok(v){return v && Object.keys(v).length>0}

function noticeComplete(n){
if(!n)return false;
if(n.noticeGiven==="yes"||n.noticeGiven==="attempted")
return !!(n.noticeMethod||n.noticeWhen);
if(n.noticeGiven==="no")
return !!n.noticeWhyNot;
return false;
}

function set(id,val){
$(id).textContent=val?"Ready":"Missing";
$(id).style.color=val?"#0a0":"#a00";
}

function buildPreview(d){
if(!d)return"";
return[
"EX PARTE PACKET SUMMARY",
"",
d.fl300?.ordersRequested||"",
d.fl305?.orders||"",
d.decl?.relief||"",
d.prop?.orders||""
].join("\n");
}

function init(){

const d={
intake:load(KEYS.intake),
fl300:load(KEYS.fl300),
fl305:load(KEYS.fl305),
notice:load(KEYS.notice),
decl:load(KEYS.decl),
prop:load(KEYS.prop)
};

const st={
intake:ok(d.intake),
fl300:ok(d.fl300),
fl305:ok(d.fl305),
notice:noticeComplete(d.notice),
decl:ok(d.decl),
prop:ok(d.prop)
};

set("st_intake",st.intake);
set("st_fl300",st.fl300);
set("st_fl305",st.fl305);
set("st_notice",st.notice);
set("st_decl",st.decl);
set("st_prop",st.prop);

const all=Object.values(st).every(Boolean);

$("overall").textContent=
all?"Packet complete. Ready for filing workflow."
:"Packet incomplete. Complete missing sections.";

$("preview").value=buildPreview(d);

$("copy").onclick=()=>{
navigator.clipboard.writeText($("preview").value);
};

}

document.addEventListener("DOMContentLoaded",init);

})();
