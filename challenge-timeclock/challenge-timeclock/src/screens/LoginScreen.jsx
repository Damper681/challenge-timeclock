import { useState } from 'react'

const USERS = [
  { id: 'jose',     name: 'José',     role: 'mechanic',   label: 'Mécanicien',     color: '#4fc3f7' },
  { id: 'vivian',   name: 'Vivian',   role: 'mechanic',   label: 'Mécanicien',     color: '#81c784' },
  { id: 'valentin', name: 'Valentin', role: 'carrossier', label: 'Carrossier',     color: '#ffb74d' },
  { id: 'sara',     name: 'Sara',     role: 'admin',      label: 'Administration', color: '#e8c547' },
]

export default function LoginScreen({ onLogin }) {
  const [pressed, setPressed] = useState(null)
  const handleSelect = (u) => { setPressed(u.id); setTimeout(() => onLogin(u), 180) }

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
        <p style={s.prompt}>Qui es-tu ?</p>
        <div style={s.grid}>
          {USERS.map(u => (
            <button key={u.id} style={{...s.card,
              borderColor: pressed===u.id ? u.color : 'rgba(255,255,255,0.07)',
              background: pressed===u.id ? u.color+'15' : 'rgba(255,255,255,0.03)',
              transform: pressed===u.id ? 'scale(0.96)' : 'scale(1)',
            }} onClick={() => handleSelect(u)}>
              <div style={{...s.avatar, background: u.color+'18', color: u.color}}>{u.name[0]}</div>
              <div style={{...s.name, color: pressed===u.id ? u.color : '#f0f0f0'}}>{u.name}</div>
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
  inner: { width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1 },
  brand: { display:'flex', alignItems:'center', gap:14, marginBottom:52 },
  logo: { width:50, height:50, borderRadius:13, background:'#e8c547', color:'#000', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:17, display:'flex', alignItems:'center', justifyContent:'center', letterSpacing:'0.05em' },
  brandName: { fontWeight:800, fontSize:21, letterSpacing:'0.2em', color:'#f0f0f0', lineHeight:1 },
  brandSub: { fontSize:9, letterSpacing:'0.22em', color:'#555', marginTop:5, fontFamily:'var(--font-mono)' },
  prompt: { fontSize:12, color:'#555', letterSpacing:'0.1em', marginBottom:18 },
  grid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%' },
  card: { display:'flex', flexDirection:'column', alignItems:'center', padding:'22px 12px 18px', borderRadius:16, border:'1px solid', cursor:'pointer', transition:'all 0.15s ease', gap:9 },
  avatar: { width:50, height:50, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, fontWeight:700 },
  name: { fontSize:17, fontWeight:700, transition:'color 0.15s' },
  label: { fontSize:10, color:'#555', letterSpacing:'0.08em', textTransform:'uppercase' },
  footer: { position:'fixed', bottom:16, fontSize:10, color:'#222', fontFamily:'var(--font-mono)', letterSpacing:'0.1em' }
}
