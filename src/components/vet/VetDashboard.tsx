import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { maskCpfCnpj } from '../../lib/br';

const BLUE       = 'hsl(221 83% 53%)';
const BLUE_LIGHT = 'hsl(221 83% 53% / 0.08)';
const BLUE_GRAD  = 'linear-gradient(135deg, hsl(221 83% 53%), hsl(221 83% 38%))';

interface VetDashboardProps {
  vetName:   string;
  crmv:      string | null;
  specialty: string | null;
}

interface RecentEquine {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  created_at: string;
  owner: { name: string; cpf_cnpj: string } | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, href, icon }: {
  label: string; value: number | string; href: string; icon: React.ReactNode;
}) {
  return (
    <a href={href} className="rounded-2xl border bg-card p-4 flex items-center gap-4 transition-all duration-200 hover:shadow-md"
       style={{ borderColor: 'hsl(var(--border))', textDecoration: 'none' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BLUE_LIGHT }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight" style={{ color: 'hsl(var(--foreground))' }}>{value}</p>
        <p className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</p>
      </div>
    </a>
  );
}

// ─── Ação rápida ──────────────────────────────────────────────────────────────

function QuickAction({ href, title, desc, icon }: {
  href: string; title: string; desc: string; icon: React.ReactNode;
}) {
  return (
    <a href={href}
       className="rounded-2xl border bg-card p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
       style={{ borderColor: 'hsl(var(--border))', textDecoration: 'none' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: BLUE_LIGHT, color: BLUE }}>
        {icon}
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color: 'hsl(var(--foreground))' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{desc}</p>
      </div>
      <span className="text-xs font-semibold" style={{ color: BLUE }}>Cadastrar →</span>
    </a>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export default function VetDashboard({ vetName, crmv, specialty }: VetDashboardProps) {
  const [counts, setCounts]   = useState({ equinos: 0, proprietarios: 0, propriedades: 0 });
  const [recents, setRecents] = useState<RecentEquine[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createClient();

      const [eq, ow, pr, recent] = await Promise.all([
        sb.from('vet_equines').select('id', { count: 'exact', head: true }),
        sb.from('vet_owners').select('id', { count: 'exact', head: true }),
        sb.from('vet_properties').select('id', { count: 'exact', head: true }),
        sb.from('vet_equines')
          .select('id, name, species, breed, created_at, owner:vet_owners(name, cpf_cnpj)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Tabelas ainda não criadas no Supabase → orienta rodar a migration
      // (42P01 = relação inexistente; PGRST205 = fora do schema cache do PostgREST)
      const missingTable = (e: { code?: string } | null) =>
        e?.code === '42P01' || e?.code === 'PGRST205';
      if ([eq.error, ow.error, pr.error, recent.error].some(missingTable)) {
        setSetupNeeded(true);
      }

      setCounts({
        equinos:       eq.count ?? 0,
        proprietarios: ow.count ?? 0,
        propriedades:  pr.count ?? 0,
      });
      setRecents((recent.data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">

      {/* ── Boas-vindas ── */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {getGreeting()}, Dr. {vetName.split(' ')[0]}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {crmv && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: BLUE_LIGHT, color: BLUE }}>
                CRMV {crmv}
              </span>
            )}
            {specialty && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                {specialty}
              </span>
            )}
            {!crmv && !specialty && (
              <a href="/vet/perfil" className="text-xs font-medium" style={{ color: BLUE }}>
                Complete seu perfil profissional →
              </a>
            )}
          </div>
        </div>
        <span className="hidden sm:block text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </span>
      </section>

      {setupNeeded && (
        <section className="rounded-2xl border p-4"
                 style={{ borderColor: 'hsl(38 92% 50% / 0.35)', background: 'hsl(38 92% 50% / 0.06)' }}>
          <p className="text-sm font-semibold" style={{ color: 'hsl(38 92% 30%)' }}>
            Banco de dados não configurado
          </p>
          <p className="text-xs mt-1" style={{ color: 'hsl(38 92% 28%)' }}>
            Execute a migration <code>supabase/vet_module.sql</code> no SQL Editor do Supabase para habilitar os cadastros da área veterinária.
          </p>
        </section>
      )}

      {/* ── KPIs ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Equinos cadastrados"
          value={loading ? '…' : counts.equinos}
          href="/vet/registros?tab=equinos"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/></svg>}
        />
        <KpiCard
          label="Proprietários"
          value={loading ? '…' : counts.proprietarios}
          href="/vet/registros?tab=proprietarios"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <KpiCard
          label="Propriedades"
          value={loading ? '…' : counts.propriedades}
          href="/vet/registros?tab=propriedades"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
        />
      </section>

      {/* ── Ações rápidas ── */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-foreground mb-4">Cadastros</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickAction
            href="/vet/cadastros/propriedade"
            title="Cadastro da Propriedade"
            desc="Haras, fazendas e estabelecimentos com Nº OESA"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          />
          <QuickAction
            href="/vet/cadastros/proprietario"
            title="Cadastro de Proprietário"
            desc="Localizado pelo cadastro geral via CPF/CNPJ"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>}
          />
          <QuickAction
            href="/vet/cadastros/equino"
            title="Cadastro do Animal"
            desc="Associado ao proprietário via CPF, com resenha gráfica"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/></svg>}
          />
        </div>
      </section>

      {/* ── Últimos equinos cadastrados ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold tracking-tight text-foreground">Últimos cadastros</h2>
          <a href="/vet/registros" className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
             style={{ background: BLUE_LIGHT, color: BLUE, textDecoration: 'none' }}>
            Ver todos os registros →
          </a>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : recents.length === 0 ? (
          <div className="rounded-2xl border p-10 flex flex-col items-center text-center gap-4"
               style={{ borderStyle: 'dashed', borderColor: 'hsl(var(--border))' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: BLUE_LIGHT }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-base text-foreground mb-1">Nenhum equino cadastrado ainda</p>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', maxWidth: 400 }}>
                Comece cadastrando a propriedade e o proprietário; depois associe o animal ao proprietário pelo CPF.
              </p>
            </div>
            <a href="/vet/cadastros/equino"
               className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-all"
               style={{ background: BLUE, textDecoration: 'none' }}>
              Cadastrar animal
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: 'hsl(var(--border))' }}>
            {recents.map((r, i) => {
              const initials = r.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <a key={r.id} href={`/vet/cadastros/equino?id=${r.id}`}
                   className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                   style={{ textDecoration: 'none', borderBottom: i < recents.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                       style={{ background: BLUE_GRAD }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>{r.name}</p>
                    <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {[r.species, r.breed].filter(Boolean).join(' · ') || 'Sem espécie/raça'}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>{r.owner?.name ?? '—'}</p>
                    <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {r.owner ? maskCpfCnpj(r.owner.cpf_cnpj) : ''}
                    </p>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: BLUE }}>Editar →</span>
                </a>
              );
            })}
          </div>
        )}
      </section>

    </main>
  );
}
