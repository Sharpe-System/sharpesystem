/* /rfo/rfo-exparte-print.js
   Paid Ex Parte Export / Import
*/

import { getAuthStateOnce } from "/firebase-config.js";
import { ensureUserDoc } from "/db.js";

const KEYS={
intake:"ss_rfo_exparte_intake_v1",
fl300:"ss_rfo_exparte_fl300_v1",
fl305:"ss_rfo_exparte_fl305_v1",
notice:"ss_rfo_exparte_notice_v1",
decl:"ss_rfo_exparte_decl_v1",
prop:"ss_rfo_exparte_proposed_v1"
};

function load(k){
try{return JSON.parse(localStorage.getItem(k)||"null")}
catch(_){return null}
}

function buildPacket(d){
return[
"EX PARTE REQUEST",
"",
d.fl300?.ordersRequested||"",
"",
d.fl305?.orders||"",
"",
d.decl?.facts||"",
"",
"NOTICE:",
d.notice?.noticeGiven||"",
d.notice?.noticeMethod||"",
"",
"PROPOSED ORDER:",
d.prop?.orders||""
].join("\n");
}

async function saveToAccount(uid,data){
await ensureUserDoc(uid);
const path=`users/${uid}/drafts/exparte/latest`;
await fetch(`/api/saveDraft`,{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({path,data})
});
}

async function init(){

const user=await getAuthStateOnce();
if(!user){
document.getElementById("status").textContent="Login required.";
return;
}

const d={
intake:load(KEYS.intake),
fl300:load(KEYS.fl300),
fl305:load(KEYS.fl305),
notice:load(KEYS.notice),
decl:load(KEYS.decl),
prop:load(KEYS.prop)
};

const text=buildPacket(d);
document.getElementById("packet").value=text;

document.getElementById("printBtn").onclick=()=>{
window.print();
};

document.getElementById("saveBtn").onclick=async()=>{
await saveToAccount(user.uid,d);
document.getElementById("status").textContent="Saved.";
};

}

init();
