import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, addDoc, updateDoc, query, where, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { dbCommandes } from '../firebaseCommandes.js'

const USER_COLORS = { jose:'#4fc3f7', vivian:'#6ee7a0', valentin:'#ffb74d', marius:'#f472b6', marius_c:'#f472b6', damien:'#a78bfa', damien_c:'#a78bfa' }

function fmtDuration(s) {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60
  return h>0 ? `${h}h${String(m).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}
function fmtMin(min) {
  if (!min) return null
  const h=Math.floor(min/60), m=min%60
  return h>0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`
}
function fmtTime(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('fr-CH',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'})
}
function today() { return new Date().toISOString().split('T')[0] }

function useSpeech(onResult) {
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert("Reconnaissance vocale non disponible"); return }
    const rec = new SR()
    rec.lang='fr-FR'; rec.continuous=false; rec.interimResults=false
    rec.onresult = e => onResult(Array.from(e.results).map(r=>r[0].transcript).join(' '))
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start(); recRef.current=rec; setListening(true)
  }
  const stop = () => { recRef.current?.stop(); setListening(false) }
  return { listening, start, stop }
}

// ─── NOTE OVERLAY ──────────────────────────────────────────────────────────────
function NoteOverlay({ color, title, subtitle, onConfirm }) {
  const [text, setText] = useState('')
  const speech = useSpeech(t => setText(prev => prev ? prev+' '+t : t))
  return (
    <div style={s.overlay}>
      <div style={s.noteBox}>
        <p style={s.noteTitle}>{title}</p>
        {subtitle && <p style={s.noteSub}>{subtitle}</p>}
        <textarea style={s.noteTA} placeholder="Décris ce qui a été fait, pièces changées, anomalies..." value={text} onChange={e=>setText(e.target.value)} autoFocus rows={5}/>
        <button style={{...s.voiceBtn, background:speech.listening?color+'30':'rgba(255,255,255,0.07)', borderColor:speech.listening?color:'rgba(255,255,255,0.12)', color:speech.listening?color:'#ccc'}} onClick={speech.listening?speech.stop:speech.start}>
          {speech.listening ? '⏹  Arrêter' : '🎤  Dicter'}
        </button>
        {speech.listening && <p style={{...s.listenLabel, color}}>● Écoute...</p>}
        <div style={s.noteActions}>
          <button style={s.skipBtn} onClick={()=>onConfirm('')}>Passer</button>
          <button style={{...s.okBtn, background:color, color:'#000'}} onClick={()=>onConfirm(text)}>✓  Valider</button>
        </div>
      </div>
    </div>
  )
}

// ─── WAITING OVERLAY ───────────────────────────────────────────────────────────
function WaitingOverlay({ color, or, onConfirm, onCancel }) {
  const [motif, setMotif] = useState('')
  const MOTIFS = ['En attente de pièces','Expertise en cours','Client injoignable','Accord assurance attendu','Restauration','Autre']
  return (
    <div style={s.overlay}>
      <div style={s.noteBox}>
        <p style={s.noteTitle}>Mettre en attente</p>
        <p style={s.noteSub}>OR {or.noFT} · {or.client}</p>
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {MOTIFS.map(m=>(
            <button key={m} style={{padding:'12px 14px',borderRadius:9,border:'1px solid',background:motif===m?color+'20':'rgba(255,255,255,0.04)',borderColor:motif===m?color:'#2a2a2a',color:motif===m?color:'#aaa',fontSize:14,fontWeight:600,cursor:'pointer',textAlign:'left'}} onClick={()=>setMotif(m)}>{m}</button>
          ))}
        </div>
        <div style={s.noteActions}>
          <button style={s.skipBtn} onClick={onCancel}>Annuler</button>
          <button style={{...s.okBtn, background:color, color:'#000'}} onClick={()=>onConfirm(motif)}>Mettre en attente</button>
        </div>
      </div>
    </div>
  )
}

// ─── PHOTO UPLOADER ────────────────────────────────────────────────────────────
function PhotoUploader({ or, color, onClose }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState([])
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const CLOUD = 'dpej0wnet', PRESET = 'challenge_atelier'

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true); setError('')
    try {
      const results = []
      for (const file of files) {
        const compressed = await compressImage(file, 1600, 0.82)
        const fd = new FormData()
        fd.append('file', compressed); fd.append('upload_preset', PRESET); fd.append('folder', `challenge-atelier/${today()}`)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {method:'POST',body:fd})
        if (!res.ok) throw new Error('Upload échoué')
        const data = await res.json()
        results.push({ url:data.secure_url, publicId:data.public_id, name:file.name })
      }
      await addDoc(collection(db,'photos'), { orId:or.id, noFT:or.noFT, client:or.client, vehicule:or.vehicule, dateKey:today(), photos:results, uploadedAt:serverTimestamp() })
      setUploaded(results)
    } catch(err) { setError('Erreur : ' + err.message) }
    setUploading(false)
  }

  return (
    <div style={s.overlay}>
      <div style={{...s.noteBox, gap:12}}>
        <p style={s.noteTitle}>📷 Photos</p>
        <p style={s.noteSub}>OR {or.noFT} · {or.client}</p>
        {uploaded.length===0 ? (
          <>
            <div style={{border:'2px dashed #2a2a2a',borderRadius:12,padding:'32px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:12,cursor:'pointer',background:'#0d0d0d'}} onClick={()=>!uploading&&inputRef.current?.click()}>
              {uploading ? <><div style={{...s.spinner,borderTopColor:color}}/><span style={{color:'#aaa'}}>Upload...</span></>
                : <><span style={{fontSize:40}}>📷</span><span style={{fontSize:16,fontWeight:700,color:'#fff'}}>Prendre une photo</span><span style={{fontSize:12,color:'#555'}}>ou galerie</span></>}
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFiles} style={{display:'none'}}/>
            {error && <p style={{color:'#e84747',fontSize:13}}>{error}</p>}
          </>
        ) : (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <span style={{fontSize:28}}>✓</span>
            <p style={{color:'#47e88a',fontWeight:700,fontSize:16,margin:0}}>{uploaded.length} photo{uploaded.length>1?'s':''} ajoutée{uploaded.length>1?'s':''}</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
              {uploaded.map((p,i)=><img key={i} src={p.url} alt="" style={{width:80,height:80,objectFit:'cover',borderRadius:8,border:'1px solid #2a2a2a'}}/>)}
            </div>
          </div>
        )}
        <button style={s.skipBtn} onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

async function compressImage(file, maxPx, quality) {
  return new Promise(resolve=>{
    const img=new Image(), url=URL.createObjectURL(file)
    img.onload=()=>{
      let w=img.width, h=img.height
      if(w>maxPx||h>maxPx){if(w>h){h=Math.round(h*maxPx/w);w=maxPx}else{w=Math.round(w*maxPx/h);h=maxPx}}
      const c=document.createElement('canvas'); c.width=w; c.height=h
      c.getContext('2d').drawImage(img,0,0,w,h)
      c.toBlob(blob=>{URL.revokeObjectURL(url);resolve(blob)},'image/jpeg',quality)
    }
    img.src=url
  })
}

// ─── EDIT NOTE FORM ────────────────────────────────────────────────────────────
function EditNoteForm({ initial, color, onSave, onCancel }) {
  const [text, setText] = useState(initial || '')
  const speech = useSpeech(t => setText(prev => prev ? prev+' '+t : t))
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <textarea style={s.noteTA} value={text} onChange={e=>setText(e.target.value)} rows={4} autoFocus/>
      <button style={{...s.voiceBtn, background:speech.listening?color+'30':'rgba(255,255,255,0.07)', borderColor:speech.listening?color:'rgba(255,255,255,0.12)', color:speech.listening?color:'#ccc'}} onClick={speech.listening?speech.stop:speech.start}>
        {speech.listening ? '⏹ Arrêter' : '🎤 Dicter'}
      </button>
      <div style={s.noteActions}>
        <button style={s.skipBtn} onClick={onCancel}>Annuler</button>
        <button style={{...s.okBtn, background:color, color:'#000'}} onClick={()=>onSave(text)}>Enregistrer</button>
      </div>
    </div>
  )
}

// ─── CREATE OR FORM ────────────────────────────────────────────────────────────
const CARROSSERIE_KW_M = ['carrosserie','sinistre','peinture','pare-choc','aile','capot','portière','vitre','pare-brise','tôle','tole']

async function createManualOR(fields, user) {
  const travaux = fields.travaux || ''
  await addDoc(collection(db,'ors'), {
    noFT: fields.noFT || `MANUEL-${Date.now()}`,
    client: fields.client || '(sans client)',
    vehicule: fields.vehicule || '', plaques: fields.plaques || '',
    travaux: travaux.slice(0,300), mécano: fields.mécano || '',
    dateKey: today(), arrivee: today(), depart: '',
    isCarrosserie: CARROSSERIE_KW_M.some(k=>travaux.toLowerCase().includes(k)),
    sansFT: !fields.noFT,
    status: fields.waiting ? 'waiting' : 'active',
    waitingMotif: fields.waiting ? fields.waitingMotif : '',
    waitingSince: fields.waiting ? new Date().toISOString() : null,
    retired: false, activeMechanics: [],
    space: user?.space || 'challenge',
    importedAt: new Date().toISOString(), isManual: true, createdBy: user?.name || '',
  })
}

function CreateORForm({ color, user, onSave, onCancel }) {
  const [f, setF] = useState({ noFT:'', client:'', vehicule:'', plaques:'', travaux:'', mécano:'', waiting:false, waitingMotif:'' })
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const MOTIFS_W = ['En attente de pièces','Expertise en cours','Client injoignable','Accord assurance attendu','Restauration','Autre']
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12,maxHeight:'70vh',overflowY:'auto'}}>
      {[{key:'noFT',label:'N° FT (optionnel)',ph:'Ex : 19583'},{key:'client',label:'Client *',ph:'Nom du client'},{key:'vehicule',label:'Véhicule',ph:'Ex : VW Golf VII'},{key:'plaques',label:'Plaques',ph:'Ex : FR 123456'},{key:'mécano',label:'Mécanicien assigné',ph:'José, Vivian...'}].map(({key,label,ph})=>(
        <div key={key} style={{display:'flex',flexDirection:'column',gap:5}}>
          <label style={{fontSize:11,letterSpacing:'0.12em',color:'#555',fontFamily:'var(--font-mono)'}}>{label}</label>
          <input style={{background:'#0d0d0d',border:'1px solid #2a2a2a',borderRadius:8,color:'#fff',fontSize:16,padding:'11px 14px',outline:'none'}} placeholder={ph} value={f[key]} onChange={e=>set(key,e.target.value)}/>
        </div>
      ))}
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        <label style={{fontSize:11,letterSpacing:'0.12em',color:'#555',fontFamily:'var(--font-mono)'}}>TRAVAUX</label>
        <textarea style={{background:'#0d0d0d',border:'1px solid #2a2a2a',borderRadius:8,color:'#fff',fontSize:15,padding:'11px 14px',outline:'none',resize:'none',lineHeight:1.5}} placeholder="Description..." value={f.travaux} onChange={e=>set('travaux',e.target.value)} rows={3}/>
      </div>
      <button style={{padding:'12px',background:f.waiting?'rgba(136,136,136,0.15)':'rgba(255,255,255,0.04)',border:`1px solid ${f.waiting?'#555':'#2a2a2a'}`,borderRadius:10,color:f.waiting?'#aaa':'#666',fontSize:14,fontWeight:600,cursor:'pointer',textAlign:'left'}} onClick={()=>set('waiting',!f.waiting)}>
        {f.waiting ? '⏸ Créer en attente ✓' : '⏸ Créer directement en attente'}
      </button>
      {f.waiting && MOTIFS_W.map(m=>(
        <button key={m} style={{padding:'10px 14px',borderRadius:9,border:'1px solid',background:f.waitingMotif===m?color+'20':'rgba(255,255,255,0.03)',borderColor:f.waitingMotif===m?color:'#2a2a2a',color:f.waitingMotif===m?color:'#aaa',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'left'}} onClick={()=>set('waitingMotif',m)}>{m}</button>
      ))}
      <div style={{display:'flex',gap:8,paddingTop:4}}>
        <button style={s.skipBtn} onClick={onCancel}>Annuler</button>
        <button style={{...s.okBtn, background:color, color:'#000'}} onClick={()=>{ if(!f.client.trim()){alert('Client requis');return}; onSave(f) }}>Créer l'OR</button>
      </div>
    </div>
  )
}

// ─── OR CARD ───────────────────────────────────────────────────────────────────
function ORCard({ or, user, activeOR, elapsed, orTotals, onSelect }) {
  const color = USER_COLORS[user.id] || '#e8c547'
  const isMine = activeOR?.orId===or.id
  const others = (or.activeMechanics||[]).filter(m=>m!==user.id)
  const totalDisplay = fmtMin((orTotals[or.id]||0)+(isMine?Math.floor(elapsed/60):0))
  const isWaiting = or.status==='waiting'
  const isCompleted = or.status==='completed'

  return (
    <button style={{
      ...s.card,
      borderColor: isMine?color:isWaiting?'#555':or.retired?'#e84747':isCompleted?'#47e88a22':others.length>0?'#555':'#222',
      background: isMine?color+'12':isWaiting?'rgba(255,255,255,0.03)':or.retired?'rgba(232,71,71,0.05)':'#111',
    }} onClick={()=>onSelect(or)}>
      {isMine && <div style={{...s.cardLine, background:color}}/>}
      {isWaiting&&!isMine && <div style={{...s.cardLine, background:'#555'}}/>}
      {isCompleted && <div style={{...s.cardLine, background:'#47e88a'}}/>}
      <div style={s.cardInner}>
        <div style={s.cardRow1}>
          <span style={{...s.orLabel, color:or.sansFT?'#e84747':'#555'}}>
            {or.sansFT ? 'Sans FT ⚠' : `OR ${or.noFT}`}
          </span>
          <div style={s.cardBadges}>
            {isCompleted && <span style={{fontSize:10,fontWeight:700,color:'#47e88a',background:'rgba(71,232,138,0.12)',padding:'2px 7px',borderRadius:20}}>✓ Terminé</span>}
            {isMine && <span style={{...s.activeBadge, background:color, color:'#000'}}>{fmtDuration(elapsed)}</span>}
            {others.length>0&&!isMine && <span style={s.otherBadge}>{others.map(m=>m[0].toUpperCase()).join('')}</span>}
            {totalDisplay && <span style={{...s.timeBadge, color:isMine?color:'#aaa'}}>{totalDisplay}</span>}
          </div>
        </div>
        <div style={s.clientName}>{or.client}</div>
        <div style={s.vehicleRow}>
          <span style={s.vehicleText}>{or.vehicule}</span>
          {or.plaques && <span style={s.platesText}>{or.plaques}</span>}
        </div>
        {or.travaux && <div style={s.travauxBox}>{or.travaux.slice(0,110)}{or.travaux.length>110?'…':''}</div>}
        {isWaiting&&or.waitingMotif && <div style={s.waitingTag}>⏸ {or.waitingMotif}</div>}
        {or.retired && <div style={s.retiredTag}>⚠ Retiré du planning</div>}
        {isMine && <div style={{...s.openHint, color}}>● Chrono en cours</div>}
      </div>
    </button>
  )
}

// ─── OR DETAIL ─────────────────────────────────────────────────────────────────
function ORDetail({ or, user, activeOR, elapsed, onBack, onStart, onStop, onToggleComplete }) {
  const color = USER_COLORS[user.id] || '#e8c547'
  const isMine = activeOR?.orId===or.id
  const isWaiting = or.status==='waiting'
  const isCompleted = or.status==='completed'
  const [orPointages, setOrPointages] = useState([])
  const [orPhotos, setOrPhotos] = useState([])
  const [commandes, setCommandes] = useState([])
  const [km, setKm] = useState(or.km || '')
  const [kmSaved, setKmSaved] = useState(!!or.km)
  const [modal, setModal] = useState(null)
  const [editingNote, setEditingNote] = useState(null)

  useEffect(()=>{
    const q = query(collection(db,'pointages'), where('orId','==',or.id))
    return onSnapshot(q, snap=>{
      const data = snap.docs.map(d=>({id:d.id,...d.data()}))
      data.sort((a,b)=>{ const ta=a.start?.toDate?a.start.toDate():new Date(0); const tb=b.start?.toDate?b.start.toDate():new Date(0); return ta-tb })
      setOrPointages(data)
    })
  },[or.id])

  useEffect(()=>{
    const q = query(collection(db,'photos'), where('orId','==',or.id))
    return onSnapshot(q, snap=>{
      const all=[]
      snap.docs.forEach(d=>{ const data=d.data(); (data.photos||[]).forEach(p=>all.push({...p,docId:d.id})) })
      setOrPhotos(all)
    })
  },[or.id])

  useEffect(()=>{
    const noFT = or.noFT
    if (!noFT || noFT.startsWith('SANS-FT') || noFT.startsWith('MANUEL')) return
    const q = query(collection(dbCommandes,'orders'))
    return onSnapshot(q, snap=>{
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
      const matched = all.filter(o=>{
        if (o.status==='invoiced') return false
        if (!o.noFT) return false
        return String(o.noFT).trim()===String(noFT).trim()
      })
      matched.sort((a,b)=>{ const ta=a.ts?.toDate?a.ts.toDate():new Date(0); const tb=b.ts?.toDate?b.ts.toDate():new Date(0); return tb-ta })
      setCommandes(matched)
    })
  },[or.noFT])

  const saveKm = async () => {
    if (!km || !or.id || or.id.startsWith('internal_')) return
    await updateDoc(doc(db,'ors',or.id), { km: parseInt(km) })
    setKmSaved(true)
  }

  const setActive = async () => {
    await updateDoc(doc(db,'ors',or.id), { status:'active', waitingMotif:'', waitingSince:null })
  }

  const addNote = async (text) => {
    if (!text.trim()) return
    await addDoc(collection(db,'pointages'), {
      mechanic:user.id, mechanicName:user.name, orId:or.id, noFT:or.noFT,
      client:or.client, vehicule:or.vehicule, dateKey:today(),
      start:serverTimestamp(), end:serverTimestamp(), duration_min:0, note:text, isStandaloneNote:true,
    })
  }

  const updateNote = async (id, text) => {
    await updateDoc(doc(db,'pointages',id), { note: text })
    setEditingNote(null)
  }

  const deletePhoto = async (docId, photoUrl, allPhotos) => {
    const remaining = allPhotos.filter(p=>p.url!==photoUrl)
    if (remaining.length===0) {
      const {deleteDoc:del, doc:fDoc} = await import('firebase/firestore')
      await del(fDoc(db,'photos',docId))
    } else {
      await updateDoc(doc(db,'photos',docId), {photos:remaining})
    }
  }

  const totalMin = orPointages.filter(p=>p.end&&!p.isStandaloneNote).reduce((s,p)=>s+(p.duration_min||0),0)
  const totalDisplay = fmtMin(totalMin+(isMine?Math.floor(elapsed/60):0))

  return (
    <div style={s.detail}>
      <div style={s.detailBar}>
        <button style={s.backBtn} onClick={onBack}>← Retour</button>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {isWaiting && <span style={s.waitingChip}>⏸ En attente</span>}
          {isCompleted && <span style={{...s.waitingChip, color:'#47e88a', background:'rgba(71,232,138,0.1)'}}>✓ Terminé</span>}
          {totalDisplay && <span style={{...s.totalChip, color, borderColor:color+'44'}}>{totalDisplay}</span>}
        </div>
      </div>

      {/* OR info */}
      <div style={{...s.orCard, borderColor:isMine?color:isCompleted?'#47e88a44':'#222'}}>
        {isMine && <div style={{...s.orCardAccent, background:color}}/>}
        {isCompleted && <div style={{...s.orCardAccent, background:'#47e88a'}}/>}
        <div style={s.orCardBody}>
          <div style={s.orCardMeta}>
            <span style={{...s.orCardNum, color:or.sansFT?'#e84747':'#888'}}>{or.sansFT?'Sans FT ⚠':`OR ${or.noFT}`}</span>
            {or.mécano && <span style={s.orCardAssign}>→ {or.mécano}</span>}
          </div>
          <div style={s.orCardClient}>{or.client}</div>
          {or.vehicule && <div style={s.orCardVehicle}>{or.vehicule}{or.plaques&&<span style={s.orCardPlates}> · {or.plaques}</span>}</div>}
          {or.travaux && <div style={s.orCardTravaux}><div style={s.orCardTrLabel}>À FAIRE</div><div style={s.orCardTrText}>{or.travaux}</div></div>}
          {isWaiting && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #1e1e1e'}}><div style={{fontSize:10,letterSpacing:'0.18em',color:'#666',fontFamily:'var(--font-mono)'}}>EN ATTENTE</div>{or.waitingMotif&&<div style={{fontSize:15,color:'#aaa',fontWeight:600}}>{or.waitingMotif}</div>}</div>}
        </div>
      </div>

      {/* KM */}
      <div style={s.kmBlock}>
        <span style={s.kmLabel}>KILOMÉTRAGE</span>
        <div style={s.kmRow}>
          <input style={{...s.kmInput, borderColor:kmSaved?color+'60':'#2a2a2a'}} type="number" placeholder="Ex : 153 310" value={km} onChange={e=>{setKm(e.target.value);setKmSaved(false)}} onBlur={saveKm}/>
          {kmSaved ? <span style={{...s.kmStatus,color}}>✓</span> : km?<button style={{...s.kmSaveBtn,background:color,color:'#000'}} onClick={saveKm}>OK</button>:null}
        </div>
      </div>

      {/* GO / STOP */}
      <div style={s.timerZone}>
        {isMine ? (
          <>
            <div style={{...s.timerBig, color}}>{fmtDuration(elapsed)}</div>
            <button style={{...s.stopBig, borderColor:color, color}} onClick={()=>setModal('stop')}>■  ARRÊTER LE TIMBRAGE</button>
          </>
        ) : isWaiting ? (
          <button style={{...s.goBig, background:'#222', color:'#aaa'}} onClick={setActive}>▶  REPRENDRE LE DOSSIER</button>
        ) : isCompleted ? null : (
          <button style={{...s.goBig, background:color}} onClick={onStart}>▶  DÉMARRER LE TIMBRAGE</button>
        )}
      </div>

      {/* Actions */}
      <div style={s.actionsRow}>
        <button style={s.actionBtn} onClick={()=>setModal('note')}>📝 Note</button>
        <button style={{...s.actionBtn, position:'relative'}} onClick={()=>setModal('photo')}>
          📷 Photos
          {orPhotos.length>0 && <span style={{...s.photoBadge, background:color, color:'#000'}}>{orPhotos.length}</span>}
        </button>
        {!isCompleted && <button style={{...s.actionBtn, color:isWaiting?'#47e88a':'#e84747', borderColor:isWaiting?'rgba(71,232,138,0.2)':'rgba(232,71,71,0.2)'}} onClick={isWaiting?setActive:()=>setModal('waiting')}>
          {isWaiting ? '▶ Réactiver' : '⏸ Attente'}
        </button>}
      </div>

      {/* Terminé */}
      <div style={{padding:'0 14px 12px'}}>
        <button style={{width:'100%',padding:'14px',border:'1px solid',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',
          background:isCompleted?'rgba(71,232,138,0.12)':'rgba(255,255,255,0.04)',
          borderColor:isCompleted?'#47e88a':'#2a2a2a',
          color:isCompleted?'#47e88a':'#888',
        }} onClick={()=>onToggleComplete(or)}>
          {isCompleted ? '✓ Travaux terminés — cliquer pour réouvrir' : '○ Marquer comme terminé'}
        </button>
      </div>

      {/* Photos */}
      {orPhotos.length>0 && (
        <div style={s.photoPreview}>
          <div style={s.sectionLabel}>PHOTOS · {orPhotos.length}</div>
          <div style={s.thumbRow}>
            {orPhotos.map((p,i)=>(
              <div key={i} style={{position:'relative',flexShrink:0}}>
                <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" style={s.thumbSmall}/></a>
                <button style={s.thumbDelete} onClick={e=>{e.preventDefault();if(confirm('Supprimer ?'))deletePhoto(p.docId,p.url,orPhotos)}}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commandes */}
      {commandes.length>0 && (
        <div style={s.history}>
          <div style={s.historyTitle}>COMMANDES PIÈCES · {commandes.length}</div>
          {commandes.map(cmd=>{
            const supplier = cmd.supplier==='Autre'?(cmd.supplierOther||'Autre'):(cmd.supplier||'—')
            const total = (cmd.parts||[]).reduce((s,p)=>s+parseFloat(p.price||0)*parseInt(p.qty||1),0)
            const statusColor = cmd.status==='invoiced'?'#47e88a':cmd.status==='ordered'?'#e8c547':'#888'
            const statusLabel = cmd.status==='invoiced'?'Facturé':cmd.status==='ordered'?'Commandé':cmd.status||'—'
            return (
              <div key={cmd.id} style={{borderBottom:'1px solid #161616',padding:'11px 16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                  <div>
                    <span style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.06em'}}>{cmd.mechanic||'—'}</span>
                    <span style={{fontSize:14,fontWeight:700,color:'#fff',marginLeft:8}}>{supplier}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                    <span style={{fontSize:11,fontWeight:700,color:statusColor,border:`1px solid ${statusColor}44`,padding:'1px 7px',borderRadius:20}}>{statusLabel}</span>
                    {total>0 && <span style={{fontSize:12,color:'#aaa',fontFamily:'var(--font-mono)'}}>{total.toFixed(2)} CHF</span>}
                  </div>
                </div>
                {(cmd.parts||[]).map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#bbb',padding:'2px 0'}}><span>{p.description}</span><span style={{color:'#666',fontFamily:'var(--font-mono)'}}>×{p.qty||1}</span></div>)}
              </div>
            )
          })}
        </div>
      )}

      {/* Historique */}
      {orPointages.length>0 && (
        <div style={s.history}>
          <div style={s.historyTitle}>HISTORIQUE</div>
          {orPointages.map(p=>(
            <div key={p.id} style={s.histRow}>
              <div style={s.histLeft}>
                <div style={s.histTop}>
                  <span style={{...s.histName, color:USER_COLORS[p.mechanic]||'#ccc'}}>{p.mechanicName}</span>
                  <span style={s.histTime}>{p.isStandaloneNote?`📝 ${fmtTime(p.start)}`:`${fmtTime(p.start)}${p.end?` → ${fmtTime(p.end)}`:' → en cours'}`}</span>
                </div>
                {p.note && (
                  <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                    <div style={s.histNote}>{p.note}</div>
                    <button style={s.editNoteBtn} onClick={()=>setEditingNote({id:p.id,text:p.note})}>✏️</button>
                  </div>
                )}
              </div>
              <div style={{...s.histDur, color:p.end===null?(USER_COLORS[p.mechanic]||color):'#aaa'}}>
                {p.isStandaloneNote?'':p.end===null?'⏱':fmtMin(p.duration_min)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal==='stop' && <NoteOverlay color={color} title="Rapport de fin" subtitle={`OR ${or.noFT} · ${or.client}`} onConfirm={note=>{onStop(note);setModal(null)}}/>}
      {modal==='note' && <NoteOverlay color={color} title="Ajouter une note" subtitle={`OR ${or.noFT} · ${or.client}`} onConfirm={async text=>{await addNote(text);setModal(null)}}/>}
      {modal==='photo' && <PhotoUploader or={or} color={color} onClose={()=>setModal(null)}/>}
      {modal==='waiting' && <WaitingOverlay color={color} or={or} onConfirm={async motif=>{await updateDoc(doc(db,'ors',or.id),{status:'waiting',waitingMotif:motif||'',waitingSince:serverTimestamp()});setModal(null)}} onCancel={()=>setModal(null)}/>}
      {modal==='createOR' && <div style={s.overlay}><div style={{...s.noteBox,maxHeight:'90vh',overflowY:'auto'}}><p style={s.noteTitle}>Créer un OR</p><CreateORForm color={color} user={user} onSave={async f=>{await createManualOR(f,user);setModal(null)}} onCancel={()=>setModal(null)}/></div></div>}
      {editingNote && <div style={s.overlay}><div style={s.noteBox}><p style={s.noteTitle}>Modifier la note</p><EditNoteForm initial={editingNote.text} color={color} onSave={text=>updateNote(editingNote.id,text)} onCancel={()=>setEditingNote(null)}/></div></div>}
    </div>
  )
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function MechanicScreen({ user, onLogout, onDashboard }) {
  const [todayOrs, setTodayOrs] = useState([])
  const [waitingOrs, setWaitingOrs] = useState([])
  const [completedOrs, setCompletedOrs] = useState([])
  const [orTotals, setOrTotals] = useState({})
  const [activeOR, setActiveOR] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [selectedOR, setSelectedOR] = useState(null)
  const [tab, setTab] = useState('today')
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const scrollRef = useRef(null)
  const scrollPos = useRef(0)
  const color = USER_COLORS[user.id] || '#e8c547'
  const userSpace = user.space || 'challenge'

  const spaceFilter = (data) => {
    if (userSpace === 'all') return data
    if (user.role === 'carrossier') data = data.filter(o=>o.isCarrosserie)
    else data = data.filter(o=>!o.isCarrosserie)
    return data.filter(o => !o.space || o.space === userSpace)
  }

  // Today's ORs
  useEffect(()=>{
    const q = query(collection(db,'ors'), where('dateKey','==',today()))
    return onSnapshot(q, snap=>{
      let data = snap.docs.map(d=>({id:d.id,...d.data()}))
      data = spaceFilter(data).filter(o=>o.status!=='waiting'&&o.status!=='completed')
      data.sort((a,b)=>(a.activeMechanics?.length>0?-1:0)-(b.activeMechanics?.length>0?-1:0))
      setTodayOrs(data)
      setSelectedOR(prev=>prev?(data.find(o=>o.id===prev.id)||prev):null)
      setLoading(false)
    })
  },[userSpace, user.role])

  // Waiting ORs
  useEffect(()=>{
    const q = query(collection(db,'ors'), where('status','==','waiting'))
    return onSnapshot(q, snap=>{
      let data = snap.docs.map(d=>({id:d.id,...d.data()}))
      data = spaceFilter(data)
      setWaitingOrs(data)
    })
  },[userSpace, user.role])

  // Completed ORs
  useEffect(()=>{
    const q = query(collection(db,'ors'), where('status','==','completed'))
    return onSnapshot(q, snap=>{
      let data = snap.docs.map(d=>({id:d.id,...d.data()}))
      data = spaceFilter(data)
      data.sort((a,b)=>new Date(b.completedAt||0)-new Date(a.completedAt||0))
      setCompletedOrs(data)
    })
  },[userSpace, user.role])

  // Totals
  useEffect(()=>{
    const q = query(collection(db,'pointages'))
    return onSnapshot(q, snap=>{
      const t={}
      snap.docs.forEach(d=>{ const p=d.data(); if(p.duration_min&&p.orId&&!p.isStandaloneNote) t[p.orId]=(t[p.orId]||0)+p.duration_min })
      setOrTotals(t)
    })
  },[])

  // Recover active
  useEffect(()=>{
    getDocs(query(collection(db,'pointages'), where('mechanic','==',user.id), where('dateKey','==',today()), where('end','==',null)))
      .then(snap=>{ if(!snap.empty){ const d=snap.docs[0],data=d.data(); setActiveOR({orId:data.orId,pointageId:d.id,startTs:data.start?.toDate?data.start.toDate():new Date(data.start)}) }})
  },[user.id])

  // Timer
  useEffect(()=>{
    if(activeOR) timerRef.current=setInterval(()=>setElapsed(Math.floor((Date.now()-activeOR.startTs.getTime())/1000)),1000)
    else { clearInterval(timerRef.current); setElapsed(0) }
    return ()=>clearInterval(timerRef.current)
  },[activeOR])

  const startOR = async (or) => {
    if(activeOR) {
      const dur=Math.round((new Date()-activeOR.startTs)/60000)
      await updateDoc(doc(db,'pointages',activeOR.pointageId),{end:serverTimestamp(),duration_min:dur,note:''})
      const prev=[...todayOrs,...waitingOrs].find(o=>o.id===activeOR.orId)
      if(prev) await updateDoc(doc(db,'ors',activeOR.orId),{activeMechanics:(prev.activeMechanics||[]).filter(m=>m!==user.id)})
    }
    if(or.status==='waiting') await updateDoc(doc(db,'ors',or.id),{status:'active',waitingMotif:'',waitingSince:null})
    const startTs=new Date()
    const r=await addDoc(collection(db,'pointages'),{mechanic:user.id,mechanicName:user.name,orId:or.id,noFT:or.noFT,client:or.client,vehicule:or.vehicule,dateKey:today(),start:serverTimestamp(),end:null,duration_min:null,note:''})
    await updateDoc(doc(db,'ors',or.id),{activeMechanics:[...(or.activeMechanics||[]).filter(m=>m!==user.id),user.id]})
    setActiveOR({orId:or.id,pointageId:r.id,startTs})
  }

  const stopOR = async (note) => {
    if(!activeOR) return
    const dur=Math.round((new Date()-activeOR.startTs)/60000)
    await updateDoc(doc(db,'pointages',activeOR.pointageId),{end:serverTimestamp(),duration_min:dur,note:note||''})
    const or=[...todayOrs,...waitingOrs].find(o=>o.id===activeOR.orId)
    if(or) await updateDoc(doc(db,'ors',activeOR.orId),{activeMechanics:(or.activeMechanics||[]).filter(m=>m!==user.id)})
    setActiveOR(null)
  }

  const toggleComplete = async (or) => {
    const done = or.status==='completed'
    await updateDoc(doc(db,'ors',or.id),{ status:done?'active':'completed', completedAt:done?null:new Date().toISOString() })
  }

  const allOrs = tab==='today' ? todayOrs : tab==='waiting' ? waitingOrs : completedOrs
  const filteredOrs = search.trim() ? allOrs.filter(o=>{
    const q=search.toLowerCase()
    return (o.client||'').toLowerCase().includes(q)||(o.vehicule||'').toLowerCase().includes(q)||(o.plaques||'').toLowerCase().includes(q)||String(o.noFT||'').includes(q)
  }) : allOrs
  const activeOrData = [...todayOrs,...waitingOrs,...completedOrs].find(o=>o.id===activeOR?.orId)

  const openOR = (or) => { scrollPos.current = scrollRef.current?.scrollTop||0; setSelectedOR(or) }
  const closeOR = () => { setSelectedOR(null); setTimeout(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollPos.current },50) }

  return (
    <div style={s.root}>
      <div style={s.header}>
        {!selectedOR && <div style={{...s.avatar, background:color+'25', color}}>{user.name[0]}</div>}
        <div style={s.hCenter}>
          {selectedOR
            ? <span style={s.hTitle}>{selectedOR.client}</span>
            : <><span style={{...s.hName,color}}>{user.name}</span><span style={s.hSub}>{user.role==='carrossier'?'Carrosserie':userSpace==='gt'?'GT · Bulle':'Atelier'} · {new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long'})}</span></>
          }
        </div>
        {!selectedOR && <button style={s.iconBtn} onClick={onDashboard}>⊞</button>}
        {!selectedOR && <button style={s.iconBtn} onClick={onLogout}>↩</button>}
      </div>

      {!selectedOR && activeOR && activeOrData && (
        <button style={{...s.miniBanner, background:color+'15', borderColor:color+'60'}} onClick={()=>openOR(activeOrData)}>
          <span style={{...s.miniTimer,color}}>⏱ {fmtDuration(elapsed)}</span>
          <span style={s.miniInfo}><strong style={{color:'#fff'}}>{activeOrData.client}</strong>{activeOrData.vehicule?' · '+activeOrData.vehicule:''}</span>
          <span style={{color,fontSize:18,fontWeight:700}}>→</span>
        </button>
      )}

      {!selectedOR && (
        <>
          <div style={s.tabs}>
            <button style={{...s.tab, color:tab==='today'?'#fff':'#555', borderBottom:`2px solid ${tab==='today'?color:'transparent'}`}} onClick={()=>setTab('today')}>
              Aujourd'hui <span style={s.tabCount}>{todayOrs.length}</span>
            </button>
            <button style={{...s.tab, color:tab==='waiting'?'#fff':'#555', borderBottom:`2px solid ${tab==='waiting'?'#888':'transparent'}`}} onClick={()=>setTab('waiting')}>
              En attente {waitingOrs.length>0&&<span style={{...s.tabCount,background:'#333',color:'#aaa'}}>{waitingOrs.length}</span>}
            </button>
            <button style={{...s.tab, color:tab==='completed'?'#fff':'#555', borderBottom:`2px solid ${tab==='completed'?'#47e88a':'transparent'}`}} onClick={()=>setTab('completed')}>
              Terminés {completedOrs.length>0&&<span style={{...s.tabCount,background:'rgba(71,232,138,0.15)',color:'#47e88a'}}>{completedOrs.length}</span>}
            </button>
          </div>

          <div style={s.searchWrap}>
            <input style={s.searchInput} placeholder="🔍  Client, véhicule, N° FT..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button style={s.searchClear} onClick={()=>setSearch('')}>✕</button>}
          </div>

          <div ref={scrollRef} style={s.list}>
            {loading && <div style={s.empty}>Chargement...</div>}
            {!loading && filteredOrs.length===0 && <div style={s.empty}>{search?`Aucun résultat pour "${search}"`:tab==='today'?"Aucun OR pour aujourd'hui":tab==='waiting'?'Aucun dossier en attente':'Aucun dossier terminé'}</div>}
            {!loading && filteredOrs.map(or=>(
              <ORCard key={or.id} or={or} user={user} activeOR={activeOR} elapsed={elapsed} orTotals={orTotals} onSelect={openOR}/>
            ))}
          </div>

          <div style={s.bottomRow}>
            <button style={s.internalBtn} onClick={()=>openOR({id:'internal_'+Date.now(),noFT:'INT',client:'Tâche interne',vehicule:'',plaques:'',travaux:'',activeMechanics:[],dateKey:today(),isCarrosserie:user.role==='carrossier',sansFT:false,status:'active',space:userSpace})}>
              + Tâche interne
            </button>
            <button style={s.createOrBtn} onClick={()=>setModal('createOR')}>+ Créer un OR</button>
          </div>
        </>
      )}

      {selectedOR && (
        <ORDetail or={selectedOR} user={user} activeOR={activeOR} elapsed={elapsed}
          onBack={closeOR} onStart={()=>startOR(selectedOR)} onStop={stopOR} onToggleComplete={toggleComplete}/>
      )}

      {modal==='createOR' && (
        <div style={s.overlay}>
          <div style={{...s.noteBox, maxHeight:'90vh', overflowY:'auto'}}>
            <p style={s.noteTitle}>Créer un OR</p>
            <CreateORForm color={color} user={user} onSave={async f=>{await createManualOR(f,user);setModal(null)}} onCancel={()=>setModal(null)}/>
          </div>
        </div>
      )}

      <div style={{height:24}}/>
    </div>
  )
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight:'100dvh', background:'#0d0d0d', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', gap:12, padding:'16px 16px 14px', borderBottom:'1px solid #1e1e1e', position:'sticky', top:0, background:'#0d0d0d', zIndex:10 },
  avatar: { width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18, flexShrink:0 },
  hCenter: { flex:1, display:'flex', flexDirection:'column', minWidth:0 },
  hName: { fontWeight:800, fontSize:20, lineHeight:1.1 },
  hSub: { fontSize:13, color:'#666', marginTop:2, textTransform:'capitalize' },
  hTitle: { fontWeight:800, fontSize:19, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  iconBtn: { background:'transparent', color:'#666', fontSize:20, padding:'6px 8px', cursor:'pointer' },
  miniBanner: { display:'flex', alignItems:'center', gap:10, margin:'10px 14px', padding:'13px 16px', borderRadius:12, border:'1px solid', cursor:'pointer' },
  miniTimer: { fontFamily:'var(--font-mono)', fontSize:16, fontWeight:700, flexShrink:0 },
  miniInfo: { flex:1, fontSize:14, color:'#aaa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  tabs: { display:'flex', borderBottom:'1px solid #1e1e1e' },
  tab: { flex:1, padding:'11px', background:'transparent', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'all 0.15s' },
  tabCount: { fontSize:11, background:'#1e1e1e', color:'#777', padding:'2px 7px', borderRadius:20, fontWeight:700 },
  searchWrap: { position:'relative', padding:'8px 12px 4px', display:'flex', alignItems:'center', gap:8 },
  searchInput: { flex:1, background:'#111', border:'1px solid #2a2a2a', borderRadius:10, color:'#f0f0f0', fontSize:15, padding:'11px 14px', outline:'none', fontFamily:'var(--font-body)' },
  searchClear: { background:'transparent', border:'none', color:'#555', fontSize:18, cursor:'pointer', padding:'4px 8px', flexShrink:0 },
  list: { flex:1, padding:'8px 12px', display:'flex', flexDirection:'column', gap:9, overflowY:'auto' },
  empty: { textAlign:'center', color:'#444', fontSize:16, padding:'64px 16px' },
  bottomRow: { padding:'8px 12px 0', display:'flex', gap:8 },
  internalBtn: { flex:1, padding:'13px', background:'transparent', border:'1px dashed #222', borderRadius:12, color:'#555', fontSize:14, cursor:'pointer' },
  createOrBtn: { flex:1, padding:'13px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:12, color:'#888', fontSize:14, fontWeight:600, cursor:'pointer' },
  // OR Card
  card: { display:'flex', borderRadius:14, border:'1px solid', textAlign:'left', transition:'all 0.12s', cursor:'pointer', overflow:'hidden', position:'relative' },
  cardLine: { width:4, flexShrink:0 },
  cardInner: { flex:1, padding:'14px 14px', display:'flex', flexDirection:'column', gap:5 },
  cardRow1: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 },
  orLabel: { fontFamily:'var(--font-mono)', fontSize:13, fontWeight:500 },
  cardBadges: { display:'flex', alignItems:'center', gap:6, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' },
  activeBadge: { fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20 },
  otherBadge: { fontSize:11, color:'#aaa', background:'#1e1e1e', padding:'3px 9px', borderRadius:20 },
  timeBadge: { fontSize:13, fontFamily:'var(--font-mono)', fontWeight:700 },
  clientName: { fontSize:22, fontWeight:800, color:'#ffffff', lineHeight:1.2 },
  vehicleRow: { display:'flex', alignItems:'center', gap:8, marginTop:2 },
  vehicleText: { fontSize:16, fontWeight:600, color:'#ccc' },
  platesText: { fontSize:14, color:'#888', fontFamily:'var(--font-mono)' },
  travauxBox: { fontSize:14, color:'#bbb', lineHeight:1.55, marginTop:4, paddingTop:6, borderTop:'1px solid #1e1e1e' },
  waitingTag: { fontSize:13, color:'#888', fontWeight:600, marginTop:4 },
  retiredTag: { fontSize:12, color:'#e84747', marginTop:4, fontWeight:600 },
  openHint: { fontSize:12, fontWeight:600, marginTop:4 },
  // Detail
  detail: { flex:1, display:'flex', flexDirection:'column', overflowY:'auto' },
  detailBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px 10px' },
  backBtn: { background:'transparent', color:'#888', fontSize:15, fontWeight:600, cursor:'pointer', padding:'4px 0' },
  totalChip: { fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, border:'1px solid', padding:'4px 12px', borderRadius:20 },
  waitingChip: { fontSize:12, fontWeight:700, color:'#888', background:'#1e1e1e', padding:'4px 12px', borderRadius:20 },
  orCard: { margin:'0 14px 4px', borderRadius:14, border:'1px solid', background:'#111', position:'relative', overflow:'hidden' },
  orCardAccent: { position:'absolute', left:0, top:0, bottom:0, width:5 },
  orCardBody: { padding:'16px 16px 16px 22px', display:'flex', flexDirection:'column', gap:6 },
  orCardMeta: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  orCardNum: { fontFamily:'var(--font-mono)', fontSize:13 },
  orCardAssign: { fontSize:12, color:'#666' },
  orCardClient: { fontSize:26, fontWeight:800, color:'#ffffff', lineHeight:1.2 },
  orCardVehicle: { fontSize:17, fontWeight:600, color:'#ccc', marginTop:2 },
  orCardPlates: { fontFamily:'var(--font-mono)', fontSize:15, color:'#888' },
  orCardTravaux: { marginTop:8, paddingTop:10, borderTop:'1px solid #1e1e1e' },
  orCardTrLabel: { fontSize:10, letterSpacing:'0.18em', color:'#555', fontFamily:'var(--font-mono)', marginBottom:6 },
  orCardTrText: { fontSize:15, color:'#ccc', lineHeight:1.65 },
  kmBlock: { margin:'8px 14px', padding:'14px 16px', background:'#111', borderRadius:12, border:'1px solid #1e1e1e' },
  kmLabel: { fontSize:10, letterSpacing:'0.18em', color:'#555', fontFamily:'var(--font-mono)', display:'block', marginBottom:10 },
  kmRow: { display:'flex', alignItems:'center', gap:10 },
  kmInput: { flex:1, background:'#0d0d0d', border:'1px solid', borderRadius:8, color:'#fff', fontSize:20, fontWeight:700, padding:'10px 14px', outline:'none', fontFamily:'var(--font-mono)' },
  kmSaveBtn: { padding:'10px 18px', borderRadius:8, fontWeight:700, fontSize:14, cursor:'pointer', border:'none', flexShrink:0 },
  kmStatus: { fontSize:14, fontWeight:600, flexShrink:0 },
  timerZone: { display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 20px 16px', gap:18 },
  timerBig: { fontFamily:'var(--font-mono)', fontSize:64, fontWeight:500, letterSpacing:'0.02em', lineHeight:1 },
  goBig: { width:'100%', maxWidth:320, padding:'22px', borderRadius:18, fontWeight:800, fontSize:22, letterSpacing:'0.14em', cursor:'pointer', color:'#000', border:'none' },
  stopBig: { width:'100%', maxWidth:320, padding:'20px', borderRadius:18, fontWeight:800, fontSize:20, letterSpacing:'0.1em', cursor:'pointer', background:'transparent', border:'2px solid' },
  actionsRow: { display:'flex', gap:8, padding:'0 14px 10px' },
  actionBtn: { flex:1, padding:'14px 8px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:12, color:'#ccc', fontSize:14, fontWeight:600, cursor:'pointer', position:'relative', transition:'all 0.15s' },
  photoBadge: { position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' },
  photoPreview: { margin:'0 14px 12px', background:'#111', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden' },
  sectionLabel: { fontSize:10, letterSpacing:'0.18em', color:'#555', fontFamily:'var(--font-mono)', padding:'10px 14px 8px', borderBottom:'1px solid #1a1a1a' },
  thumbRow: { display:'flex', gap:8, padding:'10px 14px', overflowX:'auto' },
  thumbSmall: { width:72, height:72, objectFit:'cover', borderRadius:8, display:'block', border:'1px solid #2a2a2a' },
  thumbDelete: { position:'absolute', top:2, right:2, background:'rgba(0,0,0,0.75)', border:'none', borderRadius:5, padding:'2px 5px', fontSize:12, cursor:'pointer', lineHeight:1 },
  history: { margin:'0 14px 14px', border:'1px solid #1e1e1e', borderRadius:14, overflow:'hidden', background:'#111' },
  historyTitle: { fontSize:10, letterSpacing:'0.18em', color:'#555', fontFamily:'var(--font-mono)', padding:'12px 16px 8px', borderBottom:'1px solid #1a1a1a' },
  histRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 16px', gap:12, borderBottom:'1px solid #161616' },
  histLeft: { display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:0 },
  histTop: { display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' },
  histName: { fontSize:14, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.04em' },
  histTime: { fontSize:12, color:'#666', fontFamily:'var(--font-mono)' },
  histNote: { fontSize:14, color:'#ddd', lineHeight:1.55, marginTop:2, flex:1 },
  histDur: { fontFamily:'var(--font-mono)', fontSize:15, fontWeight:700, flexShrink:0, paddingTop:2 },
  editNoteBtn: { background:'transparent', border:'none', cursor:'pointer', fontSize:13, padding:'2px 4px', flexShrink:0, opacity:0.6 },
  // Overlays
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'flex-end', zIndex:100, padding:14 },
  noteBox: { width:'100%', background:'#131313', borderRadius:18, padding:20, border:'1px solid #2a2a2a', display:'flex', flexDirection:'column', gap:14 },
  noteTitle: { fontSize:20, fontWeight:800, color:'#fff', margin:0 },
  noteSub: { fontSize:14, color:'#777', margin:0 },
  noteTA: { width:'100%', background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:10, color:'#f0f0f0', fontSize:16, padding:'14px', resize:'none', outline:'none', fontFamily:'var(--font-body)', lineHeight:1.6 },
  voiceBtn: { padding:'14px', borderRadius:10, border:'1px solid', fontSize:16, fontWeight:600, cursor:'pointer', transition:'all 0.15s', textAlign:'center' },
  listenLabel: { fontSize:14, fontFamily:'var(--font-mono)', textAlign:'center', margin:0 },
  noteActions: { display:'flex', gap:10 },
  skipBtn: { flex:1, padding:'14px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:10, color:'#666', fontSize:15, fontWeight:600, cursor:'pointer' },
  okBtn: { flex:2, padding:'14px', borderRadius:10, fontSize:16, fontWeight:800, cursor:'pointer' },
  spinner: { width:36, height:36, border:'3px solid #2a2a2a', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
}
