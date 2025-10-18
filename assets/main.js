// ---------- Utilities ----------
const $ = (q)=> document.querySelector(q)
const $$ = (q)=> Array.from(document.querySelectorAll(q))
const LABELS_EMO = ['feliz','triste','enojado','sorprendido','neutral']
const LABELS_AUD = ['perro','gato','pájaro','vaca','caballo']
const FORMATIONS  = ['4-4-2','4-3-3','3-5-2','4-2-3-1','3-4-3']

let DARK = true
const seedRand = (seed=42)=>{ let s=seed; return ()=> (s=(s*9301+49297)%233280)/233280 }
const stableDemo = (labels, seed=7)=>{ const rnd = seedRand(seed), v = labels.map(()=>rnd()); const sum=v.reduce((a,b)=>a+b,0); return v.map(x=>x/sum) }

function setStatus(el, state){
  const map = { loading:['bg-amber-100','text-amber-800','Cargando'],
                ok:['bg-emerald-100','text-emerald-800','OK'],
                error:['bg-rose-100','text-rose-800','Error'],
                idle:['bg-neutral-200','text-neutral-800','Sin permisos'] }
  el.className = 'badge '+map[state][0]+' '+map[state][1]
  el.textContent = map[state][2]
}

function topUI(root, preds){
  const sorted = [...preds].sort((a,b)=>b.prob-a.prob).slice(0,3)
  const top = sorted[0]
  $(root+'-top1').textContent = (top? `${emoji(top.label)} ${top.label}`:'—')
  $(root+'-top1p').textContent = top? (top.prob*100).toFixed(0)+'%':'—'
  const ul = $(root+'-top3'); ul.innerHTML=''
  sorted.forEach((p,i)=>{
    const li = document.createElement('li')
    li.className='flex items-center gap-2'
    li.innerHTML = `<span class="w-6 text-right">${i+1}.</span>
      <span class="flex-1">${emoji(p.label)} ${p.label}</span>
      <span class="w-16 text-right tabular-nums">${(p.prob*100).toFixed(0)}%</span>`
    ul.appendChild(li)
  })
}
function emoji(label){
  switch(label){
    case 'feliz': return '😊'
    case 'triste': return '😢'
    case 'enojado': return '😠'
    case 'sorprendido': return '😮'
    case 'neutral': return '😐'
    case 'perro': return '🐶'
    case 'gato': return '🐱'
    case 'pájaro': return '🐦'
    case 'vaca': return '🐮'
    case 'caballo': return '🐴'
    default: return '✨'
  }
}

// ---------- Theme & Tabs ----------
const UI = {
  show(key){
    $$('#tabs .tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===key))
    $('#panel-emotions').classList.toggle('hidden', key!=='emotions')
    $('#panel-animals').classList.toggle('hidden',  key!=='animals')
    $('#panel-formations').classList.toggle('hidden', key!=='formations')
    history.replaceState(null,'','#'+key)
  }
}
window.UI = UI

$('#themeBtn').onclick = ()=>{
  DARK = !DARK
  document.documentElement.classList.toggle('dark', DARK)
}
$$('#tabs .tab').forEach(b=> b.onclick = ()=> UI.show(b.dataset.tab))
document.addEventListener('keydown', (e)=>{
  if(e.key==='1') UI.show('emotions')
  if(e.key==='2') UI.show('animals')
  if(e.key==='3') UI.show('formations')
})
UI.show(location.hash.replace('#','')||'emotions')
document.documentElement.classList.add('dark')

// ---------- Emotions (Image) ----------
const Emotions = (()=>{
  const video = $('#emo-video'), canvas=$('#emo-canvas'), ctx = canvas.getContext('2d')
  const img = $('#emo-img')
  const statusEl = $('#status-emotions')
  const lat = $('#emo-lat'); let t0=0
  let running=false, source='camera', model=null, lowFps=false

  async function initCamera(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video:true})
      video.srcObject = stream
      await video.play()
      setStatus(statusEl,'ok')
    }catch(e){ console.warn(e); setStatus(statusEl,'idle') }
  }

  async function loadModel(){
    try{
      model = await window.tmImage.load('/public/models/emotions/model.json','/public/models/emotions/metadata.json')
    }catch(e){ console.warn('Modelo emociones no encontrado, modo demo') }
  }

  async function predict(){
    if(!running) return
    t0 = performance.now()
    let el = null
    if(source==='camera' && video.readyState>=2) el = video
    if(source==='file' && img.complete) el = img
    if(el){
      if(model){
        const preds = await model.predict(el)
        const P = preds.map(p=>({label:p.className, prob:p.probability}))
        topUI('#emo', P)
      }else{
        const probs = stableDemo(LABELS_EMO, 7)
        topUI('#emo', LABELS_EMO.map((l,i)=>({label:l, prob:probs[i]})))
      }
      const dt = performance.now()-t0; lat.textContent = dt.toFixed(1)
      ctx.clearRect(0,0,canvas.width,canvas.height)
      roundRect(ctx,0,0,canvas.width,canvas.height,24)
      ctx.save(); ctx.clip(); ctx.drawImage(el,0,0,canvas.width,canvas.height); ctx.restore()
    }
    setTimeout(()=> requestAnimationFrame(predict), lowFps? 200: 0)
  }

  $('#emo-start').onclick = ()=>{ running=true; predict() }
  $('#emo-stop').onclick  = ()=>{ running=false }
  $('#emo-lowfps').onchange = (e)=> lowFps = e.target.checked
  $('#emo-src-cam').onclick = ()=>{ source='camera'; initCamera() }
  $('#emo-file').onchange = (e)=>{
    const f = e.target.files?.[0]; if(!f) return
    const url = URL.createObjectURL(f); img.onload = ()=>{ source='file'; running=true; predict() }; img.src=url
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath()
  }

  (async()=>{ setStatus(statusEl,'loading'); await initCamera(); await loadModel() })()

  return {}
})()

// ---------- Animals (Audio) ----------
const AudioUI = (()=>{
  const canvas = $('#aud-canvas'), ctx = canvas.getContext('2d')
  const statusEl = $('#status-animals')
  const lat = $('#aud-lat'); let t0=0
  let recording=false, analyser=null, model=null, listening=false
  let audioCtx=null

  async function initModel(){
    try{
      model = await window.tmAudio.load('/public/models/animals/model.json','/public/models/animals/metadata.json')
      setStatus(statusEl,'ok')
    }catch(e){ console.warn('Modelo audio no encontrado, modo demo'); setStatus(statusEl,'idle') }
  }

  async function start(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true})
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser(); analyser.fftSize=1024; src.connect(analyser)
      drawSpectrogram()
      recording=true; setStatus(statusEl,'ok')
      if(model && model.listen && !listening){
        listening=true
        await model.listen(preds=>{
          t0 = performance.now()
          const P = preds.map(p=>({label: p.label || p.className, prob: p.score || p.probability}))
          topUI('#aud', P)
          const dt = performance.now()-t0; lat.textContent = dt.toFixed(1)
        }, { overlapFactor: 0.5, includeSpectrogram:false })
      } else if(!model){
        // actualiza demo periódicamente
        const P = LABELS_AUD.map((l,i)=>({label:l, prob: stableDemo(LABELS_AUD,9)[i]}))
        topUI('#aud', P)
      }
    }catch(e){ console.warn(e); setStatus(statusEl,'idle') }
  }
  function stop(){
    recording=false
    try{ audioCtx && audioCtx.close() }catch{}
    if(model && model.stopListening) model.stopListening()
    listening=false
  }

  function drawSpectrogram(){
    const freq = new Uint8Array(analyser.frequencyBinCount)
    const { width:w, height:h } = canvas
    function tick(){
      if(!analyser) return
      analyser.getByteFrequencyData(freq)
      const img = ctx.getImageData(1,0,w-1,h); ctx.putImageData(img,0,0)
      for(let y=0;y<h;y++){
        const v = freq[Math.floor(y/h*freq.length)]
        ctx.fillStyle = `hsl(${Math.max(0,260-v)},80%,${30+v/3}%)`
        ctx.fillRect(w-1,h-y,1,1)
      }
      if(recording) requestAnimationFrame(tick)
    }
    tick()
  }

  function play(name){
    const a = $('#aud-player'); a.src = `/public/samples/audio/${name}`; a.play()
  }

  $('#aud-start').onclick = start
  $('#aud-stop').onclick = stop
  window.AudioUI = { play }

  ;(async()=>{ setStatus(statusEl,'loading'); await initModel() })()
  return { play }
})()

// ---------- Formations (Pose) ----------
const Formations = (()=>{
  const video = $('#frm-video'), canvas=$('#frm-canvas'), ctx = canvas.getContext('2d')
  const statusEl = $('#status-formations')
  const mini = $('#frm-mini'), mctx = mini.getContext('2d')
  const lat = $('#frm-lat'); let t0=0
  let running=false, model=null

  async function initCamera(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video:true})
      video.srcObject = stream
      await video.play()
      setStatus(statusEl,'ok')
    }catch(e){ console.warn(e); setStatus(statusEl,'idle') }
  }
  async function loadModel(){
    try{
      model = await window.tmPose.load('/public/models/formations/model.json','/public/models/formations/metadata.json')
    }catch(e){ console.warn('Modelo formaciones no encontrado, modo demo') }
  }

  async function loop(){
    if(!running) return
    t0 = performance.now()
    if(video.readyState>=2){
      ctx.drawImage(video,0,0,canvas.width,canvas.height)
      if(model && model.estimatePose){
        const { pose, posenetOutput } = await model.estimatePose(video)
        if(pose) drawPose(ctx, pose)
        if(model.predict){
          const preds = await model.predict(posenetOutput)
          const P = preds.map(p=>({label:p.className, prob:p.probability}))
          topUI('#frm', P)
          const top = P.slice().sort((a,b)=>b.prob-a.prob)[0]?.label || '4-3-3'
          drawMini(top)
        }
      }else{
        const probs=[0.2,0.5,0.1,0.12,0.08]
        const P = FORMATIONS.map((l,i)=>({label:l, prob:probs[i]}))
        topUI('#frm', P); drawMini('4-3-3')
      }
    }
    const dt = performance.now()-t0; lat.textContent = dt.toFixed(1)
    requestAnimationFrame(loop)
  }

  function drawPose(ctx, pose){
    ctx.strokeStyle='rgba(59,130,246,0.9)'; ctx.lineWidth=3
    const kp = pose.keypoints || pose.keypoints2D || []
    kp.forEach(k=>{
      if(k.score==null || k.score>0.4){
        ctx.beginPath(); ctx.arc(k.x, k.y, 4, 0, Math.PI*2); ctx.fillStyle='rgba(59,130,246,0.9)'; ctx.fill()
      }
    })
  }
  function drawMini(formation){
    const w=mini.width, h=mini.height
    mctx.clearRect(0,0,w,h)
    mctx.fillStyle='#0b5'; mctx.fillRect(0,0,w,h)
    mctx.strokeStyle='#fff'; mctx.lineWidth=2
    mctx.strokeRect(5,5,w-10,h-10)
    mctx.beginPath(); mctx.moveTo(w/2,5); mctx.lineTo(w/2,h-5); mctx.stroke()
    const MAP = {'4-4-2':[4,4,2],'4-3-3':[4,3,3],'3-5-2':[3,5,2],'4-2-3-1':[4,2,3,1],'3-4-3':[3,4,3]}
    const lines = MAP[formation] || [4,3,3]
    const rows = lines.length, marginY=30, usable=h-60
    for(let r=0;r<rows;r++){
      const y = marginY + r*(usable/(rows-1||1))
      const n = lines[r]
      for(let i=0;i<n;i++){
        const x = 40 + i*((w-80)/(n-1||1))
        mctx.beginPath(); mctx.arc(x,y,6,0,Math.PI*2); mctx.fillStyle='#fff'; mctx.fill()
      }
    }
  }

  $('#frm-start').onclick = ()=>{ running=true; loop() }
  $('#frm-stop').onclick  = ()=>{ running=false }
  ;(async()=>{ setStatus(statusEl,'loading'); await initCamera(); await loadModel() })()

  return {}
})()
