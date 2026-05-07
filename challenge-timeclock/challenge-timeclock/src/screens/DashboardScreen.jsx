import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase.js'

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const TEAM_CHALLENGE = [
  { id:'jose',     name:'José',     label:'Mécanicien', color:'#4fc3f7', space:'challenge' },
  { id:'vivian',   name:'Vivian',   label:'Mécanicien', color:'#6ee7a0', space:'challenge' },
  { id:'valentin', name:'Valentin', label:'Carrossier', color:'#ffb74d', space:'challenge' },
  { id:'marius_c', name:'Marius',   label:'Mécanicien', color:'#f472b6', space:'challenge' },
  { id:'damien_c', name:'Damien',   label:'Mécanicien', color:'#a78bfa', space:'challenge' },
]
const TEAM_GT = [
  { id:'marius',  name:'Marius',  label:'Mécanicien', color:'#f472b6', space:'gt' },
  { id:'damien',  name:'Damien',  label:'Mécanicien', color:'#a78bfa', space:'gt' },
]
const ALL_COLORS = { jose:'#4fc3f7', vivian:'#6ee7a0', valentin:'#ffb74d', marius:'#f472b6', marius_c:'#f472b6', damien:'#a78bfa', damien_c:'#a78bfa' }

// ─── UTILS ──────────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] }
function dateKey(ago=0) { const d=new Date(); d.setDate(d.getDate()-ago); return d.toISOString().split('T')[0] }
function fmtMin(min) {
  if (!min||min===0) return '—'
  const h=Math.floor(min/60), m=min%60
  return h>0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`
}
function labelDate(dk) {
  if (dk===today()) return "Aujourd'hui"
  if (dk===tomorrow()) return 'Demain'
  if (dk===dateKey(1)) return 'Hier'
  const [y,mo,d]=dk.split('-'); return `${d}.${mo}`
}
function fmtDayFull(dk) {
  const d=new Date(dk+'T12:00:00')
  return d.toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long'})
}
function getWeekDays(refDate) {
  const d = new Date(refDate+'T12:00:00')
  const day = d.getDay()
  const monday = new Date(d); monday.setDate(d.getDate()-(day===0?6:day-1))
  return Array.from({length:7},(_,i)=>{ const dd=new Date(monday); dd.setDate(monday.getDate()+i); return dd.toISOString().split('T')[0] })
}
function buildRapportByOR(pointages) {
  const map={}
  pointages.forEach(p=>{
    const key=p.orId||p.noFT
    if(!map[key]) map[key]={noFT:p.noFT,client:p.client,vehicule:p.vehicule,orId:p.orId,entries:[]}
    map[key].entries.push(p)
  })
  return Object.values(map)
}

// ─── OR DETAIL OVERLAY ─────────────────────────────────────────────────────────
function ORDetailOverlay({ orData, onClose }) {
  const [pointages, setPointages] = useState([])
  useEffect(()=>{
    if (!orData?.id) return
    const q = query(collection(db,'pointages'), where('orId','==',orData.id))
    return onSnapshot(q, snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}))
      data.sort((a,b)=>{const ta=a.start?.toDate?a.start.toDate():new Date(0); const tb=b.start?.toDate?b.start.toDate():new Date(0); return ta-tb})
      setPointages(data)
    })
  },[orData?.id])
  const fmtT = ts=>{if(!ts)return''; const d=ts?.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('fr-CH',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'})}
  const total = pointages.filter(p=>p.end&&!p.isStandaloneNote).reduce((s,p)=>s+(p.duration_min||0),0)
  return (
    <div style={s.overlay}>
      <div style={s.overlayBox}>
        <div style={s.overlayHead}>
          <div>
            <div style={{fontFamily:'monospace',fontSize:12,color:'#666',marginBottom:4}}>OR {orData.noFT}</div>
            <div style={{fontSize:20,fontWeight:800,color:'#fff'}}>{orData.client}</div>
            {orData.vehicule && <div style={{fontSize:14,color:'#666',marginTop:2}}>{orData.vehicule}</div>}
          </div>
          <button style={{background:'transparent',border:'none',color:'#666',fontSize:20,cursor:'pointer',padding:'4px 8px'}} onClick={onClose}>✕</button>
        </div>
        {total>0 && <div style={{padding:'6px 0 10px',borderBottom:'1px solid #1e1e1e',color:'#888',fontSize:13}}>Total : <strong style={{color:'#e8c547'}}>{fmtMin(total)}</strong></div>}
        {pointages.length===0 && <div style={{color:'#444',fontSize:13,padding:'16px 0'}}>Aucun pointage</div>}
        {pointages.map(p=>(
          <div key={p.id} style={{padding:'10px 0',borderBottom:'1px solid #1a1a1a',display:'flex',justifyContent:'space-between',gap:12}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:ALL_COLORS[p.mechanic]||'#ccc',textTransform:'uppercase'}}>{p.mechanicName}</div>
              <div style={{fontSize:11,color:'#666',fontFamily:'monospace'}}>{fmtT(p.start)}{p.end?' → '+fmtT(p.end):' → en cours'}</div>
              {p.note && <div style={{fontSize:13,color:'#ccc',fontStyle:'italic',marginTop:2}}>"{p.note}"</div>}
            </div>
            <div style={{fontSize:14,fontWeight:700,color:p.end?'#aaa':'#4fc3f7',flexShrink:0}}>
              {p.isStandaloneNote?'📝':p.end?fmtMin(p.duration_min):'⏱'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CALENDAR WEEK VIEW ─────────────────────────────────────────────────────────
function CalendarWeek({ ors, weekDays, team, onSelectOr, onSelectDay }) {
  const orsByDay = useMemo(()=>{
    const map={}
    weekDays.forEach(d=>{ map[d]=[] })
    ors.forEach(or=>{
      if(map[or.dateKey]) map[or.dateKey].push(or)
    })
    return map
  },[ors, weekDays])

  const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

  return (
    <div style={{overflowX:'auto',padding:'0 4px'}}>
      <div style={{display:'grid', gridTemplateColumns:`repeat(7, minmax(100px,1fr))`, gap:4, minWidth:700}}>
        {weekDays.map((day,idx)=>{
          const isToday = day===today()
          const isTomorrow = day===tomorrow()
          const dayOrs = orsByDay[day]||[]
          return (
            <div key={day} style={{display:'flex',flexDirection:'column',gap:4}}>
              <button style={{padding:'6px 4px',borderRadius:8,border:'1px solid',
                background: isToday?'#e8c547':'rgba(255,255,255,0.03)',
                borderColor: isToday?'#e8c547':isTomorrow?'#444':'#1e1e1e',
                cursor:'pointer'
              }} onClick={()=>onSelectDay(day)}>
                <div style={{fontSize:10,fontWeight:700,color:isToday?'#000':'#666',letterSpacing:'0.08em'}}>{DAY_NAMES[idx]}</div>
                <div style={{fontSize:14,fontWeight:700,color:isToday?'#000':isTomorrow?'#aaa':'#888'}}>{day.split('-')[2]}/{day.split('-')[1]}</div>
                <div style={{fontSize:10,color:isToday?'#000000aa':'#555'}}>{dayOrs.length} OR{dayOrs.length!==1?'s':''}</div>
              </button>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                {dayOrs.slice(0,8).map(or=>{
                  const mechColor = ALL_COLORS[or.mécano?.toLowerCase()] || '#666'
                  return (
                    <button key={or.id} style={{padding:'5px 7px',borderRadius:7,border:'1px solid #1e1e1e',background:'#111',cursor:'pointer',textAlign:'left',
                      borderLeft:`3px solid ${or.status==='completed'?'#47e88a':or.status==='waiting'?'#555':'#333'}`,
                    }} onClick={()=>onSelectOr(or)}>
                      <div style={{fontSize:10,color:'#555',fontFamily:'monospace'}}>OR {or.noFT}</div>
                      <div style={{fontSize:11,fontWeight:700,color:'#ccc',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{or.client}</div>
                      {or.mécano && <div style={{fontSize:10,color:mechColor,marginTop:1}}>{or.mécano}</div>}
                      {or.status==='completed' && <div style={{fontSize:9,color:'#47e88a',marginTop:1}}>✓ Terminé</div>}
                      {or.status==='waiting' && <div style={{fontSize:9,color:'#888',marginTop:1}}>⏸ Attente</div>}
                    </button>
                  )
                })}
                {dayOrs.length>8 && <div style={{fontSize:10,color:'#555',padding:'4px 6px'}}>+{dayOrs.length-8} autres</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── CALENDAR DAY VIEW ─────────────────────────────────────────────────────────
function CalendarDay({ ors, pointages, team, sel, onSelectOr }) {
  const dayOrs = ors.filter(o=>o.dateKey===sel)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:12,color:'#555',padding:'4px 2px',textTransform:'capitalize'}}>{fmtDayFull(sel)} · {dayOrs.length} OR{dayOrs.length!==1?'s':''}</div>
      {dayOrs.length===0 && <div style={{textAlign:'center',color:'#444',padding:'40px',fontSize:14}}>Aucun OR planifié</div>}
      {team.map(member=>{
        const memberOrs = dayOrs.filter(or=>{
          const mecano = (or.mécano||'').toLowerCase()
          return mecano===member.name.toLowerCase() || mecano===member.id
        })
        const memberPointages = pointages.filter(p=>p.mechanic===member.id)
        const totalMin = memberPointages.filter(p=>p.end&&!p.isStandaloneNote).reduce((s,p)=>s+(p.duration_min||0),0)
        if (memberOrs.length===0 && memberPointages.length===0) return null
        return (
          <div key={member.id} style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:12,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid #1a1a1a'}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:member.color+'18',color:member.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14}}>{member.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:'#fff'}}>{member.name}</div>
                <div style={{fontSize:11,color:'#555'}}>{memberPointages.length} pointage{memberPointages.length!==1?'s':''}</div>
              </div>
              {totalMin>0 && <span style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:member.color}}>{fmtMin(totalMin)}</span>}
            </div>
            {memberOrs.map(or=>(
              <button key={or.id} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'transparent',border:'none',borderBottom:'1px solid #161616',cursor:'pointer',textAlign:'left',
                borderLeft:`3px solid ${or.status==='completed'?'#47e88a':or.status==='waiting'?'#555':member.color+'60'}`
              }} onClick={()=>onSelectOr(or)}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontFamily:'monospace',color:'#555'}}>OR {or.noFT}</div>
                  <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{or.client}</div>
                  {or.vehicule && <div style={{fontSize:12,color:'#666'}}>{or.vehicule}</div>}
                </div>
                <div style={{flexShrink:0}}>
                  {or.status==='completed' && <span style={{fontSize:11,color:'#47e88a',fontWeight:700}}>✓</span>}
                  {or.status==='waiting' && <span style={{fontSize:11,color:'#888',fontWeight:700}}>⏸</span>}
                </div>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────────
export default function DashboardScreen({ user, onBack, onLogout }) {
  const [sel, setSel] = useState(today())
  const [view, setView] = useState('equipe') // equipe | rapport | photos | cal_week | cal_day
  const [selectedOR, setSelectedOR] = useState(null)
  const [pointages, setPointages] = useState([])
  const [photos, setPhotos] = useState([])
  const [ors, setOrs] = useState([]) // all ORs (for calendar + km)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState(null)
  const [calWeekStart, setCalWeekStart] = useState(today())

  // Determine space from user
  const userSpace = user?.id==='admin_g' || user?.space==='gt' ? 'gt'
    : user?.id==='admin_c' || user?.space==='challenge' ? 'challenge'
    : 'all'

  const team = userSpace==='gt' ? TEAM_GT : userSpace==='challenge' ? TEAM_CHALLENGE : [...TEAM_CHALLENGE, ...TEAM_GT]
  const teamIds = new Set(team.map(m=>m.id))

  // Date pills: past 7 days + demain
  const dates = [tomorrow(), ...Array.from({length:7},(_,i)=>dateKey(i))]

  // Load pointages for selected date, filtered by team
  useEffect(()=>{
    setLoading(true)
    const q = query(collection(db,'pointages'), where('dateKey','==',sel))
    return onSnapshot(q, snap=>{
      let data = snap.docs.map(d=>({id:d.id,...d.data()}))
      data = data.filter(p=>teamIds.has(p.mechanic))
      setPointages(data)
      setLoading(false)
    })
  },[sel, userSpace])

  // Load all ORs (for calendar, km, status)
  useEffect(()=>{
    const q = query(collection(db,'ors'))
    return onSnapshot(q, snap=>{
      let data = snap.docs.map(d=>({id:d.id,...d.data()}))
      if (userSpace!=='all') data = data.filter(o=>!o.space||o.space===userSpace)
      setOrs(data)
    })
  },[userSpace])

  // Load photos
  useEffect(()=>{
    const q = query(collection(db,'photos'), where('dateKey','==',sel))
    return onSnapshot(q, snap=>{
      let data = snap.docs.map(d=>({docId:d.id,...d.data()}))
      // Filter by space via OR
      if (userSpace!=='all') {
        const spaceOrIds = new Set(ors.filter(o=>!o.space||o.space===userSpace).map(o=>o.id))
        data = data.filter(pd=>spaceOrIds.has(pd.orId))
      }
      setPhotos(data)
    })
  },[sel, userSpace, ors.length])

  const deletePhoto = async (photoDoc, photoItem) => {
    setDeletingPhoto(photoItem.url)
    try {
      const remaining=(photoDoc.photos||[]).filter(p=>p.url!==photoItem.url)
      if(remaining.length===0) await deleteDoc(doc(db,'photos',photoDoc.docId))
      else {
        const {updateDoc:upd,doc:fDoc}=await import('firebase/firestore')
        await upd(fDoc(db,'photos',photoDoc.docId),{photos:remaining})
      }
    } catch(e){console.error(e)}
    setDeletingPhoto(null)
  }

  // Stats
  const stats = team.map(m=>{
    const mine=pointages.filter(p=>p.mechanic===m.id)
    const totalMin=mine.filter(p=>p.end&&!p.isStandaloneNote).reduce((s,p)=>s+(p.duration_min||0),0)
    const active=mine.find(p=>p.end===null)
    return {...m,mine,totalMin,active}
  })
  const grandTotal=stats.reduce((s,m)=>s+m.totalMin,0)
  const rapportByOR=buildRapportByOR(pointages)
  const orsMap = useMemo(()=>{ const m={}; ors.forEach(o=>m[o.id]=o); return m },[ors])
  const weekDays = getWeekDays(calWeekStart)

  const buildRapportText = () => {
    const lines=[`RAPPORT DU ${fmtDayFull(sel).toUpperCase()}`,`Site: ${userSpace==='gt'?'Challenge GT · Bulle':userSpace==='challenge'?'Challenge · Vuisternens':'Tous sites'}`,``]
    rapportByOR.forEach(or=>{
      lines.push(`OR ${or.noFT} — ${or.client}${or.vehicule?' · '+or.vehicule:''}`)
      const o=orsMap[or.orId]; if(o?.km) lines.push(`Kilométrage : ${o.km.toLocaleString('fr-CH')} km`)
      const totalMin=or.entries.filter(e=>e.end&&!e.isStandaloneNote).reduce((s,e)=>s+(e.duration_min||0),0)
      lines.push(`Temps total : ${fmtMin(totalMin)}`)
      or.entries.forEach(e=>{if(e.note)lines.push(`  [${e.mechanicName}] ${e.note}`)})
      lines.push('')
    })
    return lines.join('\n')
  }
  const copyRapport=()=>{navigator.clipboard.writeText(buildRapportText());setCopied(true);setTimeout(()=>setCopied(false),2000)}

  const spaceLabel = userSpace==='gt' ? 'GT · Bulle' : userSpace==='challenge' ? 'Vuisternens' : 'Tous sites'
  const spaceColor = userSpace==='gt' ? '#a78bfa' : userSpace==='challenge' ? '#4fc3f7' : '#e8c547'

  return (
    <div style={s.root}>
      {selectedOR && <ORDetailOverlay orData={selectedOR} onClose={()=>setSelectedOR(null)}/>}

      <div style={s.header}>
        <button style={s.iconBtn} onClick={onBack}>←</button>
        <div style={{flex:1}}>
          <div style={s.title}>Tableau de bord</div>
          <div style={{fontSize:11,color:spaceColor,fontFamily:'var(--font-mono)',letterSpacing:'0.1em'}}>{spaceLabel}</div>
        </div>
        <button style={s.iconBtn} onClick={onLogout}>↩</button>
      </div>

      {/* Date pills */}
      <div style={s.dateRow}>
        {dates.map(d=>(
          <button key={d} style={{...s.chip,
            background:d===sel?'#e8c547':'rgba(255,255,255,0.04)',
            color:d===sel?'#000':d===tomorrow()?'#aaa':'#555',
            border:`1px solid ${d===sel?'#e8c547':d===tomorrow()?'#333':'#1e1e1e'}`,
            fontWeight:d===sel?700:d===tomorrow()?500:400
          }} onClick={()=>setSel(d)}>{labelDate(d)}</button>
        ))}
      </div>

      {/* View toggle */}
      <div style={s.viewToggle}>
        {[
          {id:'equipe',label:'Équipe'},
          {id:'rapport',label:'Rapports'},
          {id:'photos',label:'Photos'},
          {id:'cal_week',label:'Semaine'},
          {id:'cal_day',label:'Jour'},
        ].map(v=>(
          <button key={v.id} style={{...s.toggleBtn, background:view===v.id?'#1e1e1e':'transparent', color:view===v.id?'#fff':'#555'}} onClick={()=>setView(v.id)}>
            {v.label}
            {v.id==='photos' && photos.reduce((s,pd)=>s+(pd.photos||[]).length,0)>0 && (
              <span style={s.badge}>{photos.reduce((s,pd)=>s+(pd.photos||[]).length,0)}</span>
            )}
          </button>
        ))}
      </div>

      {/* Total bar - only for equipe/rapport */}
      {(view==='equipe'||view==='rapport') && (
        <div style={s.totalBar}>
          <span style={s.totalLabel}>TOTAL ÉQUIPE</span>
          <span style={{...s.totalVal, color:spaceColor}}>{fmtMin(grandTotal)}</span>
        </div>
      )}

      {/* Calendar week nav */}
      {view==='cal_week' && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',borderBottom:'1px solid #1e1e1e'}}>
          <button style={{...s.iconBtn,fontSize:16}} onClick={()=>{const d=new Date(calWeekStart+'T12:00:00');d.setDate(d.getDate()-7);setCalWeekStart(d.toISOString().split('T')[0])}}>‹ Préc.</button>
          <span style={{fontSize:12,color:'#666'}}>Semaine du {weekDays[0].split('-').reverse().slice(0,2).join('.')} au {weekDays[6].split('-').reverse().slice(0,2).join('.')}</span>
          <button style={{...s.iconBtn,fontSize:16}} onClick={()=>{const d=new Date(calWeekStart+'T12:00:00');d.setDate(d.getDate()+7);setCalWeekStart(d.toISOString().split('T')[0])}}>Suiv. ›</button>
        </div>
      )}

      <div style={s.content}>
        {loading && (view==='equipe'||view==='rapport') && <div style={s.empty}>Chargement...</div>}

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
                  <div key={p.id} style={{...s.pRow,cursor:'pointer'}} onClick={()=>setSelectedOR({id:p.orId,noFT:p.noFT,client:p.client,vehicule:p.vehicule})}>
                    <div style={s.pLeft}>
                      <span style={s.pOR}>OR {p.noFT}</span>
                      <span style={s.pClient}>{p.client}</span>
                      {p.note && <span style={s.pNote}>"{p.note}"</span>}
                    </div>
                    <span style={{...s.pDur,color:p.end===null?m.color:'#555'}}>{p.end===null?'⏱':fmtMin(p.duration_min)}</span>
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
            <button style={s.copyBtn} onClick={copyRapport}>{copied?'✓ Copié !':'📋 Copier rapport'}</button>
            {rapportByOR.length===0 && <div style={s.empty}>Aucun pointage</div>}
            {rapportByOR.map((or,i)=>{
              const totalMin=or.entries.filter(e=>e.end&&!e.isStandaloneNote).reduce((s,e)=>s+(e.duration_min||0),0)
              const o=orsMap[or.orId]
              const photoCount=photos.filter(pd=>pd.orId===or.orId).reduce((s,pd)=>s+(pd.photos||[]).length,0)
              return (
                <div key={i} style={{...s.rapportCard,cursor:'pointer'}} onClick={()=>setSelectedOR({id:or.orId,noFT:or.noFT,client:or.client,vehicule:or.vehicule})}>
                  <div style={s.rapportHead}>
                    <div>
                      <div style={s.rapportOR}>OR {or.noFT}</div>
                      <div style={s.rapportClient}>{or.client}</div>
                      {or.vehicule && <div style={s.rapportVeh}>{or.vehicule}</div>}
                      {o?.km && <div style={s.rapportKm}>🔢 {o.km.toLocaleString('fr-CH')} km</div>}
                      {photoCount>0 && <div style={s.rapportKm}>📷 {photoCount} photo{photoCount>1?'s':''}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                      <span style={s.rapportTotal}>{fmtMin(totalMin)}</span>
                      {o?.status==='completed' && <span style={{fontSize:10,fontWeight:700,color:'#47e88a',background:'rgba(71,232,138,0.1)',padding:'2px 8px',borderRadius:20}}>✓ Terminé</span>}
                    </div>
                  </div>
                  {or.entries.filter(e=>e.note).map((e,j)=>(
                    <div key={j} style={{padding:'8px 14px',borderTop:'1px solid #1a1a1a'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#666',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{e.mechanicName}</div>
                      <p style={{fontSize:13,color:'#ccc',lineHeight:1.55,margin:0}}>"{e.note}"</p>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}

        {/* PHOTOS */}
        {view==='photos' && (
          <>
            {photos.length===0 && <div style={s.empty}>Aucune photo pour cette journée</div>}
            {photos.map(pd=>(
              <div key={pd.docId} style={s.photoCard}>
                <div style={{marginBottom:10}}>
                  <div style={s.rapportOR}>OR {pd.noFT}</div>
                  <div style={s.rapportClient}>{pd.client}</div>
                </div>
                <div style={s.photoGrid}>
                  {(pd.photos||[]).map((p,i)=>(
                    <div key={i} style={{position:'relative'}}>
                      <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" style={s.photoThumb}/></a>
                      <button style={{...s.deleteBtn,opacity:deletingPhoto===p.url?0.4:1}} onClick={()=>deletePhoto(pd,p)} disabled={!!deletingPhoto}>
                        {deletingPhoto===p.url?'...':'🗑'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* CALENDRIER SEMAINE */}
        {view==='cal_week' && (
          <CalendarWeek
            ors={ors}
            weekDays={weekDays}
            team={team}
            onSelectOr={or=>setSelectedOR(or)}
            onSelectDay={d=>{setSel(d);setView('cal_day')}}
          />
        )}

        {/* CALENDRIER JOUR */}
        {view==='cal_day' && (
          <CalendarDay
            ors={ors}
            pointages={pointages}
            team={team}
            sel={sel}
            onSelectOr={or=>setSelectedOR(or)}
          />
        )}
      </div>
      <div style={{height:32}}/>
    </div>
  )
}

// ─── STYLES ─────────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight:'100dvh', background:'#0d0d0d', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', gap:10, padding:'14px 16px 12px', borderBottom:'1px solid #1e1e1e', position:'sticky', top:0, background:'#0d0d0d', zIndex:10 },
  iconBtn: { background:'transparent', color:'#555', fontSize:20, padding:'6px 8px', cursor:'pointer' },
  title: { fontWeight:800, fontSize:18, color:'#fff', lineHeight:1.1 },
  dateRow: { display:'flex', gap:5, padding:'8px 10px', overflowX:'auto', borderBottom:'1px solid #1e1e1e' },
  chip: { padding:'6px 12px', borderRadius:20, fontSize:12, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, transition:'all 0.15s' },
  viewToggle: { display:'flex', padding:'6px 10px', gap:4, borderBottom:'1px solid #1e1e1e', overflowX:'auto' },
  toggleBtn: { flex:'none', padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' },
  badge: { background:'#e8c547', color:'#000', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:10 },
  totalBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #1e1e1e' },
  totalLabel: { fontSize:10, color:'#555', fontFamily:'var(--font-mono)', letterSpacing:'0.15em' },
  totalVal: { fontSize:24, fontWeight:800, fontFamily:'var(--font-mono)' },
  content: { flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:7, overflowY:'auto' },
  empty: { textAlign:'center', color:'#444', padding:'48px 0', fontSize:14 },
  card: { background:'#111', border:'1px solid', borderRadius:14, overflow:'hidden' },
  cardHead: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px' },
  avatar: { width:38, height:38, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 },
  cardInfo: { flex:1 },
  cardName: { fontSize:16, fontWeight:800, color:'#fff' },
  cardRole: { fontSize:11, color:'#555', marginTop:1 },
  cardRight: { display:'flex', alignItems:'center', gap:6 },
  liveDot: { width:7, height:7, borderRadius:'50%' },
  cardTotal: { fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700 },
  rows: { borderTop:'1px solid #1a1a1a', padding:'4px 0' },
  pRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'7px 14px', gap:8 },
  pLeft: { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 },
  pOR: { fontFamily:'var(--font-mono)', fontSize:10, color:'#444' },
  pClient: { fontSize:13, fontWeight:600, color:'#ccc' },
  pNote: { fontSize:12, color:'#666', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  pDur: { fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, flexShrink:0 },
  noAct: { borderTop:'1px solid #1a1a1a', padding:'8px 14px', fontSize:11, color:'#333', fontStyle:'italic' },
  copyBtn: { padding:'12px', background:'rgba(232,197,71,0.08)', border:'1px solid rgba(232,197,71,0.2)', borderRadius:10, color:'#e8c547', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'center' },
  rapportCard: { background:'#111', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden' },
  rapportHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid #1a1a1a' },
  rapportOR: { fontFamily:'var(--font-mono)', fontSize:11, color:'#555', marginBottom:3 },
  rapportClient: { fontSize:16, fontWeight:800, color:'#fff' },
  rapportVeh: { fontSize:12, color:'#666', marginTop:2 },
  rapportKm: { fontSize:12, color:'#888', marginTop:3 },
  rapportTotal: { fontFamily:'var(--font-mono)', fontSize:17, fontWeight:700, color:'#e8c547' },
  photoCard: { background:'#111', border:'1px solid #1e1e1e', borderRadius:12, padding:12 },
  photoGrid: { display:'flex', flexWrap:'wrap', gap:7 },
  photoThumb: { width:96, height:96, objectFit:'cover', borderRadius:9, display:'block', border:'1px solid #2a2a2a' },
  deleteBtn: { position:'absolute', top:3, right:3, background:'rgba(0,0,0,0.75)', border:'none', borderRadius:5, padding:'3px 6px', fontSize:13, cursor:'pointer', lineHeight:1 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:50, display:'flex', alignItems:'flex-end', padding:12 },
  overlayBox: { width:'100%', background:'#131313', borderRadius:18, padding:20, border:'1px solid #2a2a2a', maxHeight:'80vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:8 },
  overlayHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 },
}
