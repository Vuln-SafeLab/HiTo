import { ENGINE_DEFAULTS } from "./rules";

export type KunVariant = "403" | "429" | "challenge";

interface PageOptions {
  variant: KunVariant;
  iconBase64: string;
  eventId: string;
  retryAfterSeconds?: number;
  seed?: string;
  /** PoW difficulty prefix; falls back to ENGINE_DEFAULTS.POW_PREFIX */
  powPrefix?: string;
  /** URL to return to after passing the challenge (must start with "/") */
  returnTo?: string;
}

const CREDIT_HTML = `<p class="credit">由 VulnLab 提供技术支持</p>`;

const BASE_CSS = `
:root{color-scheme:dark light}
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,
  "Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;
  background:#0b1120;color:#e2e8f0}
@media (prefers-color-scheme:light){body{background:#f1f5f9;color:#1e293b}}
.card{width:100%;max-width:520px;text-align:center;
  background:rgba(30,41,59,.55);border:1px solid rgba(148,163,184,.25);
  border-radius:20px;padding:clamp(28px,6vw,56px) clamp(20px,5vw,48px);
  backdrop-filter:blur(12px)}
@media (prefers-color-scheme:light){.card{background:rgba(255,255,255,.7);
  border-color:rgba(100,116,139,.3)}}
img.logo{width:clamp(56px,14vw,84px);height:auto;margin-bottom:18px;opacity:.95}
h1{font-size:clamp(22px,5vw,32px);font-weight:700;letter-spacing:.02em;margin-bottom:10px}
.brand{font-size:13px;font-weight:600;color:#7dd3fc;letter-spacing:.35em;text-transform:uppercase;margin-bottom:26px}
p{font-size:clamp(14px,3.4vw,16px);line-height:1.7;color:#94a3b8}
.eid{margin-top:22px;font-size:11px;color:#64748b;font-family:ui-monospace,monospace}
.count{font-variant-numeric:tabular-nums;font-weight:700;color:#7dd3fc}
.noscript{margin-top:16px;color:#fbbf24;font-size:13px}
.credit{margin-top:24px;font-size:11px;color:#64748b}
`;

function pageShell(
  opts: PageOptions,
  title: string,
  body: string,
  extraScript = ""
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} · HiTo</title>
<style>${BASE_CSS}</style>
${extraScript ? `<script>${extraScript}</script>` : ""}
</head>
<body>
<div class="card">
<img class="logo" alt="HiTo Security · 鲲" src="data:image/png;base64,${opts.iconBase64}">
<div class="brand">HiTo · 鲲 1.0 安全引擎</div>
<h1>${title}</h1>
${body}
<p class="eid">事件 ID ${opts.eventId}</p>
${CREDIT_HTML}
</div>
</body>
</html>`;
}

/** 403 block page */
export function render403(opts: PageOptions): string {
  return pageShell(
    { ...opts },
    "访问已被拦截",
    `<p>本次请求未通过安全检查，已被 <strong>鲲</strong> 引擎拦截。</p>
     <p style="margin-top:8px">如认为误拦，请携带事件 ID 联系站点管理员。</p>`
  );
}

/** 429 rate-limit page */
export function render429(opts: PageOptions): string {
  const seconds = Math.max(1, Math.min(3600, opts.retryAfterSeconds ?? 30));
  const script = `
(function(){
  var s=${seconds},el=document.getElementById("cd");
  var t=setInterval(function(){
    s--;el.textContent=String(s);
    if(s<=0){clearInterval(t);location.replace("/");}
  },1000);
})();`;
  const page = pageShell(
    { ...opts },
    "请求过于频繁",
    `<p>检测到异常请求频率，已临时限流。</p>
     <p style="margin-top:14px"><span class="count" id="cd">${seconds}</span> 秒后自动返回首页…</p>
     <noscript><p class="noscript">请稍后手动返回首页。</p></noscript>`,
    script
  );
  return page;
}

// Pure-JS SHA-256 fallback (verified 214/214 against node:crypto incl. UTF-8 and
// block boundaries). crypto.subtle only exists in secure contexts (HTTPS / localhost);
// over plain-HTTP LAN origins it is undefined and the challenge would dead-end.
// NOTE: embedded verbatim from the unit-tested implementation — do not minify by hand.
const SHA256_FALLBACK_JS = `
function sha256bytes(bytes){
  var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var l=bytes.length;
  var bitLenHi=Math.floor(l/536870912);
  var bitLenLo=(l<<3)>>>0;
  var padded=new Uint8Array(((l+9+63)>>6)<<6);
  padded.set(bytes);
  padded[l]=0x80;
  var dv=new DataView(padded.buffer);
  dv.setUint32(padded.length-8,bitLenHi,false);
  dv.setUint32(padded.length-4,bitLenLo,false);
  var w=new Int32Array(64);
  for(var i=0;i<padded.length;i+=64){
    for(var j=0;j<16;j++)w[j]=dv.getUint32(i+j*4,false);
    for(j=16;j<64;j++){
      var a=w[j-15],b=w[j-2];
      var s0=((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3);
      var s1=((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10);
      w[j]=(w[j-16]+s0+w[j-7]+s1)|0;
    }
    var h0=H[0],h1=H[1],h2=H[2],h3=H[3],h4=H[4],h5=H[5],h6=H[6],h7=H[7];
    for(j=0;j<64;j++){
      var S1=((h4>>>6)|(h4<<26))^((h4>>>11)|(h4<<21))^((h4>>>25)|(h4<<7));
      var ch=(h4&h5)^(~h4&h6);
      var t1=(h7+S1+ch+K[j]+w[j])|0;
      var S0=((h0>>>2)|(h0<<30))^((h0>>>13)|(h0<<19))^((h0>>>22)|(h0<<10));
      var maj=(h0&h1)^(h0&h2)^(h1&h2);
      var t2=(S0+maj)|0;
      h7=h6;h6=h5;h5=h4;h4=(h3+t1)|0;h3=h2;h2=h1;h1=h0;h0=(t1+t2)|0;
    }
    H[0]=(H[0]+h0)|0;H[1]=(H[1]+h1)|0;H[2]=(H[2]+h2)|0;H[3]=(H[3]+h3)|0;
    H[4]=(H[4]+h4)|0;H[5]=(H[5]+h5)|0;H[6]=(H[6]+h6)|0;H[7]=(H[7]+h7)|0;
  }
  var out=new Uint8Array(32);
  var odv=new DataView(out.buffer);
  for(var k=0;k<8;k++)odv.setUint32(k*4,H[k]>>>0,false);
  return out;
}`;

export function renderChallenge(opts: PageOptions, seed: string): string {
  const safeSeed = JSON.stringify(seed).replace(/<\/(script)/gi, "<\\/$1");
  const prefix = opts.powPrefix ?? ENGINE_DEFAULTS.POW_PREFIX;
  const safePrefix = JSON.stringify(prefix);
  // Only same-site relative targets; anything else falls back to "/"
  const rawReturn = opts.returnTo ?? "/";
  const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn.slice(0, 512) : "/";
  const safeReturn = JSON.stringify(returnTo).replace(/</g, "\\u003c");

  const script = `
(async function(){
  var seed=${safeSeed};
  var prefix=${safePrefix};
  var ret=${safeReturn};
  var st=document.getElementById("st");
  ${SHA256_FALLBACK_JS}
  var subtle=(typeof crypto!=="undefined"&&crypto&&crypto.subtle)?crypto.subtle:null;
  function toHex(buf){
    return Array.prototype.map.call(new Uint8Array(buf),function(b){
      return b.toString(16).padStart(2,"0");}).join("");
  }
  function sha256hex(s){
    var data=new TextEncoder().encode(s);
    if(subtle)return subtle.digest("SHA-256",data).then(toHex);
    return Promise.resolve(toHex(sha256bytes(data)));
  }
  try{
    if(typeof TextEncoder==="undefined"){st.textContent="浏览器过旧，无法完成安全验证";return;}
    st.textContent="正在进行安全验证…";
    var nonce=0;
    for(;;){
      var h=await sha256hex(seed+String(nonce));
      if(h.indexOf(prefix)===0)break;
      nonce++;
      if(nonce%4096===0)await new Promise(function(r){setTimeout(r,0)});
    }
    document.cookie="hito_kun_nonce="+String(nonce)+";path=/;max-age=600;samesite=lax";
    st.textContent="验证通过，正在进入…";
    location.replace(ret);
  }catch(e){
    st.textContent="安全验证失败，请刷新重试";
  }
})();`;

  const page = pageShell(
    { ...opts },
    "安全验证中",
    `<p id="st">正在校验浏览器环境…</p>
     <p style="margin-top:10px">此过程通常在一秒内完成。</p>
     <noscript><p class="noscript">需要启用 JavaScript 以完成安全验证。</p></noscript>`,
    script
  );
  return page;
}
