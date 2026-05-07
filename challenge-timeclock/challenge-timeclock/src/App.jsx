import { useState } from 'react'
import LoginScreen from './screens/LoginScreen.jsx'
import MechanicScreen from './screens/MechanicScreen.jsx'
import AdminScreen from './screens/AdminScreen.jsx'
import DashboardScreen from './screens/DashboardScreen.jsx'

const SESSION_KEY = 'challenge_tc_user'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
  })
  const [screen, setScreen] = useState('main')

  const login = (u) => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)); setUser(u) }
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setUser(null); setScreen('main') }

  if (!user) return <LoginScreen onLogin={login}/>

  if (screen==='dashboard') return <DashboardScreen user={user} onBack={()=>setScreen('main')} onLogout={logout}/>

  if (user.role==='admin') return <AdminScreen user={user} onDashboard={()=>setScreen('dashboard')} onLogout={logout}/>

  return <MechanicScreen user={user} onLogout={logout} onDashboard={()=>setScreen('dashboard')}/>
}
