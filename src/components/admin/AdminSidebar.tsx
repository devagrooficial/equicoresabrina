import { useState, useEffect } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.1)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  sidebar: 'hsl(var(--sidebar-background))',
};

const NAV = [
  {
    href: '/admin',
    label: 'Dashboard',
    exact: true,
    badge: null,
    icon: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  },
  {
    href: '/admin/usuarios',
    label: 'Usuários',
    exact: false,
    badge: null,
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    href: '/admin/equinos',
    label: 'Equinos',
    exact: false,
    badge: null,
    icon: '<path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/>',
  },
  {
    href: '/admin/assinaturas',
    label: 'Assinaturas',
    exact: false,
    badge: null,
    icon: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  },
  {
    href: '/admin/afiliados',
    label: 'Afiliados',
    exact: false,
    badge: 3,
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    href: '/admin/configuracoes',
    label: 'Configurações',
    exact: false,
    badge: null,
    icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  },
];

function Svg({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
}

export default function AdminSidebar({ currentPath }: { currentPath: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function isActive(href: string, exact: boolean) {
    if (exact) return currentPath === href;
    return currentPath.startsWith(href);
  }

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh', display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${C.border}`, background: C.sidebar,
      position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto',
    }}>
      {/* Logo + Admin badge */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {mounted ? (
            <>
              <img
                src="/images/logodark.png"
                alt="EquiCore"
                style={{ height: 28, width: 'auto', objectFit: 'contain', display: isDark ? 'none' : 'block' }}
              />
              <img
                src="/images/logowhite.png"
                alt="EquiCore"
                style={{ height: 28, width: 'auto', objectFit: 'contain', display: isDark ? 'block' : 'none' }}
              />
            </>
          ) : (
            <div style={{ height: 28, width: 100, background: 'hsl(var(--muted))', borderRadius: 4 }} />
          )}
          <span style={{
            fontSize: '0.5625rem', fontWeight: 900, padding: '2px 7px', borderRadius: 4,
            background: 'hsl(168 83% 29%)', color: '#fff', letterSpacing: '0.08em',
          }}>
            ADMIN
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.75rem 0.625rem' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, padding: '0 0.625rem', marginBottom: '0.375rem' }}>
          Menu
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0.5625rem 0.75rem',
                  borderRadius: '0.625rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
                  transition: 'all 0.15s',
                  background: active ? C.greenLight : 'transparent',
                  color: active ? C.green : C.muted,
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted))'; (e.currentTarget as HTMLElement).style.color = C.fg; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.muted; } }}
              >
                <span style={{ flexShrink: 0 }}><Svg d={item.icon} /></span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontSize: '0.625rem', fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, background: 'hsl(0 84.2% 55%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </div>

        {/* Divider + system links */}
        <div style={{ height: 1, background: C.border, margin: '0.75rem 0.625rem' }} />
        <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, padding: '0 0.625rem', marginBottom: '0.375rem' }}>
          Sistema
        </p>
        {[
          { href: '/dashboard', label: 'Voltar ao App', icon: '<path d="m15 18-6-6 6-6"/>' },
        ].map((item) => (
          <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', borderRadius: '0.625rem', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500, color: C.muted, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.fg; (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted))'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <Svg d={item.icon} size={14} />
            {item.label}
          </a>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '0.875rem 1.25rem', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6875rem', fontWeight: 800, flexShrink: 0 }}>
          SS
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sabrina Santos</p>
          <p style={{ fontSize: '0.6875rem', color: C.muted }}>Administradora</p>
        </div>
      </div>
    </aside>
  );
}
