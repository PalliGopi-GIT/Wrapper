import type { Deck } from '../model/types'
import { renderSlide } from '../render/slide'
import { collectCss, downloadBlob, safeName, AUTOFIT_JS } from './common'
import { escapeHtml } from './pdf'

/**
 * A single-file, offline-capable deck. Everything is inlined except
 * web fonts and remote images, which degrade gracefully.
 */
export async function buildStandaloneHtml(deck: Deck): Promise<string> {
  const css = await collectCss()
  const slides = deck.slides
    .map((s, i) => {
      const el = renderSlide(s, deck, i, deck.slides.length)
      return `<section class="page" data-i="${i}">${el.outerHTML}</section>`
    })
    .join('')
  const notes = JSON.stringify(deck.slides.map((s) => s.notes ?? ''))

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(deck.title)}</title>
<style>${css}</style>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:Inter,system-ui,sans-serif}
  #deck{position:fixed;inset:0;display:grid;place-items:center}
  .page{display:none;width:1280px;height:720px;transform-origin:center center}
  .page.on{display:block}
  .slide-host-fit{position:relative}
  .bar{position:fixed;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.12);z-index:20}
  .bar i{display:block;height:100%;background:#fff;transition:width .25s ease}
  .hint{position:fixed;right:14px;bottom:12px;color:rgba(255,255,255,.35);font-size:11px;letter-spacing:.08em;text-transform:uppercase;z-index:20;pointer-events:none}
  .notes{position:fixed;left:0;right:0;bottom:0;max-height:34vh;overflow:auto;background:rgba(10,11,13,.96);color:#c9ced6;
    padding:18px 24px;font-size:13px;line-height:1.6;white-space:pre-wrap;display:none;z-index:19;border-top:1px solid #22262c}
  .notes.on{display:block}
  @media print{
    @page{size:13.333in 7.5in;margin:0}
    html,body{background:#fff;overflow:visible}
    #deck{position:static;display:block}
    .page{display:block!important;break-after:page;page-break-after:always}
    .bar,.hint,.notes{display:none!important}
  }
</style></head>
<body>
<div id="deck">${slides}</div>
<div class="bar"><i id="p"></i></div>
<div class="hint">← →  ·  N notes  ·  F fullscreen</div>
<div class="notes" id="notes"></div>
<script>${AUTOFIT_JS}
(function(){
  var pages=[].slice.call(document.querySelectorAll('.page'));
  var N=${notes};
  var i=0, notesEl=document.getElementById('notes'), bar=document.getElementById('p');
  function fit(){
    var k=Math.min(innerWidth/1280, innerHeight/720)*0.96;
    pages.forEach(function(p){ p.style.transform='scale('+k+')'; });
  }
  function show(n){
    i=Math.max(0,Math.min(pages.length-1,n));
    pages.forEach(function(p,j){ p.classList.toggle('on', j===i); });
    bar.style.width=((i+1)/pages.length*100)+'%';
    notesEl.textContent=N[i]||'';
  }
  addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();show(i+1)}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();show(i-1)}
    if(e.key==='Home'){show(0)} if(e.key==='End'){show(pages.length-1)}
    if(e.key==='n'||e.key==='N'){notesEl.classList.toggle('on')}
    if(e.key==='f'||e.key==='F'){document.documentElement.requestFullscreen?.()}
  });
  document.addEventListener('click',function(e){
    var x=e.clientX/innerWidth;
    if(x>0.62) show(i+1); else if(x<0.38) show(i-1);
  });
  addEventListener('resize',fit);
  fit(); show(0);
})();
<\/script>
</body></html>`

  return html
}

export async function downloadStandaloneHtml(deck: Deck): Promise<void> {
  const html = await buildStandaloneHtml(deck)
  downloadBlob(new Blob([html], { type: 'text/html' }), `${safeName(deck.title)}.html`)
}
