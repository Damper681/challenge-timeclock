import { useState } from 'react'
import * as XLSX from 'xlsx'
import { collection, doc, setDoc, getDocs, query, where, updateDoc, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

const CARROSSERIE_KW = ['carrosserie','sinistre','peinture','débosselage','pare-choc','pare choc','aile','capot','portière','vitre','pare-brise','parebrise','laquer','laquage','teinte','tôle','tole','bas d\'aile']

function isCarrosserie(travaux, lieu) {
  const text = (travaux + ' ' + (lieu||'')).toLowerCase()
  return CARROSSERIE_KW.some(k => text.includes(k))
}
function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] }
function parseArianDate(raw) {
  if (!raw) return null
  const cleaned = String(raw).replace(/\s|\t/g,'')
  const match = cleaned.match(/^(\d{1,2})\.(\d{2})$/)
  if (!match) return null
  return `${new Date().getFullYear()}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
}

function parseORs(data, targetDate, space) {
  const todayStr = targetDate || today()
  const ors = []
  let headerRow = -1
  for (let i=0; i<data.length; i++) {
    if (data[i] && String(data[i][0]).trim()==='No FT') { headerRow=i; break }
  }
  if (headerRow===-1) throw new Error("Colonne 'No FT' introuvable")
  const headers = data[headerRow].map(h=>String(h||'').trim())
  const idx = n => headers.findIndex(h=>h===n)
  const iNoFT=idx('No FT'), iArr=idx('Arrivée'), iDep=idx('Départ')
  const iClient=idx('Client'), iVeh=idx('Véhicule'), iPlaq=idx('Plaques')
  const iTrav=idx('Travaux'), iMec=idx('Mécano'), iLieu=idx('Lieu')
  let sansFtCounter = 0
  for (let i=headerRow+1; i<data.length; i++) {
    const row = data[i]
    if (!row) continue
    let noFT = String(row[iNoFT]||'').trim()
    if (noFT==='Somme') continue
    const arrivee = parseArianDate(row[iArr])
    const depart  = parseArianDate(row[iDep])
    if (!arrivee || !depart) continue
    if (!(todayStr>=arrivee && todayStr<=depart)) continue
    if (!noFT) { sansFtCounter++; noFT = `SANS-FT-${sansFtCounter}` }
    const travaux = String(row[iTrav]||'').trim()
    const lieu    = String(row[iLieu]||'').trim()
    ors.push({
      noFT, arrivee, depart, dateKey: todayStr,
      client:   String(row[iClient]||'').trim() || '(sans client)',
      vehicule: String(row[iVeh]||'').trim(),
      plaques:  String(row[iPlaq]||'').trim(),
      travaux:  travaux.slice(0,300),
      mécano:   String(row[iMec]||'').trim(),
      isCarrosserie: isCarrosserie(travaux, lieu),
      sansFT: noFT.startsWith('SANS-FT'),
      space,
    })
  }
  return ors
}

// ─── IMPORT PANEL (one per space) ─────────────────────────────────────────────
function ImportPanel({ space, color, label, location }) {
  const [step, setStep] = useState('idle')
  const [ors, setOrs] = useState([])
  const [diff, setDiff] = useState(null)
  const [error, setError] = useState('')
  const [pushed, setPushed] = useState(0)
  const [total, setTotal] = useState(0)
  const [importDate, setImportDate] = useState('today')

  const getDate = () => importDate==='tomorrow' ? tomorrow() : today()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStep('parsing'); setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, {type:'array'})
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''})
      const parsed = parseORs(data, getDate(), space)
      const snap = await getDocs(query(collection(db,'ors'), where('dateKey','==',getDate()), where('space','==',space)))
      const existing = snap.docs.map(d=>({docId:d.id,...d.data()}))
      const parsedKeys = new Set(parsed.map(o=>o.noFT))
      const existingKeys = new Set(existing.map(o=>o.noFT))
      const added = parsed.filter(o=>!existingKeys.has(o.noFT))
      const updated = parsed.filter(o=>existingKeys.has(o.noFT))
      const removed = existing.filter(o=>!parsedKeys.has(o.noFT) && !o.retired)
      setOrs(parsed); setDiff({added,updated,removed,existing}); setStep('confirm')
    } catch(err) { setError(err.message); setStep('error') }
    e.target.value = ''
  }

  const pushToFirebase = async () => {
    setStep('pushing')
    const allOps = [...diff.added, ...diff.updated, ...diff.removed]
    setTotal(allOps.length); setPushed(0)
    try {
      for (const or of diff.added) {
        await addDoc(collection(db,'ors'), {...or, activeMechanics:[], retired:false, importedAt:new Date().toISOString()})
        setPushed(p=>p+1)
      }
      for (const or of diff.updated) {
        const existing = diff.existing.find(e=>e.noFT===or.noFT)
        if (existing) {
          await updateDoc(doc(db,'ors',existing.docId), {
            client:or.client, vehicule:or.vehicule, plaques:or.plaques,
            travaux:or.travaux, mécano:or.mécano, isCarrosserie:or.isCarrosserie,
            arrivee:or.arrivee, depart:or.depart, retired:false, space,
            updatedAt:new Date().toISOString(),
          })
        }
        setPushed(p=>p+1)
      }
      for (const or of diff.removed) {
        const existing = diff.existing.find(e=>e.noFT===or.noFT)
        if (existing) await updateDoc(doc(db,'ors',existing.docId), {retired:true, retiredAt:new Date().toISOString()})
        setPushed(p=>p+1)
      }
      setStep('done')
    } catch(err) { setError(err.message); setStep('error') }
  }

  const reset = () => { setStep('idle'); setOrs([]); setDiff(null); setError(''); setPushed(0); setTotal(0) }
  const atelier = ors.filter(o=>!o.isCarrosserie)
  const carrosserie = ors.filter(o=>o.isCarrosserie)
  const sansFT = ors.filter(o=>o.sansFT)

  return (
    <div style={{...p.panel, borderColor: color+'40'}}>
      {/* Panel header */}
      <div style={p.panelHead}>
        <div style={{...p.dot, background:color}}/>
        <div>
          <div style={{...p.panelLabel, color}}>{label}</div>
          <div style={p.panelLoc}>{location}</div>
        </div>
      </div>

      {step==='idle' && (
        <>
          <div style={p.dateTabs}>
            <button style={{...p.dateTab, background:importDate==='today'?color:'transparent', color:importDate==='today'?'#000':'#888', border:`1px solid ${importDate==='today'?color:'#2a2a2a'}`}} onClick={()=>setImportDate('today')}>Aujourd'hui</button>
            <button style={{...p.dateTab, background:importDate==='tomorrow'?color:'transparent', color:importDate==='tomorrow'?'#000':'#888', border:`1px solid ${importDate==='tomorrow'?color:'#2a2a2a'}`}} onClick={()=>setImportDate('tomorrow')}>Demain</button>
          </div>
          <label style={{...p.uploadBtn, background:color, color:'#000'}}>
            📂 Importer le planning Ariane
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:'none'}}/>
          </label>
        </>
      )}

      {step==='parsing' && <div style={p.status}><div style={{...p.spinner, borderTopColor:color}}/> Lecture...</div>}

      {step==='confirm' && diff && (
        <div style={p.confirmView}>
          <div style={p.chips}>
            {diff.added.length>0 && <span style={{...p.chip, color:'#47e88a', borderColor:'rgba(71,232,138,0.3)'}}>+{diff.added.length} nouveau{diff.added.length>1?'x':''}</span>}
            {diff.updated.length>0 && <span style={{...p.chip, color:color, borderColor:color+'40'}}>↻ {diff.updated.length} mis à jour</span>}
            {diff.removed.length>0 && <span style={{...p.chip, color:'#e84747', borderColor:'rgba(232,71,71,0.3)'}}>− {diff.removed.length} retiré{diff.removed.length>1?'s':''}</span>}
            <span style={{...p.chip, color:'#888', borderColor:'#2a2a2a'}}>{atelier.length} atelier · {carrosserie.length} carrosserie</span>
            {sansFT.length>0 && <span style={{...p.chip, color:'#e84747', borderColor:'rgba(232,71,71,0.3)'}}>⚠ {sansFT.length} sans FT</span>}
          </div>
          <div style={p.orList}>
            {[...diff.added.map(o=>({...o,_state:'added'})), ...diff.updated.map(o=>({...o,_state:'updated'})), ...diff.removed.map(o=>({...o,_state:'removed'}))].map((or,i)=>(
              <div key={i} style={{...p.orRow, borderLeft:`3px solid ${or._state==='added'?'#47e88a':or._state==='removed'?'#e84747':color}`}}>
                <div>
                  <div style={{...p.orNum, color:or._state==='added'?'#47e88a':or._state==='removed'?'#e84747':color}}>
                    {or._state==='added'?'NEW':or._state==='removed'?'RET':'MAJ'} · OR {or.noFT}
                  </div>
                  <div style={p.orClient}>{or.client}</div>
                  <div style={p.orVeh}>{or.vehicule}{or.plaques?' · '+or.plaques:''}</div>
                </div>
                <span style={{fontSize:10,color:or.isCarrosserie?'#ffb74d':'#4fc3f7',fontWeight:600}}>{or.isCarrosserie?'Carros.':'Atelier'}</span>
              </div>
            ))}
          </div>
          <div style={p.actions}>
            <button style={p.cancelBtn} onClick={reset}>Annuler</button>
            <button style={{...p.pushBtn, background:color, color:'#000'}} onClick={pushToFirebase}>
              Publier {ors.length} OR →
            </button>
          </div>
        </div>
      )}

      {step==='pushing' && (
        <div style={p.status}>
          <div style={p.progressTrack}><div style={{...p.progressFill, width:`${total>0?(pushed/total)*100:0}%`, background:color}}/></div>
          <span style={{fontSize:13,color:'#aaa'}}>{pushed}/{total}</span>
        </div>
      )}

      {step==='done' && (
        <div style={p.status}>
          <span style={{fontSize:20}}>✓</span>
          <span style={{color:'#47e88a',fontWeight:700}}>{ors.length} OR publiés</span>
          <button style={p.againBtn} onClick={reset}>Nouveau fichier</button>
        </div>
      )}

      {step==='error' && (
        <div style={p.status}>
          <span style={{color:'#e84747',fontSize:13}}>{error}</span>
          <button style={p.againBtn} onClick={reset}>Réessayer</button>
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminScreen({ onDashboard, onLogout }) {
  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.adminAvatar}>A</div>
        <div style={s.hCenter}>
          <span style={s.hName}>Admin</span>
          <span style={s.hSub}>Gestion des plannings</span>
        </div>
        <button style={s.iconBtn} onClick={onDashboard}>⊞</button>
        <button style={s.iconBtn} onClick={onLogout}>↩</button>
      </div>

      <div style={s.body}>
        <ImportPanel
          space="challenge"
          color="#4fc3f7"
          label="CHALLENGE"
          location="Vuisternens"
        />
        <ImportPanel
          space="gt"
          color="#a78bfa"
          label="CHALLENGE GT"
          location="Bulle"
        />
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const p = {
  panel: { border:'1px solid', borderRadius:14, padding:16, background:'rgba(255,255,255,0.02)', display:'flex', flexDirection:'column', gap:10 },
  panelHead: { display:'flex', alignItems:'center', gap:10, marginBottom:2 },
  dot: { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  panelLabel: { fontSize:12, fontWeight:800, letterSpacing:'0.14em', fontFamily:'var(--font-mono)' },
  panelLoc: { fontSize:11, color:'#555', marginTop:1 },
  dateTabs: { display:'flex', gap:6 },
  dateTab: { flex:1, padding:'8px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  uploadBtn: { padding:'13px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', display:'block', textAlign:'center', border:'none' },
  status: { display:'flex', alignItems:'center', gap:10, padding:'4px 0', flexWrap:'wrap' },
  spinner: { width:20, height:20, border:'2px solid #2a2a2a', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 },
  progressTrack: { flex:1, height:4, background:'#1e1e1e', borderRadius:2, overflow:'hidden', minWidth:80 },
  progressFill: { height:'100%', borderRadius:2, transition:'width 0.2s' },
  confirmView: { display:'flex', flexDirection:'column', gap:8 },
  chips: { display:'flex', flexWrap:'wrap', gap:6 },
  chip: { fontSize:11, fontWeight:600, border:'1px solid', padding:'3px 9px', borderRadius:20 },
  orList: { maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 },
  orRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'#111', borderRadius:7, border:'1px solid #1e1e1e' },
  orNum: { fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, marginBottom:2 },
  orClient: { fontSize:13, fontWeight:700, color:'#f0f0f0' },
  orVeh: { fontSize:11, color:'#555' },
  actions: { display:'flex', gap:8 },
  cancelBtn: { flex:1, padding:'11px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:9, color:'#555', fontSize:13, fontWeight:600, cursor:'pointer' },
  pushBtn: { flex:2, padding:'11px', borderRadius:9, fontSize:14, fontWeight:800, cursor:'pointer', border:'none' },
  againBtn: { padding:'7px 14px', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, color:'#ccc', fontSize:12, fontWeight:600, cursor:'pointer' },
}

const s = {
  root: { minHeight:'100dvh', background:'#0d0d0d', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', gap:10, padding:'16px 16px 14px', borderBottom:'1px solid #1e1e1e' },
  adminAvatar: { width:40, height:40, borderRadius:'50%', background:'rgba(232,197,71,0.15)', color:'#e8c547', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:17 },
  hCenter: { flex:1, display:'flex', flexDirection:'column' },
  hName: { fontWeight:800, fontSize:17, color:'#e8c547' },
  hSub: { fontSize:12, color:'#555' },
  iconBtn: { background:'transparent', color:'#555', fontSize:20, padding:'6px 8px', cursor:'pointer' },
  body: { flex:1, padding:14, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' },
}
