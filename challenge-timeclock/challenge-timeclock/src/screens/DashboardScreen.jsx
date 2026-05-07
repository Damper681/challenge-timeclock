import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

const TEAM_CHALLENGE = [
  { id:'jose',     name:'José',     label:'Mécanicien', color:'#4fc3f7' },
  { id:'vivian',   name:'Vivian',   label:'Mécanicien', color:'#6ee7a0' },
  { id:'valentin', name:'Valentin', label:'Carrossier', color:'#ffb74d' },
  { id:'marius_c', name:'Marius',   label:'Mécanicien', color:'#f472b6' },
  { id:'damien_c', name:'Damien',   label:'Mécanicien', color:'#a78bfa' },
]

const TEAM_GT = [
  { id:'marius',  name:'Marius',  label:'Mécanicien', color:'#f472b6' },
  { id:'damien',  name:'Damien',  label:'Mécanicien', color:'#a78bfa' },
]

// Use both for dashboard (admin sees all)
const TEAM = [...TEAM_CHALLENGE, ...TEAM_GT]

function today() { return new Date().toISOString().split('T')[0] }
function fmtMin(min) {
  if (!min) return '—'
  const h=Math.floor(min/60), m=min%60
  return h>0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`
}
function dateKey(ago=0) { const d=new Date(); d.setDate(d.getDate()-ago); return d.toISOString().split('T')[0] }
function labelDate(dk) {
  if (dk===today()) return "Aujourd'hui"
  if (dk===dateKey(1)) return 'Hier'
  return dk.split('-').reverse().slice(0,2).join('.')
}
function buildRapportByOR(pointages) {
  const map = {}
  pointages.forEach(p => {
    const key = p.noFT||p.orId
    if (!map[key]) map[key]={noFT:p.noFT,client:p.client,vehicule:p.vehicule,orId:p.orId,entries:[]}
    map[key].entries.push(p)
  })
  return Object.values(map)
}

function ORPointages({ orId }) {
  const [pointages, setPointages] = useState([])
  useEffect(()=>{
    const q = query(collection(db,'pointages'), where('orId','==',orId))
    return onSnapshot(q, snap=>{
      const data = snap.docs.map(d=>({id:d.id,...d.data()}))
      data.sort((a,b)=>{ const ta=a.start?.toDate?a.start.toDate():new Date(0); const tb=b.start?.toDate?b.start.toDate():new Date(0); return ta-tb })
      setPointages(data)
    })
  },[orId])

  const fmtT = ts => { if(!ts) return ''; const d=ts?.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('fr-CH',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'}) }
  const fmtMin = min => { if(!min) return null; const h=Math.floor(min/60),m=min%60; return h>0?`${h}h${String(m).padStart(2,'0')}`:`${m}min` }
  const USER_COLORS = { jose:'#4fc3f7', vivian:'#6ee7a0', valentin:'#ffb74d' }
  const total = pointages.filter(p=>p.end&&!p.isStandaloneNote).reduce((s,p)=>s+(p.duration_min||0),0)

  return (
    <div>
      {total>0 && <div style={{padding:'8px 0', fontSize:14, color:'#aaa'}}>Total : <strong style={{color:'#fff'}}>{fmtMin(total)}</strong></div>}
      {pointages.length===0 && <div style={{color:'#444',fontSize:13,padding:'16px 0'}}>Aucun pointage</div>}
      {pointages.map(p=>(
        <div key={p.id} style={{padding:'10px 0', borderBottom:'1px solid #1e1e1e', display:'flex', justifyContent:'space-between', gap:12}}>
          <div>
            <div style={{fontSize:13, fontWeight:700, color:USER_COLORS[p.mechanic]||'#ccc', textTransform:'uppercase'}}>{p.mechanicName}</div>
            <div style={{fontSize:12, color:'#666', fontFamily:'monospace'}}>{fmtT(p.start)}{p.end?' → '+fmtT(p.end):' → en cours'}</div>
            {p.note && <div style={{fontSize:13, color:'#ccc', fontStyle:'italic', marginTop:3}}>"{p.note}"</div>}
          </div>
          <div style={{fontSize:14, fontWeight:700, color:p.end?'#aaa':'#4fc3f7', flexShrink:0}}>
            {p.isStandaloneNote?'📝':p.end?fmtMin(p.duration_min):'⏱'}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardScreen({ user, onBack, onLogout }) {
  // Note: useState already imported at top level
  const [sel, setSel] = useState(today())
  const [view, setView] = useState('equipe')
  const [selectedOR, setSelectedOR] = useState(null)
  // Space filter: admin sees both, others see their space
  // Determine default space filter based on who is logged in
  const defaultSpace = user?.id==='admin_g' || user?.space==='gt' ? 'gt'
    : user?.id==='admin_c' || user?.space==='challenge' ? 'challenge'
    : 'all'
  const [spaceFilter, setSpaceFilter] = useState(defaultSpace)
  const [pointages, setPointages] = useState([])
  const [photos, setPhotos] = useState([]) // all photo docs for sel date
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState(null)
  const dates = Array.from({length:7},(_,i)=>dateKey(i))

  const [ors, setOrs] = useState({}) // map orId -> or data (for km)

  useEffect(()=>{
    setLoading(true)
    const q = query(collection(db,'pointages'), where('dateKey','==',sel))
    return onSnapshot(q, snap=>{ setPointages(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false) })
  },[sel])

  // Load ors to get km (not date-filtered, we need the actual OR data)
  useEffect(()=>{
    const q = query(collection(db,'ors'))
    return onSnapshot(q, snap=>{
      const map = {}
      snap.docs.forEach(d=>{ const data=d.data(); if(data.km) map[d.id]=data })
      setOrs(map)
    })
  },[])

  useEffect(()=>{
    const q = query(collection(db,'photos'), where('dateKey','==',sel))
    return onSnapshot(q, snap=>{ setPhotos(snap.docs.map(d=>({docId:d.id,...d.data()}))) })
  },[sel])

  const deletePhoto = async (photoDoc, photoItem) => {
    setDeletingPhoto(photoItem.publicId || photoItem.filename || photoItem.url)
    try {
      const remaining = (photoDoc.photos||[]).filter(p=>p.url!==photoItem.url)
      if (remaining.length===0) {
        await deleteDoc(doc(db,'photos',photoDoc.docId))
      } else {
        const {updateDoc: upd, doc: fDoc} = await import('firebase/firestore')
        await upd(fDoc(db,'photos',photoDoc.docId), {photos: remaining})
      }
    } catch(e) { console.error(e) }
    setDeletingPhoto(null)
  }

  const stats = TEAM.map(m=>{
    const mine = pointages.filter(p=>p.mechanic===m.id)
    const totalMin = mine.filter(p=>p.end!==null&&!p.isStandaloneNote).reduce((s,p)=>s+(p.duration_min||0),0)
    const active = mine.find(p=>p.end===null)
    return {...m, mine, totalMin, active}
  })
  const grandTotal = stats.reduce((s,m)=>s+m.totalMin,0)
  const rapportByOR = buildRapportByOR(pointages)

  const buildRapportText = () => {
    const lines=[`RAPPORT DU ${new Date(sel).toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()}`,'']
    rapportByOR.forEach(or=>{
      lines.push(`OR ${or.noFT} — ${or.client}${or.vehicule?' · '+or.vehicule:''}`)
      const km = or.entries[0]?.km
      if (km) lines.push(`Kilométrage : ${km.toLocaleString('fr-CH')} km`)
      const totalMin = or.entries.filter(e=>e.end!==null&&!e.isStandaloneNote).reduce((s,e)=>s+(e.duration_min||0),0)
      lines.push(`Temps total : ${fmtMin(totalMin)||'en cours'}`)
      or.entries.forEach(e=>{ if(e.note) lines.push(`  [${e.mechanicName}] ${e.note}`) })
      const orPhotos = photos.filter(pd=>pd.orId===or.orId)
      const photoCount = orPhotos.reduce((s,pd)=>s+(pd.photos||[]).length,0)
      if (photoCount>0) lines.push(`  Photos : ${photoCount} photo${photoCount>1?'s':''} dans le dossier`)
      lines.push('')
    })
    return lines.join('\n')
  }

  const copyRapport = () => { navigator.clipboard.writeText(buildRapportText()); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  return (
    <div style={s.root}>
      {selectedOR && (
        <div style={s.orOverlay}>
          <div style={s.orOverlayBox}>
            <div style={s.orOverlayHead}>
              <div>
                <div style={s.orOverlayNum}>OR {selectedOR.noFT}</div>
                <div style={s.orOverlayClient}>{selectedOR.client}</div>
                {selectedOR.vehicule && <div style={s.orOverlayVeh}>{selectedOR.vehicule}</div>}
              </div>
              <button style={s.orOverlayClose} onClick={()=>setSelectedOR(null)}>✕</button>
            </div>
            <ORPointages orId={selectedOR.id} />
          </div>
        </div>
      )}
      <div style={s.header}>
        <button style={s.iconBtn} onClick={onBack}>←</button>
        <span style={s.title}>Tableau de bord</span>
        <button style={s.iconBtn} onClick={onLogout}>↩</button>
      </div>

      <div style={s.dateRow}>
        {dates.map(d=>(
          <button key={d} style={{...s.chip, background:d===sel?'#e8c547':'rgba(255,255,255,0.04)', color:d===sel?'#000':'#555', border:`1px solid ${d===sel?'#e8c547':'#1e1e1e'}`, fontWeight:d===sel?700:400}} onClick={()=>setSel(d)}>{labelDate(d)}</button>
        ))}
      </div>

      <div style={s.viewToggle}>
        {['equipe','rapport','photos'].map(v=>(
          <button key={v} style={{...s.toggleBtn, background:view===v?'#1e1e1e':'transparent', color:view===v?'#fff':'#555'}} onClick={()=>setView(v)}>
            {v==='equipe'?'Équipe':v==='rapport'?'Rapports':'Photos'}
            {v==='photos' && photos.reduce((s,pd)=>s+(pd.photos||[]).length,0)>0 && (
              <span style={s.badge}>{photos.reduce((s,pd)=>s+(pd.photos||[]).length,0)}</span>
            )}
          </button>
        ))}
      </div>

      <div style={s.totalBar}>
        <span style={s.totalLabel}>TOTAL ÉQUIPE</span>
        <span style={s.totalVal}>{fmtMin(grandTotal)}</span>
      </div>

      <div style={s.list}>
        {loading && <div style={s.empty}>Chargement...</div>}

        {/* ÉQUIPE */}
        {!loading && view==='equipe' && stats.map(m=>(
          <div key={m.id} style={{...s.card, borderColor:m.active?m.color:'#1e1e1e'}}>
            <div style={s.cardHead}>
              <div style={{...s.avatar, background:m.color+'18', color:m.color}}>{m.name[0]}</div>
              <div style={s.cardInfo}>
                <div style={s.cardName}>{m.name}</div>
                <div style={s.cardRole}>{m.label} · {m.mine.length} pointage{m.mine.length!==1?'s':''}</div>
              </div>
              <div style={s.cardRight}>
                {m.active && <div style={{...s.liveDot, background:m.color}}/>}
                <span style={{...s.cardTotal, color:m.totalMin>0?m.color:'#333'}}>{fmtMin(m.totalMin)}</span>
              </div>
            </div>
            {m.mine.length>0 && (
              <div style={s.rows}>
                {m.mine.map(p=>(
                  <div key={p.id} style={{...s.pRow, cursor:'pointer'}} onClick={()=>setSelectedOR({id:p.orId, noFT:p.noFT, client:p.client, vehicule:p.vehicule})}>
                    <div style={s.pLeft}>
                      <span style={s.pOR}>OR {p.noFT}</span>
                      <span style={s.pClient}>{p.client}</span>
                      {p.note && <span style={s.pNote}>"{p.note}"</span>}
                    </div>
                    <span style={{...s.pDur, color:p.end===null?m.color:'#555'}}>
                      {p.end===null?'⏱ en cours':fmtMin(p.duration_min)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {m.mine.length===0 && <div style={s.noAct}>Pas d'activité</div>}
          </div>
        ))}

        {/* RAPPORTS */}
        {!loading && view==='rapport' && (
          <>
            <button style={s.copyBtn} onClick={copyRapport}>{copied?'✓ Copié !':'📋 Copier tout le rapport'}</button>
            {rapportByOR.map((or,i)=>{
              const totalMin=or.entries.filter(e=>e.end!==null&&!e.isStandaloneNote).reduce((s,e)=>s+(e.duration_min||0),0)
              const orData = ors[or.orId]
              const km = orData?.km || or.entries.find(e=>e.km)?.km
              const orStatus = orData?.status
              const orPhotos = photos.filter(pd=>pd.orId===or.orId)
              const photoCount = orPhotos.reduce((s,pd)=>s+(pd.photos||[]).length,0)
              return (
                <div key={i} style={{...s.rapportCard, cursor:'pointer'}} onClick={()=>setSelectedOR({id:or.orId, noFT:or.noFT, client:or.client, vehicule:or.vehicule})}>
                  <div style={s.rapportHead}>
                    <div>
                      <div style={s.rapportOR}>OR {or.noFT}</div>
                      <div style={s.rapportClient}>{or.client}</div>
                      {or.vehicule && <div style={s.rapportVeh}>{or.vehicule}</div>}
                      {km && <div style={s.rapportKm}>🔢 {km.toLocaleString('fr-CH')} km</div>}
                      {photoCount>0 && <div style={s.rapportPhoto}>📷 {photoCount} photo{photoCount>1?'s':''}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                      <span style={s.rapportTotal}>{fmtMin(totalMin)||'en cours'}</span>
                      {ors[or.orId]?.status==='completed' && <span style={{fontSize:10,fontWeight:700,color:'#47e88a',background:'rgba(71,232,138,0.1)',padding:'2px 8px',borderRadius:20}}>✓ Terminé</span>}
                    </div>
                  </div>
                  {or.entries.filter(e=>e.note).length>0 && (
                    <div style={s.rapportNotes}>
                      {or.entries.filter(e=>e.note).map((e,j)=>(
                        <div key={j} style={s.rapportEntry}>
                          <div style={s.rapportMeta}><span style={s.rapportMechanic}>{e.mechanicName}</span></div>
                          <p style={s.rapportText}>"{e.note}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {rapportByOR.length===0 && <div style={s.empty}>Aucun pointage</div>}
          </>
        )}

        {/* PHOTOS */}
        {!loading && view==='photos' && (
          <>
            {photos.length===0 && <div style={s.empty}>Aucune photo pour cette journée</div>}
            {photos.map(photoDoc=>(
              <div key={photoDoc.docId} style={s.photoCard}>
                <div style={s.photoCardHead}>
                  <div style={s.rapportOR}>OR {photoDoc.noFT}</div>
                  <div style={s.rapportClient}>{photoDoc.client}</div>
                  {photoDoc.vehicule && <div style={s.rapportVeh}>{photoDoc.vehicule}</div>}
                </div>
                <div style={s.photoGrid}>
                  {(photoDoc.photos||[]).map((p,i)=>(
                    <div key={i} style={s.photoItem}>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        <img src={p.url} alt="" style={s.photoThumb}/>
                      </a>
                      <button
                        style={{...s.deleteBtn, opacity: deletingPhoto===p.filename?0.5:1}}
                        onClick={()=>deletePhoto(photoDoc, p)}
                        disabled={!!deletingPhoto}
                      >
                        {deletingPhoto ? '...' : '🗑'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{height:32}}/>
    </div>
  )
}

const s = {
  root: { minHeight:'100dvh', background:'#0d0d0d', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', gap:10, padding:'16px 16px 14px', borderBottom:'1px solid #1e1e1e', position:'sticky', top:0, background:'#0d0d0d', zIndex:10 },
  iconBtn: { background:'transparent', color:'#555', fontSize:20, padding:'6px 8px', cursor:'pointer' },
  title: { flex:1, fontWeight:800, fontSize:19, color:'#fff' },
  dateRow: { display:'flex', gap:6, padding:'10px 12px', overflowX:'auto', borderBottom:'1px solid #1e1e1e' },
  chip: { padding:'7px 14px', borderRadius:20, fontSize:13, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, transition:'all 0.15s' },
  viewToggle: { display:'flex', padding:'8px 12px', gap:6, borderBottom:'1px solid #1e1e1e' },
  toggleBtn: { flex:1, padding:'9px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', border:'none', transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center', gap:6 },
  badge: { background:'#e8c547', color:'#000', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10 },
  totalBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #1e1e1e' },
  totalLabel: { fontSize:10, color:'#555', fontFamily:'var(--font-mono)', letterSpacing:'0.15em' },
  totalVal: { fontSize:24, fontWeight:800, fontFamily:'var(--font-mono)', color:'#fff' },
  list: { flex:1, padding:'10px', display:'flex', flexDirection:'column', gap:8 },
  empty: { textAlign:'center', color:'#444', padding:'48px 0', fontSize:14 },
  card: { background:'#111', border:'1px solid', borderRadius:14, overflow:'hidden' },
  cardHead: { display:'flex', alignItems:'center', gap:10, padding:'14px' },
  avatar: { width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:700, flexShrink:0 },
  cardInfo: { flex:1 },
  cardName: { fontSize:17, fontWeight:800, color:'#fff' },
  cardRole: { fontSize:12, color:'#555', marginTop:1 },
  cardRight: { display:'flex', alignItems:'center', gap:6 },
  liveDot: { width:7, height:7, borderRadius:'50%' },
  cardTotal: { fontFamily:'var(--font-mono)', fontSize:22, fontWeight:700 },
  rows: { borderTop:'1px solid #1a1a1a', padding:'6px 0' },
  pRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'8px 14px', gap:10 },
  pLeft: { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 },
  pOR: { fontFamily:'var(--font-mono)', fontSize:11, color:'#444' },
  pClient: { fontSize:14, fontWeight:600, color:'#ccc' },
  pNote: { fontSize:12, color:'#666', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  pDur: { fontFamily:'var(--font-mono)', fontSize:14, fontWeight:600, flexShrink:0 },
  noAct: { borderTop:'1px solid #1a1a1a', padding:'10px 14px', fontSize:12, color:'#333', fontStyle:'italic' },
  copyBtn: { padding:'13px', background:'rgba(232,197,71,0.08)', border:'1px solid rgba(232,197,71,0.2)', borderRadius:10, color:'#e8c547', fontSize:14, fontWeight:600, cursor:'pointer', textAlign:'center' },
  rapportCard: { background:'#111', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden' },
  rapportHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'14px', borderBottom:'1px solid #1a1a1a' },
  rapportOR: { fontFamily:'var(--font-mono)', fontSize:11, color:'#555', marginBottom:3 },
  rapportClient: { fontSize:17, fontWeight:800, color:'#fff' },
  rapportVeh: { fontSize:13, color:'#666', marginTop:2 },
  rapportKm: { fontSize:13, color:'#888', marginTop:4 },
  rapportPhoto: { fontSize:13, color:'#888', marginTop:2 },
  rapportTotal: { fontFamily:'var(--font-mono)', fontSize:18, fontWeight:700, color:'#e8c547', flexShrink:0 },
  rapportNotes: { padding:'8px 0' },
  rapportEntry: { padding:'8px 14px' },
  rapportMeta: { marginBottom:4 },
  rapportMechanic: { fontSize:12, fontWeight:700, color:'#777', textTransform:'uppercase', letterSpacing:'0.06em' },
  rapportText: { fontSize:14, color:'#ccc', lineHeight:1.55, margin:0 },
  // Photos tab
  photoCard: { background:'#111', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden', padding:14 },
  photoCardHead: { marginBottom:12 },
  photoGrid: { display:'flex', flexWrap:'wrap', gap:8 },
  photoItem: { position:'relative' },
  photoThumb: { width:100, height:100, objectFit:'cover', borderRadius:10, border:'1px solid #2a2a2a', display:'block' },
  deleteBtn: { position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.75)', border:'none', borderRadius:6, padding:'4px 6px', fontSize:14, cursor:'pointer', lineHeight:1 },
  orOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:50, display:'flex', alignItems:'flex-end', padding:14 },
  orOverlayBox: { width:'100%', background:'#111', borderRadius:18, padding:20, border:'1px solid #2a2a2a', maxHeight:'80vh', overflowY:'auto' },
  orOverlayHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 },
  orOverlayNum: { fontFamily:'monospace', fontSize:12, color:'#666', marginBottom:4 },
  orOverlayClient: { fontSize:20, fontWeight:800, color:'#fff' },
  orOverlayVeh: { fontSize:14, color:'#666', marginTop:2 },
  orOverlayClose: { background:'transparent', border:'none', color:'#666', fontSize:20, cursor:'pointer', padding:'4px 8px' },
}
