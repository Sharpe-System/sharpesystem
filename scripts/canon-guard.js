#!/usr/bin/env node
const fs=require("fs"),path=require("path");const ROOT=process.cwd();
const SCAN=["functions","rfo","partials"];const BAD_IMP=["pdf-lib","fs","path","child_process"];
const BAD_LINK=['href="/login?"',"href='/login?'",'href="/signup?"',"href='/signup?'",'href="/login"',"href='/login'",'href="/signup"',"href='/signup'"];
function read(p){try{return fs.readFileSync(p,"utf8")}catch{return""}}
function walk(d,o=[]){const a=path.join(ROOT,d);if(!fs.existsSync(a))return o;for(const e of fs.readdirSync(a,{withFileTypes:true})){const f=path.join(a,e.name);if(e.isDirectory())walk(path.join(d,e.name),o);else o.push(f)}return o}
function rel(p){return"/"+path.relative(ROOT,p).replaceAll(path.sep,"/")}
let err=[];
for(const d of SCAN)for(const f of walk(d)){const t=read(f),r=rel(f);
if(r.startsWith("/functions/")&&r.endsWith(".js"))for(const b of BAD_IMP){if(new RegExp(`from\\s+["']${b}["']|require\$begin:math:text$\[\"\'\]\$\{b\}\[\"\'\]\\$end:math:text$`).test(t))err.push(`${r}: forbidden import ${b}`)}
if(r.endsWith(".html")){for(const b of BAD_LINK)if(t.includes(b))err.push(`${r}: bad route ${b}`);if(t.includes("/functions/api/"))err.push(`${r}: wrong api path /functions/api/`)}
}
if(err.length){console.error("\nCanon Guard FAILED\n");err.forEach(e=>console.error(" - "+e));process.exit(1)}
console.log("Canon Guard OK");process.exit(0);
