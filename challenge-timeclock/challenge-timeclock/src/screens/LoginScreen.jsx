import { useState } from 'react'

const SPACES = {
  challenge: {
    id: 'challenge',
    label: 'CHALLENGE',
    location: 'Vuisternens',
    color: '#4fc3f7',
    users: [
      { id: 'jose',     name: 'José',     role: 'mechanic',   label: 'Mécanicien',  color: '#4fc3f7' },
      { id: 'vivian',   name: 'Vivian',   role: 'mechanic',   label: 'Mécanicien',  color: '#6ee7a0' },
      { id: 'valentin', name: 'Valentin', role: 'carrossier', label: 'Carrossier',  color: '#ffb74d' },
      { id: 'marius_c', name: 'Marius',   role: 'mechanic',   label: 'Mécanicien',  color: '#f472b6' },
      { id: 'damien_c', name: 'Damien',   role: 'mechanic',   label: 'Mécanicien',  color: '#a78bfa' },
      { id: 'admin_c',  name: 'Admin',    role: 'admin',      label: 'Admin',       color: '#e8c547' },
    ]
  },
  gt: {
    id: 'gt',
    label: 'CHALLENGE GT',
    location: 'Bulle',
    color: '#a78bfa',
    users: [
      { id: 'marius',  name: 'Marius',  role: 'mechanic', label: 'Mécanicien', color: '#f472b6' },
      { id: 'damien',  name: 'Damien',  role: 'mechanic', label: 'Mécanicien', color: '#a78bfa' },
      { id: 'admin_g', name: 'Admin',   role: 'admin',    label: 'Admin',      color: '#e8c547' },
    ]
  }
}

export default function LoginScreen({ onLogin }) {
  const [space, setSpace] = useState(null)
  const [pressed, setPressed] = useState(null)

  const handleSelect = (u) => {
    setPressed(u.id)
    setTimeout(() => onLogin({ ...u, space: space.id }), 180)
  }

  // Step 1: choose space
  if (!space) {
    return (
      <div style={s.root}>
        <div style={s.glow} />
        <div style={s.inner}>
          <div style={s.brand}>
            <div style={s.logo}>CA</div>
            <div>
              <div style={s.brandName}>CHALLENGE</div>
              <div style={s.brandSub}>ATELIER · POINTAGE</div>
            </div>
          </div>
          <p style={s.prompt}>Choisir le site</p>
          <div style={s.spaceGrid}>
            {Object.values(SPACES).map(sp => (
              <button key={sp.id} style={{...s.spaceCard, borderColor:sp.color+'50', background:sp.color+'0a'}} onClick={()=>setSpace(sp)}>
                <div style={{...s.spaceDot, background:sp.color}}/>
                <div style={{...s.spaceLabel, color:sp.color}}>{sp.label}</div>
                <div style={s.spaceLoc}>{sp.location}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={s.footer}>Challenge Automobile · v1.0</div>
      </div>
    )
  }

  // Step 2: choose person
  return (
    <div style={s.root}>
      <div style={s.glow} />
      <div style={s.inner}>
        <button style={s.backBtn} onClick={()=>{ setSpace(null); setPressed(null) }}>← Retour</button>
        <div style={{...s.siteHeader, borderColor:space.color+'30'}}>
          <div style={{...s.spaceDot, background:space.color}}/>
          <div>
            <div style={{...s.spaceLabel2, color:space.color}}>{space.label}</div>
            <div style={s.spaceLoc}>{space.location}</div>
          </div>
        </div>
        <div style={s.grid}>
          {space.users.map(u => (
            <button key={u.id} style={{
              ...s.card,
              borderColor: pressed===u.id ? u.color : 'rgba(255,255,255,0.07)',
              background: pressed===u.id ? u.color+'15' : 'rgba(255,255,255,0.03)',
              transform: pressed===u.id ? 'scale(0.96)' : 'scale(1)',
            }} onClick={() => handleSelect(u)}>
              <div style={{...s.avatar, background:u.color+'18', color:u.color}}>{u.name[0]}</div>
              <div style={{...s.name, color:pressed===u.id?u.color:'#f0f0f0'}}>{u.name}</div>
              <div style={s.label}>{u.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={s.footer}>Challenge Automobile · v1.0</div>
    </div>
  )
}

const s = {
  root: { minHeight:'100dvh', background:'#080808', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', position:'relative', overflow:'hidden' },
  glow: { position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:500, height:300, background:'radial-gradient(ellipse, rgba(232,197,71,0.07) 0%, transparent 70%)', pointerEvents:'none' },
  inner: { width:'100%', maxWidth:400, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1 },
  brand: { display:'flex', alignItems:'center', gap:14, marginBottom:32, justifyContent:'center' },
  logo: { width:50, height:50, borderRadius:13, background:'#e8c547', color:'#000', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:17, display:'flex', alignItems:'center', justifyContent:'center' },
  brandName: { fontWeight:800, fontSize:21, letterSpacing:'0.2em', color:'#f0f0f0', lineHeight:1 },
  brandSub: { fontSize:9, letterSpacing:'0.22em', color:'#555', marginTop:5, fontFamily:'var(--font-mono)' },
  prompt: { fontSize:12, color:'#555', letterSpacing:'0.1em', marginBottom:20 },
  spaceGrid: { display:'flex', flexDirection:'column', gap:12, width:'100%' },
  spaceCard: { padding:'24px 20px', borderRadius:16, border:'1px solid', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:14, textAlign:'left' },
  spaceDot: { width:10, height:10, borderRadius:'50%', flexShrink:0 },
  spaceLabel: { fontSize:16, fontWeight:800, letterSpacing:'0.1em' },
  spaceLoc: { fontSize:12, color:'#555', marginTop:3 },
  backBtn: { background:'transparent', border:'none', color:'#555', fontSize:14, fontWeight:600, cursor:'pointer', padding:'4px 0', alignSelf:'flex-start', marginBottom:16 },
  siteHeader: { display:'flex', alignItems:'center', gap:12, width:'100%', padding:'14px 16px', borderRadius:12, border:'1px solid', marginBottom:16, background:'rgba(255,255,255,0.02)' },
  spaceLabel2: { fontSize:14, fontWeight:800, letterSpacing:'0.1em' },
  grid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%' },
  card: { display:'flex', flexDirection:'column', alignItems:'center', padding:'18px 10px 14px', borderRadius:14, border:'1px solid', cursor:'pointer', transition:'all 0.15s ease', gap:8 },
  avatar: { width:46, height:46, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 },
  name: { fontSize:17, fontWeight:700, transition:'color 0.15s' },
  label: { fontSize:10, color:'#555', letterSpacing:'0.08em', textTransform:'uppercase' },
  footer: { position:'fixed', bottom:16, fontSize:10, color:'#222', fontFamily:'var(--font-mono)', letterSpacing:'0.1em' }
}
