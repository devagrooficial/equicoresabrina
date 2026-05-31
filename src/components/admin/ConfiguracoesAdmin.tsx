import { useState } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.12)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  card: 'hsl(var(--card))',
  bg: 'hsl(var(--background))',
};

function Svg({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.fg, display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.5625rem 0.75rem', fontSize: '0.875rem', background: C.bg, color: C.fg, outline: 'none', boxSizing: 'border-box' }}
    />
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: '0.875rem', color: C.fg, fontWeight: 500 }}>{label}</span>
      <button
        onClick={onToggle}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: on ? C.green : 'hsl(var(--muted))', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background 0.2s' }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

const TABS = [
  { key: 'geral', label: 'Geral', icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  { key: 'email', label: 'E-mail', icon: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>' },
  { key: 'storage', label: 'Armazenamento', icon: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>' },
  { key: 'manutencao', label: 'Manutenção', icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
  { key: 'integracao', label: 'Integrações', icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
];

export default function ConfiguracoesAdmin() {
  const [tab, setTab] = useState('geral');
  const [saved, setSaved] = useState<string | null>(null);

  // Geral
  const [appName, setAppName] = useState('EquiCore');
  const [appUrl, setAppUrl] = useState('https://equicore.app');
  const [supportEmail, setSupportEmail] = useState('suporte@equicore.app');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [locale, setLocale] = useState('pt-BR');
  const [trialDays, setTrialDays] = useState('14');
  const [maxEquinesFree, setMaxEquinesFree] = useState('3');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);

  // Email
  const [smtpHost, setSmtpHost] = useState('smtp.sendgrid.net');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('apikey');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFrom, setEmailFrom] = useState('noreply@equicore.app');
  const [emailFromName, setEmailFromName] = useState('EquiCore');
  const [emailFooter, setEmailFooter] = useState('EquiCore · Gestão Inteligente de Equinos');
  const [sendWelcome, setSendWelcome] = useState(true);
  const [sendAlerts, setSendAlerts] = useState(true);
  const [sendBilling, setSendBilling] = useState(true);

  // Storage
  const [storageProvider, setStorageProvider] = useState('S3');
  const [s3Bucket, setS3Bucket] = useState('equicore-prod');
  const [s3Region, setS3Region] = useState('sa-east-1');
  const [s3AccessKey, setS3AccessKey] = useState('AKIA...');
  const [maxFileSizeMb, setMaxFileSizeMb] = useState('10');
  const [maxStorageFreeGb, setMaxStorageFreeGb] = useState('1');
  const [maxStorageStarterGb, setMaxStorageStarterGb] = useState('5');
  const [maxStorageProGb, setMaxStorageProGb] = useState('20');
  const [maxStorageHarasGb, setMaxStorageHarasGb] = useState('100');

  // Maintenance
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('Sistema em manutenção. Retornaremos em breve.');
  const [allowAdminDuringMaintenance, setAllowAdminDuringMaintenance] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [logLevel, setLogLevel] = useState('INFO');

  // Integrations
  const [stripePublic, setStripePublic] = useState('pk_live_...');
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('whsec_...');
  const [googleAnalytics, setGoogleAnalytics] = useState('G-XXXXXXX');
  const [sentryDsn, setSentryDsn] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [affiliateCommission, setAffiliateCommission] = useState('15');

  function save() {
    setSaved(tab);
    setTimeout(() => setSaved(null), 2500);
  }

  const inputStyle = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.5625rem 0.75rem', fontSize: '0.875rem', background: C.bg, color: C.fg, outline: 'none', boxSizing: 'border-box' as const };
  const selectStyle = { ...inputStyle };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg }}>Configurações do Sistema</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Parâmetros globais da plataforma EquiCore</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Sidebar tabs */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: tab === t.key ? C.greenLight : 'transparent', color: tab === t.key ? C.green : C.muted, border: 'none', borderRight: tab === t.key ? `2px solid ${C.green}` : '2px solid transparent', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.15s' }}
            >
              <Svg d={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {tab === 'geral' && (
            <div>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Configurações Gerais</h2>
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Informações básicas e comportamento da plataforma</p>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Nome da Aplicação">
                    <input value={appName} onChange={e => setAppName(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="URL da Aplicação">
                    <input value={appUrl} onChange={e => setAppUrl(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="E-mail de Suporte">
                    <input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Fuso Horário">
                    <select value={timezone} onChange={e => setTimezone(e.target.value)} style={selectStyle}>
                      <option value="America/Sao_Paulo">America/Sao_Paulo (GMT-3)</option>
                      <option value="America/Manaus">America/Manaus (GMT-4)</option>
                      <option value="America/Belem">America/Belem (GMT-3)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                    </select>
                  </Field>
                  <Field label="Localidade">
                    <select value={locale} onChange={e => setLocale(e.target.value)} style={selectStyle}>
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </select>
                  </Field>
                </div>

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Planos e Limites</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Dias de Teste Gratuito" hint="Dias de trial para novos usuários no plano pago">
                    <input type="number" value={trialDays} onChange={e => setTrialDays(e.target.value)} min="0" max="90" style={inputStyle} />
                  </Field>
                  <Field label="Equinos Máx. (Plano Gratuito)" hint="Limite de equinos no plano gratuito">
                    <input type="number" value={maxEquinesFree} onChange={e => setMaxEquinesFree(e.target.value)} min="1" max="10" style={inputStyle} />
                  </Field>
                </div>

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Comportamento</p>

                <Toggle on={registrationOpen} onToggle={() => setRegistrationOpen(v => !v)} label="Registros abertos (novos cadastros permitidos)" />
                <Toggle on={requireEmailVerification} onToggle={() => setRequireEmailVerification(v => !v)} label="Exigir verificação de e-mail no cadastro" />
              </div>
            </div>
          )}

          {tab === 'email' && (
            <div>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Configuração de E-mail</h2>
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>SMTP e templates de e-mail transacional</p>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Servidor SMTP</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
                  <Field label="Host SMTP">
                    <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.sendgrid.net" style={inputStyle} />
                  </Field>
                  <Field label="Porta">
                    <input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" style={{ ...inputStyle, width: 80 }} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Usuário SMTP">
                    <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Senha SMTP">
                    <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="••••••••••••" style={inputStyle} />
                  </Field>
                </div>

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Identidade do Remetente</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="E-mail do Remetente">
                    <input value={emailFrom} onChange={e => setEmailFrom(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Nome do Remetente">
                    <input value={emailFromName} onChange={e => setEmailFromName(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
                <Field label="Rodapé do E-mail">
                  <input value={emailFooter} onChange={e => setEmailFooter(e.target.value)} style={inputStyle} />
                </Field>

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>E-mails Automáticos</p>
                <Toggle on={sendWelcome} onToggle={() => setSendWelcome(v => !v)} label="Enviar e-mail de boas-vindas no cadastro" />
                <Toggle on={sendAlerts} onToggle={() => setSendAlerts(v => !v)} label="Enviar notificações de alertas por e-mail" />
                <Toggle on={sendBilling} onToggle={() => setSendBilling(v => !v)} label="Enviar avisos de cobrança e faturas" />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ background: 'hsl(var(--muted))', color: C.fg, border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                    Testar Configuração SMTP
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Armazenamento de Arquivos</h2>
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Configuração de storage e limites por plano</p>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <Field label="Provedor de Storage">
                  <select value={storageProvider} onChange={e => setStorageProvider(e.target.value)} style={selectStyle}>
                    <option value="S3">Amazon S3</option>
                    <option value="GCS">Google Cloud Storage</option>
                    <option value="R2">Cloudflare R2</option>
                    <option value="LOCAL">Local (desenvolvimento)</option>
                  </select>
                </Field>

                {storageProvider === 'S3' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <Field label="Bucket S3">
                      <input value={s3Bucket} onChange={e => setS3Bucket(e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Região">
                      <input value={s3Region} onChange={e => setS3Region(e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Access Key ID">
                      <input value={s3AccessKey} onChange={e => setS3AccessKey(e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Secret Access Key">
                      <input type="password" placeholder="••••••••••••" style={inputStyle} />
                    </Field>
                  </div>
                )}

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Limites de Armazenamento</p>

                <Field label="Tamanho Máx. por Arquivo (MB)">
                  <input type="number" value={maxFileSizeMb} onChange={e => setMaxFileSizeMb(e.target.value)} min="1" max="100" style={{ ...inputStyle, maxWidth: 120 }} />
                </Field>

                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plano</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Limite (GB)</span>
                  </div>
                  {[
                    { label: 'Gratuito', value: maxStorageFreeGb, set: setMaxStorageFreeGb },
                    { label: 'Starter', value: maxStorageStarterGb, set: setMaxStorageStarterGb },
                    { label: 'Pro', value: maxStorageProGb, set: setMaxStorageProGb },
                    { label: 'Haras', value: maxStorageHarasGb, set: setMaxStorageHarasGb },
                  ].map(plan => (
                    <div key={plan.label} style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: C.fg, fontWeight: 600 }}>{plan.label}</span>
                      <input type="number" value={plan.value} onChange={e => plan.set(e.target.value)} min="0.5" max="1000" step="0.5" style={{ ...inputStyle, maxWidth: 100 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'manutencao' && (
            <div>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Modo Manutenção & Debug</h2>
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Controles de disponibilidade e diagnóstico</p>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {maintenanceMode && (
                  <div style={{ background: 'hsl(0 84% 60% / 0.08)', border: '1px solid hsl(0 84% 60% / 0.25)', borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Svg d='<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>' size={18} />
                    <p style={{ fontSize: '0.8125rem', color: 'hsl(0 84% 45%)', fontWeight: 600 }}>Modo de manutenção ativo — a plataforma está inacessível para usuários comuns.</p>
                  </div>
                )}
                <Toggle on={maintenanceMode} onToggle={() => setMaintenanceMode(v => !v)} label="Ativar modo de manutenção" />
                <Toggle on={allowAdminDuringMaintenance} onToggle={() => setAllowAdminDuringMaintenance(v => !v)} label="Permitir acesso de admins durante manutenção" />

                <Field label="Mensagem de Manutenção">
                  <textarea
                    value={maintenanceMessage}
                    onChange={e => setMaintenanceMessage(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' as const }}
                  />
                </Field>

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Diagnóstico</p>

                <Toggle on={debugMode} onToggle={() => setDebugMode(v => !v)} label="Modo debug (logs verbosos)" />

                <Field label="Nível de Log">
                  <select value={logLevel} onChange={e => setLogLevel(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
                    {['DEBUG', 'INFO', 'WARN', 'ERROR'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </Field>

                <div style={{ height: 1, background: C.border }} />
                <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ações de Sistema</p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Limpar Cache', icon: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>' },
                    { label: 'Reprocessar Alertas', icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>' },
                    { label: 'Exportar Logs', icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>' },
                  ].map(action => (
                    <button key={action.label} style={{ background: 'hsl(var(--muted))', color: C.fg, border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Svg d={action.icon} size={14} />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'integracao' && (
            <div>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Integrações</h2>
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>APIs externas e serviços conectados</p>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {[
                  {
                    title: 'Stripe (Pagamentos)',
                    fields: [
                      { label: 'Chave Pública (pk_live_...)', value: stripePublic, set: setStripePublic, type: 'text' },
                      { label: 'Chave Secreta (sk_live_...)', value: stripeSecret, set: setStripeSecret, type: 'password', placeholder: '••••••••••••' },
                      { label: 'Webhook Secret (whsec_...)', value: stripeWebhook, set: setStripeWebhook, type: 'text' },
                    ],
                    status: 'connected',
                  },
                  {
                    title: 'Google Analytics',
                    fields: [
                      { label: 'Measurement ID (G-...)', value: googleAnalytics, set: setGoogleAnalytics, type: 'text' },
                    ],
                    status: googleAnalytics ? 'connected' : 'disconnected',
                  },
                  {
                    title: 'Sentry (Monitoramento de Erros)',
                    fields: [
                      { label: 'DSN', value: sentryDsn, set: setSentryDsn, type: 'text', placeholder: 'https://...' },
                    ],
                    status: sentryDsn ? 'connected' : 'disconnected',
                  },
                  {
                    title: 'WhatsApp (Notificações)',
                    fields: [
                      { label: 'Token de Acesso', value: whatsappToken, set: setWhatsappToken, type: 'password', placeholder: '••••••••••••' },
                    ],
                    status: whatsappToken ? 'connected' : 'disconnected',
                  },
                ].map(service => (
                  <div key={service.title} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.fg }}>{service.title}</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: service.status === 'connected' ? C.greenLight : 'hsl(var(--muted))', color: service.status === 'connected' ? C.green : C.muted }}>
                        {service.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {service.fields.map(f => (
                        <Field key={f.label} label={f.label}>
                          <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={inputStyle} />
                        </Field>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.fg }}>Programa de Afiliados</span>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <Field label="Comissão Padrão (%)">
                      <input type="number" value={affiliateCommission} onChange={e => setAffiliateCommission(e.target.value)} min="0" max="50" style={{ ...inputStyle, maxWidth: 120 }} />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {saved === tab && (
              <span style={{ fontSize: '0.8125rem', color: C.green, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Svg d='<polyline points="20 6 9 17 4 12"/>' size={14} />
                Configurações salvas
              </span>
            )}
            <button onClick={save} style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 8, padding: '0.5625rem 1.25rem', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
              Salvar Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
