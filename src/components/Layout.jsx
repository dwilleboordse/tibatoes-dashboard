import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Target, Calendar, Sparkles, TrendingUp, Users, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',                 label: 'Overview',         icon: LayoutDashboard },
  { to: '/okrs',             label: 'OKRs',             icon: Target },
  { to: '/calendar',         label: 'Calendar',         icon: Calendar },
  { to: '/creative-roadmap', label: 'Creative Roadmap', icon: Sparkles },
  { to: '/revenue',          label: 'Revenue Forecast', icon: TrendingUp },
  { to: '/creators',         label: 'Creators',         icon: Users },
]

const PAGE_TITLES = {
  '/':                 { title: 'Overview',          sub: 'Snapshot of TibaToes performance' },
  '/okrs':             { title: 'OKRs',              sub: 'Objectives & key results' },
  '/calendar':         { title: 'Calendar',          sub: 'Plan launches, content, and milestones' },
  '/creative-roadmap': { title: 'Creative Roadmap',  sub: 'Tests, batches, and learnings' },
  '/revenue':          { title: 'Revenue Forecast',  sub: 'Monthly targets vs. actuals' },
  '/creators':         { title: 'Creators',          sub: 'Top creators and content trends' },
}

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const { pathname } = useLocation()
  const head = PAGE_TITLES[pathname] ?? { title: 'TibaToes', sub: '' }

  const initials = (profile?.full_name ?? user?.email ?? 'TT')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TT</div>
          <div className="brand-text">
            <strong>TibaToes</strong>
            <span>Internal Dashboard</span>
          </div>
        </div>

        <div className="nav-section-label">Workspace</div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <button className="nav-link" onClick={signOut} style={{ background: 'transparent', border: 'none', textAlign: 'left' }}>
          <LogOut />
          <span>Sign out</span>
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{head.title}</h1>
            <span>{head.sub}</span>
          </div>
          <div className="topbar-right">
            <span className="pill violet"><span className="dot" /> Live</span>
            <div className="avatar" title={profile?.full_name ?? user?.email}>{initials}</div>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
