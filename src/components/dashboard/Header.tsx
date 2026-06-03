import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

// ─── Icons ───────────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// ─── Logo Component ───────────────────────────────────────────────────────────

function Logo() {
  // Troca via CSS (classe `dark` no <html>), evitando flash/dependência de JS
  return (
    <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none' }} aria-label="Equicore Home">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* logodark.png: logo escura, aparece no Light */}
        <img
          src="/images/logodark.png"
          alt="Equicore"
          className="block dark:hidden"
          style={{ height: 32, width: 'auto', objectFit: 'contain' }}
        />
        {/* logowhite.png: logo branca, aparece no Dark */}
        <img
          src="/images/logowhite.png"
          alt="Equicore"
          className="hidden dark:block"
          style={{ height: 32, width: 'auto', objectFit: 'contain' }}
        />
      </div>
    </a>
  );
}

// ─── Nav Link (with optional disabled state) ─────────────────────────────────

function NavLink({
  href,
  label,
  onClick,
  disabled = false,
}: {
  href: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const isActive = typeof window !== 'undefined' && window.location.pathname === href;

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title="Navegação indisponível nesta tela"
        style={{
          display: 'inline-block',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          opacity: 0.38,
          cursor: 'not-allowed',
          pointerEvents: 'none',
          color: 'hsl(240 3.8% 46.1%)',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
        isActive
          ? 'text-[hsl(168_83%_29%)] bg-[hsl(168_83%_29%/0.08)] dark:text-[hsl(168_72%_40%)] dark:bg-[hsl(168_72%_40%/0.12)]'
          : 'text-[hsl(240_3.8%_46.1%)] hover:text-[hsl(240_10%_3.9%)] hover:bg-[hsl(240_4.8%_95.9%)] dark:text-[hsl(240_5%_64.9%)] dark:hover:text-[hsl(0_0%_98%)] dark:hover:bg-[hsl(240_3.7%_15.9%)]',
      ].join(' ')}
    >
      {label}
    </a>
  );
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-[hsl(240_3.8%_46.1%)] hover:text-[hsl(240_10%_3.9%)] hover:bg-[hsl(240_4.8%_95.9%)] dark:text-[hsl(240_5%_64.9%)] dark:hover:text-[hsl(0_0%_98%)] dark:hover:bg-[hsl(240_3.7%_15.9%)] cursor-pointer"
    >
      <span className="transition-all duration-300" style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}

// ─── Logout Button ────────────────────────────────────────────────────────────

function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <button
      onClick={handleLogout}
      aria-label="Sair"
      title="Sair"
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-[hsl(240_3.8%_46.1%)] hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
      </svg>
    </button>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar() {
  return (
    <a
      href="/dashboard/perfil"
      aria-label="Perfil do usuário"
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-offset-2 hover:ring-[hsl(168_83%_29%)] dark:hover:ring-offset-[hsl(240_10%_3.9%)]"
      style={{ background: 'linear-gradient(135deg, hsl(168 83% 29%), hsl(168 83% 20%))' }}
    >
      SS
    </a>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────

function NotificationBell() {
  return (
    <button
      aria-label="Notificações"
      className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-[hsl(240_3.8%_46.1%)] hover:text-[hsl(240_10%_3.9%)] hover:bg-[hsl(240_4.8%_95.9%)] dark:text-[hsl(240_5%_64.9%)] dark:hover:text-[hsl(0_0%_98%)] dark:hover:bg-[hsl(240_3.7%_15.9%)] cursor-pointer"
    >
      <BellIcon />
      {/* Notification dot */}
      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
    </button>
  );
}

// ─── Nav links data (used by both desktop & mobile) ──────────────────────────

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', alwaysEnabled: true },
  { href: '/dashboard/plantel', label: 'Plantel', alwaysEnabled: false },
  { href: '/dashboard/alertas', label: 'Alertas', alwaysEnabled: false },
  { href: '/dashboard/perfil', label: 'Perfil', alwaysEnabled: false },
] as const;

// ─── Main Header Component ────────────────────────────────────────────────────

export default function Header({ currentPath }: { currentPath?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Lê o tema atual do documento (definido pelo script inline no Layout.astro)
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('equicore-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('equicore-theme', 'light');
    }
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.85)] backdrop-blur-md"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <div className="flex h-14 items-center px-4 lg:px-6">

          {/* ── Logo ── */}
          <Logo />

          {/* ── Desktop Nav (center) ── */}
          <nav className="hidden md:flex flex-1 justify-center gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
              />
            ))}
          </nav>

          {/* ── Desktop Right Actions ── */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            <NotificationBell />
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <div className="w-px h-5 bg-[hsl(var(--border))] mx-2" />
            <Avatar />
            <LogoutButton />
          </div>

          {/* ── Mobile Right Actions ── */}
          <div className="flex md:hidden items-center gap-1 ml-auto">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-[hsl(240_3.8%_46.1%)] hover:text-[hsl(240_10%_3.9%)] hover:bg-[hsl(240_4.8%_95.9%)] dark:text-[hsl(240_5%_64.9%)] dark:hover:text-[hsl(0_0%_98%)] dark:hover:bg-[hsl(240_3.7%_15.9%)] cursor-pointer"
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

          {/* ── Mobile Dropdown Menu ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed top-14 left-0 right-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          <nav className="flex flex-col gap-1 p-4">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
            <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex items-center gap-3">
              <Avatar />
              <div style={{ flex: 1 }}>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                  Sabrina Santos
                </p>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Administradora
                </p>
              </div>
              <LogoutButton />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
