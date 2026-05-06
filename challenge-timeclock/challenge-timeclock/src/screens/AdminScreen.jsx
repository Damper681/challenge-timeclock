import { useState } from 'react'
import * as XLSX from 'xlsx'
import { collection, doc, setDoc, getDocs, query, where, updateDoc, addDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

const CARROSSERIE_KW = ['carrosserie','sinistre','peinture','débosselage','pare-choc','pare choc','aile','capot','portière','vitre','pare-brise','parebrise','laquer','laquage','teinte','tôle','tole','bas d\'aile']

function isCarrosserie(travaux, lieu) {
  const text = (travaux + ' ' + (lieu||'')).toLowerCase()
  return CARROSSERIE_KW.some(k => text.includes(k))
}
function today() { return new Date().toISOString().split('T')[0] }
function parseArianDate(raw) {
  if (!raw) return null
  const cleaned = String(raw).replace(/\s|\t/g,'')
  const match = cleaned.match(/^(\d{1,2})\.(\d{2})$/)
  if (!match) return null
  return `${new Date().getFullYear()}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
}

function parseORs(data, targetDate) {
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
    })
  }
  return ors
}

const CARROSSERIE_KW2 = ["carrosserie","sinistre","peinture","pare-choc","aile","capot","portière","vitre","pare-brise","tôle","tole"]

async function createManualOR(fields) {
  const travaux = fields.travaux || ""
  await addDoc(collection(db,"ors"), {
    noFT: fields.noFT || `MANUEL-${Date.now()}`,
    client: fields.client || "(sans client)",
    vehicule: fields.vehicule || "",
    plaques: fields.plaques || "",
    travaux: travaux.slice(0,300),
    mécano: fields.mécano || "",
    dateKey: today(),
    arrivee: today(), depart: "",
    isCarrosserie: CARROSSERIE_KW2.some(k=>travaux.toLowerCase().includes(k)),
    sansFT: !fields.noFT, status: "active", retired: false,
    activeMechanics: [], importedAt: new Date().toISOString(), isManual: true,
  })
}

function ManualORForm({ onSave, onCancel }) {
  const [f, setF] = useState({ noFT:"", client:"", vehicule:"", plaques:"", travaux:"", mécano:"" })
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const fields = [
    {key:"noFT",label:"N° FT (optionnel)",placeholder:"Ex : 19583"},
    {key:"client",label:"Client *",placeholder:"Nom du client"},
    {key:"vehicule",label:"Véhicule",placeholder:"Ex : VW Golf VII"},
    {key:"plaques",label:"Plaques",placeholder:"Ex : FR 123456"},
    {key:"mécano",label:"Mécanicien assigné",placeholder:"José, Vivian..."},
  ]
  return (
    <div style={mf.root}>
      <p style={mf.title}>Ajouter un OR manuellement</p>
      <p style={mf.sub}>Pour les FT longue durée hors planning</p>
      {fields.map(({key,label,placeholder})=>(
        <div key={key} style={mf.field}>
          <label style={mf.label}>{label}</label>
          <input style={mf.input} placeholder={placeholder} value={f[key]} onChange={e=>set(key,e.target.value)}/>
        </div>
      ))}
      <div style={mf.field}>
        <label style={mf.label}>Travaux à effectuer</label>
        <textarea style={mf.ta} placeholder="Description..." value={f.travaux} onChange={e=>set("travaux",e.target.value)} rows={3}/>
      </div>
      <div style={mf.actions}>
        <button style={mf.cancel} onClick={onCancel}>Annuler</button>
        <button style={mf.save} onClick={()=>{ if(!f.client.trim()){alert("Client requis");return}; onSave(f) }}>Créer l'OR</button>
      </div>
    </div>
  )
}

const mf = {
  root:{display:"flex",flexDirection:"column",gap:14,flex:1,overflowY:"auto"},
  title:{fontSize:20,fontWeight:800,color:"#fff",margin:0},
  sub:{fontSize:13,color:"#555",margin:0},
  field:{display:"flex",flexDirection:"column",gap:6},
  label:{fontSize:11,letterSpacing:"0.12em",color:"#555",fontFamily:"var(--font-mono)"},
  input:{background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:16,padding:"12px 14px",outline:"none",fontFamily:"var(--font-body)"},
  ta:{background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:15,padding:"12px 14px",outline:"none",fontFamily:"var(--font-body)",resize:"none",lineHeight:1.5},
  actions:{display:"flex",gap:10,paddingTop:4},
  cancel:{flex:1,padding:"14px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:12,color:"#555",fontSize:14,fontWeight:600,cursor:"pointer"},
  save:{flex:2,padding:"14px",background:"#e8c547",borderRadius:12,color:"#000",fontSize:15,fontWeight:800,cursor:"pointer"},
}

export default function AdminScreen({ onDashboard, onLogout }) {
  const [step, setStep] = useState('idle')
  const [space, setSpace] = useState('challenge') // 'challenge' | 'gt'
  const [ors, setOrs] = useState([])
  const [diff, setDiff] = useState(null) // { added, updated, removed }
  const [error, setError] = useState('')
  const [pushed, setPushed] = useState(0)
  const [total, setTotal] = useState(0)

  const [importDate, setImportDate] = useState('today') // 'today' | 'tomorrow'

  const getImportDate = () => {
    if (importDate === 'tomorrow') {
      const d = new Date(); d.setDate(d.getDate()+1)
      return d.toISOString().split('T')[0]
    }
    return today()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStep('parsing'); setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, {type:'array'})
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''})
      const parsed = parseORs(data, getImportDate())

      // Load existing ORs for today
      const snap = await getDocs(query(collection(db,'ors'), where('dateKey','==',today())))
      const existing = snap.docs.map(d=>({docId:d.id,...d.data()}))

      // Compute diff
      const parsedKeys = new Set(parsed.map(o=>o.noFT))
      const existingKeys = new Set(existing.map(o=>o.noFT))

      const added = parsed.filter(o=>!existingKeys.has(o.noFT))
      const updated = parsed.filter(o=>existingKeys.has(o.noFT))
      const removed = existing.filter(o=>!parsedKeys.has(o.noFT) && !o.retired)
      const alreadyRetired = existing.filter(o=>o.retired && !parsedKeys.has(o.noFT))

      setOrs(parsed)
      setDiff({ added, updated, removed, existing, alreadyRetired })
      setStep('confirm')
    } catch(err) { setError(err.message); setStep('error') }
  }

  const pushToFirebase = async () => {
    setStep('pushing')
    const allOps = [...diff.added, ...diff.updated, ...diff.removed]
    setTotal(allOps.length); setPushed(0)

    try {
      const todayStr = today()
      const snap = await getDocs(query(collection(db,'ors'), where('dateKey','==',todayStr)))
      const existingDocs = snap.docs.map(d=>({docId:d.id,...d.data()}))

      // ADD new ORs
      for (const or of diff.added) {
        await addDoc(collection(db,'ors'), {
          ...or, activeMechanics:[], importedAt: new Date().toISOString(), retired: false
        })
        setPushed(p=>p+1)
      }

      // UPDATE existing ORs — preserve activeMechanics, km, retired:false
      for (const or of diff.updated) {
        const existing = existingDocs.find(e=>e.noFT===or.noFT)
        if (existing) {
          await updateDoc(doc(db,'ors',existing.docId), {
            client: or.client, vehicule: or.vehicule, plaques: or.plaques,
            travaux: or.travaux, mécano: or.mécano, isCarrosserie: or.isCarrosserie,
            arrivee: or.arrivee, depart: or.depart, retired: false,
            updatedAt: new Date().toISOString(),
          })
        }
        setPushed(p=>p+1)
      }

      // RETIRE removed ORs — keep them visible but marked
      for (const or of diff.removed) {
        const existing = existingDocs.find(e=>e.noFT===or.noFT)
        if (existing) {
          await updateDoc(doc(db,'ors',existing.docId), { retired: true, retiredAt: new Date().toISOString() })
        }
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
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.adminAvatar}>A</div>
        <div style={s.hCenter}>
          <span style={s.hName}>Sara</span>
          <span style={s.hSub}>Administration</span>
        </div>
        <button style={s.iconBtn} onClick={onDashboard}>⊞</button>
        <button style={s.iconBtn} onClick={onLogout}>↩</button>
      </div>

      <div style={s.body}>
        {step==='idle' && (
          <div style={s.uploadZone}>
            <div style={s.uploadIcon}>📂</div>
            <p style={s.uploadTitle}>Importer / mettre à jour les OR</p>
            <p style={s.uploadHint}>Les pointages et notes existants sont préservés</p>
            <label style={s.uploadBtn}>
              Choisir le fichier Ariane
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:'none'}}/>
            </label>
            <div style={s.divider}><span style={s.dividerText}>ou</span></div>
            <button style={s.manualBtn} onClick={()=>setStep('manual')}>+ Créer un OR manuellement</button>
            <p style={s.dateStr}>{new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long'})}</p>
          </div>
        )}
        {step==='manual' && (
          <ManualORForm
            onSave={async (fields)=>{ await createManualOR(fields); setStep('done') }}
            onCancel={()=>setStep('idle')}
          />
        )}

        {step==='parsing' && (
          <div style={s.center}><div style={s.spinner}/><p style={s.statusText}>Analyse du fichier...</p></div>
        )}

        {step==='confirm' && diff && (
          <div style={s.confirmView}>
            {/* Diff summary */}
            <div style={s.diffSummary}>
              {diff.added.length>0 && (
                <div style={{...s.diffChip, background:'rgba(71,232,138,0.1)', borderColor:'rgba(71,232,138,0.25)', color:'#47e88a'}}>
                  +{diff.added.length} nouveau{diff.added.length>1?'x':''}
                </div>
              )}
              {diff.updated.length>0 && (
                <div style={{...s.diffChip, background:'rgba(232,197,71,0.1)', borderColor:'rgba(232,197,71,0.25)', color:'#e8c547'}}>
                  ↻ {diff.updated.length} mis à jour
                </div>
              )}
              {diff.removed.length>0 && (
                <div style={{...s.diffChip, background:'rgba(232,71,71,0.1)', borderColor:'rgba(232,71,71,0.25)', color:'#e84747'}}>
                  − {diff.removed.length} retiré{diff.removed.length>1?'s':''}
                </div>
              )}
              {diff.added.length===0 && diff.updated.length>0 && diff.removed.length===0 && (
                <div style={{...s.diffChip, background:'rgba(255,255,255,0.05)', borderColor:'#333', color:'#888'}}>
                  Aucun changement détecté
                </div>
              )}
            </div>

            <p style={s.diffNote}>
              Les OR retirés du planning restent visibles avec un avertissement. Les pointages, notes et photos ne sont jamais supprimés.
            </p>

            {sansFT.length>0 && (
              <div style={s.warnBox}>⚠️ {sansFT.length} OR sans numéro FT</div>
            )}

            {/* List */}
            <div style={s.orList}>
              {/* New */}
              {diff.added.map((or,i)=>(
                <div key={'a'+i} style={{...s.orRow, borderLeft:'3px solid #47e88a'}}>
                  <div style={s.orRowLeft}>
                    <span style={{...s.orRowNum, color:'#47e88a'}}>NOUVEAU · OR {or.noFT}</span>
                    <span style={s.orRowClient}>{or.client}</span>
                    <span style={s.orRowVeh}>{or.vehicule}{or.plaques?' · '+or.plaques:''}</span>
                  </div>
                  <span style={{...s.orRowTag, color: or.isCarrosserie?'#ffb74d':'#4fc3f7'}}>
                    {or.isCarrosserie?'Carrosserie':'Atelier'}
                  </span>
                </div>
              ))}
              {/* Updated */}
              {diff.updated.map((or,i)=>(
                <div key={'u'+i} style={{...s.orRow, borderLeft:'3px solid #e8c547'}}>
                  <div style={s.orRowLeft}>
                    <span style={{...s.orRowNum, color:'#e8c547'}}>MAJ · OR {or.noFT}</span>
                    <span style={s.orRowClient}>{or.client}</span>
                    <span style={s.orRowVeh}>{or.vehicule}{or.plaques?' · '+or.plaques:''}</span>
                  </div>
                  <span style={{...s.orRowTag, color: or.isCarrosserie?'#ffb74d':'#4fc3f7'}}>
                    {or.isCarrosserie?'Carrosserie':'Atelier'}
                  </span>
                </div>
              ))}
              {/* Removed */}
              {diff.removed.map((or,i)=>(
                <div key={'r'+i} style={{...s.orRow, borderLeft:'3px solid #e84747', opacity:0.6}}>
                  <div style={s.orRowLeft}>
                    <span style={{...s.orRowNum, color:'#e84747'}}>RETIRÉ · OR {or.noFT}</span>
                    <span style={s.orRowClient}>{or.client}</span>
                    <span style={s.orRowVeh}>Restera visible avec avertissement</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={s.confirmActions}>
              <button style={s.cancelBtn} onClick={reset}>Annuler</button>
              <button style={s.pushBtn} onClick={pushToFirebase}>
                Appliquer les changements →
              </button>
            </div>
          </div>
        )}

        {step==='pushing' && (
          <div style={s.center}>
            <div style={s.progressTrack}>
              <div style={{...s.progressFill, width:total>0?`${(pushed/total)*100}%`:'0%'}}/>
            </div>
            <p style={s.statusText}>{pushed} / {total} traités...</p>
          </div>
        )}

        {step==='done' && (
          <div style={s.center}>
            <div style={s.successIcon}>✓</div>
            <p style={s.statusText}>Planning mis à jour</p>
            <p style={s.statusSub}>Pointages et notes préservés</p>
            <button style={s.againBtn} onClick={reset}>Importer un autre fichier</button>
          </div>
        )}

        {step==='error' && (
          <div style={s.center}>
            <div style={s.errIcon}>!</div>
            <p style={s.statusText}>Erreur</p>
            <p style={s.errMsg}>{error}</p>
            <button style={s.againBtn} onClick={reset}>Réessayer</button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  root: { minHeight:'100dvh', background:'#0d0d0d', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', gap:10, padding:'16px 16px 14px', borderBottom:'1px solid #1e1e1e' },
  adminAvatar: { width:40, height:40, borderRadius:'50%', background:'rgba(232,197,71,0.15)', color:'#e8c547', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:17 },
  hCenter: { flex:1, display:'flex', flexDirection:'column' },
  hName: { fontWeight:800, fontSize:17, color:'#e8c547' },
  hSub: { fontSize:12, color:'#555' },
  iconBtn: { background:'transparent', color:'#555', fontSize:20, padding:'6px 8px', cursor:'pointer' },
  body: { flex:1, display:'flex', flexDirection:'column', padding:18 },
  uploadZone: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, textAlign:'center' },
  uploadIcon: { fontSize:48, marginBottom:4 },
  uploadTitle: { fontSize:20, fontWeight:800, color:'#fff' },
  uploadHint: { fontSize:13, color:'#555' },
  uploadBtn: { marginTop:16, padding:'14px 32px', background:'#e8c547', color:'#000', borderRadius:12, fontWeight:800, fontSize:15, cursor:'pointer', display:'inline-block' },
  dateStr: { marginTop:20, fontSize:11, color:'#2a2a2a', textTransform:'capitalize', fontFamily:'var(--font-mono)' },
  dateTabs: { display:'flex', gap:8 },
  dateTab: { padding:'8px 20px', borderRadius:20, fontSize:14, fontWeight:600, cursor:'pointer' },
  divider: { display:'flex', alignItems:'center', width:'100%', maxWidth:280, gap:10 },
  dividerText: { fontSize:12, color:'#333', flexShrink:0 },
  manualBtn: { padding:'13px 24px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:12, color:'#888', fontSize:14, fontWeight:600, cursor:'pointer' },
  center: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, textAlign:'center' },
  spinner: { width:36, height:36, border:'3px solid #1e1e1e', borderTopColor:'#e8c547', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  statusText: { fontSize:18, fontWeight:700, color:'#fff' },
  statusSub: { fontSize:13, color:'#555' },
  successIcon: { width:64, height:64, borderRadius:'50%', background:'rgba(71,232,138,0.1)', color:'#47e88a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700 },
  errIcon: { width:64, height:64, borderRadius:'50%', background:'rgba(232,71,71,0.1)', color:'#e84747', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700 },
  errMsg: { fontSize:13, color:'#e84747', maxWidth:300 },
  againBtn: { marginTop:8, padding:'12px 24px', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' },
  progressTrack: { width:'75%', height:5, background:'#1e1e1e', borderRadius:3, overflow:'hidden' },
  progressFill: { height:'100%', background:'#e8c547', borderRadius:3, transition:'width 0.2s' },
  confirmView: { display:'flex', flexDirection:'column', gap:12, flex:1 },
  diffSummary: { display:'flex', gap:8, flexWrap:'wrap', paddingTop:4 },
  diffChip: { padding:'6px 14px', borderRadius:20, border:'1px solid', fontSize:13, fontWeight:700 },
  diffNote: { fontSize:12, color:'#555', lineHeight:1.5, padding:'10px 12px', background:'#111', borderRadius:8, border:'1px solid #1e1e1e', margin:0 },
  warnBox: { background:'rgba(232,71,71,0.08)', border:'1px solid rgba(232,71,71,0.2)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#e84747' },
  orList: { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 },
  orRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 12px', background:'#111', borderRadius:8, border:'1px solid #1e1e1e' },
  orRowLeft: { display:'flex', flexDirection:'column', gap:3 },
  orRowNum: { fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, letterSpacing:'0.06em' },
  orRowClient: { fontSize:15, fontWeight:700, color:'#fff' },
  orRowVeh: { fontSize:12, color:'#555' },
  orRowTag: { fontSize:11, fontWeight:600, letterSpacing:'0.06em', flexShrink:0 },
  confirmActions: { display:'flex', gap:8, paddingTop:4 },
  cancelBtn: { flex:1, padding:'14px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:12, color:'#555', fontSize:14, fontWeight:600, cursor:'pointer' },
  pushBtn: { flex:2, padding:'14px', background:'#e8c547', borderRadius:12, color:'#000', fontSize:15, fontWeight:800, cursor:'pointer' },
}
