import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

const BLUE      = 'hsl(221 83% 53%)';
const BLUE_BG   = 'hsl(221 83% 53% / 0.08)';
const BLUE_GRAD = 'linear-gradient(135deg, hsl(221 83% 53%), hsl(221 83% 38%))';

// ─── Icons ───────────────────────────────────────────────────────────────────

function SunIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
}
function MoonIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
}
function MenuIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>;
}
function CloseIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <a href="/vet" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
      <img src="/images/logodark.png" alt="Equicore" className="block dark:hidden" style={{ height: 30, width: 'auto' }} />
      <img src="/images/logowhite.png" alt="Equicore" className="hidden dark:block" style={{ height: 30, width: 'auto' }} />
      <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: BLUE_BG, color: BLUE, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
        VET
      </span>
    </a>
  );
}

// ─── Nav link ─────────────────────────────────────────────────────────────────

function NavLink({ href, label, onClick, currentPath }: { href: string; label: string; onClick?: () => void; currentPath?: string }) {
  // usa o path vindo do servidor para evitar mismatch de hidratação
  const path = currentPath ?? '';
  const isActive = href === '/vet' ? path === '/vet' : path.startsWith(href);
  return (
    <a
      href={href}
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
      style={isActive
        ? { color: BLUE, background: BLUE_BG }
        : { color: 'hsl(240 3.8% 46.1%)', textDecoration: 'none' }
      }
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'hsl(var(--muted))'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
    >
      {label}
    </a>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-label="Alternar tema"
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-[hsl(240_3.8%_46.1%)] hover:bg-[hsl(240_4.8%_95.9%)] dark:hover:bg-[hsl(240_3.7%_15.9%)] cursor-pointer">
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  return (
    <a href="/vet/perfil" title="Perfil"
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-offset-1 transition-all"
      style={avatarUrl ? undefined : { background: BLUE_GRAD, '--tw-ring-color': BLUE } as React.CSSProperties}>
      {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </a>
  );
}

// ─── Logout ───────────────────────────────────────────────────────────────────

function LogoutButton() {
  async function handle() {
    const sb = createClient();
    await sb.auth.signOut();
    window.location.href = '/login';
  }
  return (
    <button onClick={handle} title="Sair"
      className="w-9 h-9 flex items-center justify-center rounded-lg text-[hsl(240_3.8%_46.1%)] hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
      </svg>
    </button>
  );
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: '/vet',           label: 'Dashboard' },
  { href: '/vet/registros', label: 'Registros' },
  { href: '/vet/perfil',    label: 'Perfil'    },
] as const;

const CADASTRO_LINKS = [
  { href: '/vet/cadastros/propriedade',  label: 'Propriedade'  },
  { href: '/vet/cadastros/proprietario', label: 'Proprietário' },
  { href: '/vet/cadastros/equino',       label: 'Animal'       },
] as const;

// ─── Dropdown de cadastros (desktop) ─────────────────────────────────────────

function CadastrosDropdown({ currentPath }: { currentPath?: string }) {
  const [open, setOpen] = useState(false);
  const isActive = (currentPath ?? '').startsWith('/vet/cadastros');

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-1"
        style={isActive || open
          ? { color: BLUE, background: BLUE_BG, border: 'none' }
          : { color: 'hsl(240 3.8% 46.1%)', background: 'transparent', border: 'none' }
        }
      >
        Cadastros
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 180, zIndex: 60,
          background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))',
          borderRadius: 12, padding: 6, boxShadow: '0 8px 24px hsl(0 0% 0% / 0.12)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {CADASTRO_LINKS.map(l => (
            <a key={l.href} href={l.href}
               className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]"
               style={{ color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Header principal ─────────────────────────────────────────────────────────

export default function VetHeader({ currentPath }: { currentPath?: string }) {
  const [isDark, setIsDark]           = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [userName, setUserName]       = useState('');
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sb.from('profiles').select('full_name, avatar_url').eq('id', data.user.id).single()
        .then(({ data: p }) => { if (p) { setUserName(p.full_name ?? ''); setAvatarUrl(p.avatar_url ?? null); } });
    });
  }, []);

  function toggleTheme() {
    const d = !isDark;
    setIsDark(d);
    document.documentElement.classList.toggle('dark', d);
    localStorage.setItem('equicore-theme', d ? 'dark' : 'light');
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.9)] backdrop-blur-md">
        <div className="flex h-14 items-center px-4 lg:px-6 gap-4">

          <Logo />

          {/* Desktop nav */}
          <nav className="hidden md:flex flex-1 justify-center gap-1 items-center">
            <NavLink href="/vet" label="Dashboard" currentPath={currentPath} />
            <CadastrosDropdown currentPath={currentPath} />
            <NavLink href="/vet/registros" label="Registros" currentPath={currentPath} />
            <NavLink href="/vet/perfil" label="Perfil" currentPath={currentPath} />
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <div className="w-px h-5 mx-1" style={{ background: 'hsl(var(--border))' }} />
            <Avatar name={userName} avatarUrl={avatarUrl} />
            <LogoutButton />
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-1 ml-auto">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <button onClick={() => setMobileOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[hsl(240_3.8%_46.1%)] hover:bg-[hsl(240_4.8%_95.9%)] cursor-pointer">
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg">
          <nav className="flex flex-col gap-1 p-4">
            {NAV_LINKS.map(l => <NavLink key={l.href} href={l.href} label={l.label} currentPath={currentPath} onClick={() => setMobileOpen(false)} />)}
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Cadastros
            </p>
            {CADASTRO_LINKS.map(l => <NavLink key={l.href} href={l.href} label={l.label} currentPath={currentPath} onClick={() => setMobileOpen(false)} />)}
            <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex items-center gap-3">
              <Avatar name={userName} avatarUrl={avatarUrl} />
              <span className="text-sm font-medium flex-1 text-foreground">{userName || '—'}</span>
              <LogoutButton />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
