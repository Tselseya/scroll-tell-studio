import { useEffect, useState } from 'react'
import {
  Archive,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cloud,
  Command,
  FileText,
  FolderOpen,
  Image,
  LayoutDashboard,
  Link2,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Settings2,
  Sparkles,
  TerminalSquare,
  Video,
  X,
  Zap,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8787'

const platformData = [
  { key: 'x', label: 'X / Twitter', short: 'X', tone: 'bg-black text-white', connected: true },
  { key: 'threads', label: 'Threads', short: '@', tone: 'bg-zinc-900 text-white', connected: true },
  { key: 'instagram', label: 'Instagram', short: '◎', tone: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white', connected: true },
  { key: 'facebook', label: 'Facebook', short: 'f', tone: 'bg-blue-600 text-white', connected: false },
  { key: 'tiktok', label: 'TikTok', short: '♪', tone: 'bg-slate-950 text-cyan-300', connected: false },
  { key: 'youtube', label: 'YouTube', short: '▶', tone: 'bg-red-500 text-white', connected: false },
]

const recentContent = [
  { title: 'The quiet advantage of building in public', type: 'Text post', status: 'Draft', date: 'Edited 12 min ago', icon: FileText, color: 'bg-blue-soft text-blue' },
  { title: 'A calmer content operating system', type: 'Carousel', status: 'Ready', date: 'Edited yesterday', icon: Image, color: 'bg-lilac text-violet' },
  { title: 'Behind the scenes: local-first tools', type: 'Short video', status: 'Scheduled', date: 'Tomorrow at 9:00 AM', icon: Video, color: 'bg-peach text-coral' },
]

function BrandMark() {
  return <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white shadow-sm"><div className="grid grid-cols-2 gap-0.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-white" /><span className="h-2.5 w-2.5 rounded-[3px] bg-blue-300" /><span className="h-2.5 w-2.5 rounded-[3px] bg-blue-300" /><span className="h-2.5 w-2.5 rounded-[3px] bg-violet-300" /></div></div>
}

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-cloud text-sm font-semibold text-muted">Loading your workspace…</div>
}

function LoginScreen({ serverOnline }: { serverOnline: boolean }) {
  return <div className="flex min-h-screen items-center justify-center bg-cloud px-5 py-10 text-ink"><div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-[0_18px_60px_rgba(40,52,80,0.08)]"><div className="flex items-center gap-3"><BrandMark /><div><div className="font-display text-lg font-bold tracking-tight">ScrollTell</div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Studio</div></div></div><h1 className="mt-10 font-display text-3xl font-bold tracking-tight">Your content, in motion.</h1><p className="mt-3 text-sm leading-6 text-muted">Sign in to open your private workspace, organize drafts, connect providers, and prepare publishing jobs.</p><div className="mt-8 space-y-3"><a href={`${API_BASE}/auth/github`} className="flex items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700">Continue with GitHub</a><a href={`${API_BASE}/auth/google`} className="flex items-center justify-center rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink transition hover:bg-cloud">Continue with Google</a></div><div className={`mt-6 rounded-xl p-3 text-xs leading-5 ${serverOnline ? 'bg-mint text-green' : 'bg-peach text-coral'}`}><strong>{serverOnline ? 'Server connected.' : 'Server not connected.'}</strong> {serverOnline ? 'Choose a provider to continue.' : 'Run pnpm dev:all, then refresh this page.'}</div><p className="mt-6 text-center text-[11px] leading-5 text-muted">By continuing, you acknowledge the Privacy Policy and Terms of Service.</p></div></div>
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const [serverOnline, setServerOnline] = useState(false)
  const [activeModal, setActiveModal] = useState<'account' | 'publish' | 'consent' | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authUser, setAuthUser] = useState<{ displayName: string; email: string } | null>(null)
  const [workspaceId, setWorkspaceId] = useState('personal')

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((response) => setServerOnline(response.ok))
      .catch(() => setServerOnline(false))
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => response.ok ? setAuthUser((await response.json()).user) : setAuthUser(null))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (!authUser) return
    fetch(`${API_BASE}/api/bootstrap`, { credentials: 'include' }).then(async (response) => {
      if (!response.ok) return
      const data = await response.json()
      if (data.content?.[0]?.workspaceId) setWorkspaceId(data.content[0].workspaceId)
    }).catch(() => undefined)
  }, [authUser])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveModal(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const createDraft = async () => {
    const text = draft.trim()
    const title = text.split('\n')[0]?.slice(0, 160) || 'Untitled draft'
    try {
      const response = await fetch(`${API_BASE}/api/content`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workspaceId, title, description: text, sourcePrompt: text, contentType: 'text', status: 'draft' }),
      })
      if (!response.ok) throw new Error('Could not save draft')
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } catch {
      setSaved(false)
    }
  }

  if (authLoading) return <LoadingScreen />
  if (!authUser) return <LoginScreen serverOnline={serverOnline} />

  return (
    <div className="flex min-h-screen bg-cloud text-ink">
      <aside className="hidden w-[250px] shrink-0 flex-col border-r border-line bg-white px-4 py-5 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <BrandMark />
          <div><div className="font-display text-[15px] font-bold tracking-tight">ScrollTell</div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Studio</div></div>
        </div>
        <button onClick={() => setShowComposer(true)} className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(23,32,51,0.14)] transition hover:-translate-y-0.5"><Plus size={16} /> New content <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">⌘ N</span></button>
        <nav className="mt-8 space-y-1">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Workspace</div>
          {([[LayoutDashboard, 'Overview'], [FileText, 'Content library'], [CalendarDays, 'Calendar'], [Image, 'Media vault']] as const).map(([Icon, label]) => <button key={label} onClick={() => setActiveNav(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${activeNav === label ? 'bg-blue-soft text-blue' : 'text-muted hover:bg-cloud hover:text-ink'}`}><Icon size={17} strokeWidth={activeNav === label ? 2.4 : 1.8} />{label}</button>)}
          <div className="mt-7 px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Connections</div>
          {([[MessageSquareText, 'AI providers'], [Link2, 'Publishing accounts'], [TerminalSquare, 'MCP tools']] as const).map(([Icon, label]) => <button key={label} onClick={() => setActiveNav(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${activeNav === label ? 'bg-blue-soft text-blue' : 'text-muted hover:bg-cloud hover:text-ink'}`}><Icon size={17} />{label}</button>)}
        </nav>
        <div className="mt-auto space-y-1">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted hover:bg-cloud hover:text-ink"><Settings2 size={17} /> Settings</button>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-cloud p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-300 to-violet-300 text-xs font-bold text-white">TS</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">Personal workspace</div><div className="truncate text-[11px] text-muted">Local only · 8 GB mode</div></div><MoreHorizontal size={15} className="text-muted" /></div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex h-[72px] items-center justify-between border-b border-line bg-white/80 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-muted hover:bg-cloud lg:hidden"><Menu size={19} /></button><div className="text-sm font-bold">{activeNav}</div><ChevronDown size={15} className="text-muted" /></div>
          <div className="flex items-center gap-2"><button className="hidden items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted hover:bg-cloud sm:flex"><Search size={14} /> Search <span className="ml-3 rounded border border-line px-1.5 py-0.5 text-[10px]">⌘ K</span></button><button className="rounded-lg p-2 text-muted hover:bg-cloud"><Bell size={17} /></button><div className="ml-1 h-7 w-px bg-line" /><button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-cloud"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-300 to-violet-300 text-[10px] font-bold text-white">TS</div><ChevronDown size={13} className="text-muted" /></button></div>
        </header>

        <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-9 lg:px-12">
          <section className="animate-float-in flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue"><Sparkles size={14} /> Good afternoon</div><h1 className="font-display text-3xl font-bold tracking-[-0.04em] md:text-[38px]">Your content, in motion.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">A quiet space to turn ideas into thoughtful posts, then send them wherever your audience is.</p></div><button onClick={() => setShowComposer(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue px-4 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(52,120,246,0.18)] transition hover:-translate-y-0.5"><Plus size={17} /> Create content</button></section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <MetricCard label="In progress" value="12" detail="4 ready to publish" icon={Zap} accent="blue" />
            <MetricCard label="Published this week" value="08" detail="Across 2 connected channels" icon={ArrowUpRight} accent="violet" />
            <MetricCard label="Next up" value="Tomorrow" detail="Behind the scenes · 9:00 AM" icon={Clock3} accent="peach" onClick={() => setActiveModal('publish')} />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_30px_rgba(40,52,80,0.035)] md:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-base font-bold">Recent content</h2><p className="mt-1 text-xs text-muted">Your latest ideas and publishing work.</p></div><button onClick={() => setActiveNav('Content library')} className="flex items-center gap-1 text-xs font-bold text-blue hover:underline">View library <ArrowUpRight size={13} /></button></div><div className="mt-5 divide-y divide-line">{recentContent.map((item) => <div key={item.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}><item.icon size={17} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.title}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><span>{item.type}</span><span className="h-1 w-1 rounded-full bg-line" /><span>{item.date}</span></div></div><StatusPill status={item.status} /></div>)}</div></div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_30px_rgba(40,52,80,0.035)] md:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-base font-bold">Publishing setup</h2><p className="mt-1 text-xs text-muted">Connect once, publish anywhere.</p></div><button onClick={() => setActiveNav('Publishing accounts')} className="rounded-lg p-1.5 text-muted hover:bg-cloud"><MoreHorizontal size={17} /></button></div><div className="mt-5 space-y-3">{platformData.map((platform) => <div key={platform.key} className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${platform.tone}`}>{platform.short}</div><div className="flex-1 text-sm font-semibold">{platform.label}</div>{platform.connected ? <span className="flex items-center gap-1.5 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Connected</span> : <button onClick={() => setActiveModal('account')} className="text-[11px] font-bold text-blue hover:underline">Connect</button>}</div>)}</div><div className="mt-5 rounded-xl bg-cloud p-3"><div className="flex items-start gap-2.5"><Cloud size={16} className="mt-0.5 text-blue" /><div><div className="text-xs font-bold">Local-first by default</div><div className="mt-1 text-[11px] leading-5 text-muted">Your workspace stays on this computer. Credentials are stored separately from content. <button type="button" onClick={() => setActiveModal('consent')} className="font-bold text-blue hover:underline">Privacy choices</button></div></div></div></div></div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]"><div className="soft-grid rounded-2xl border border-line bg-white p-5 md:p-6"><div className="flex items-start justify-between"><div><h2 className="font-display text-base font-bold">Your week</h2><p className="mt-1 text-xs text-muted">A light rhythm beats a crowded queue.</p></div><CalendarDays size={18} className="text-blue" /></div><div className="mt-6 flex h-32 items-end justify-between gap-2">{['M','T','W','T','F','S','S'].map((day, index) => <div key={`${day}-${index}`} className="flex flex-1 flex-col items-center gap-2"><div className="flex h-24 w-full items-end justify-center rounded-lg bg-cloud/80 p-1"><div className={`w-full max-w-6 rounded-md ${index === 3 ? 'bg-blue' : index === 5 ? 'bg-violet/60' : 'bg-blue/20'}`} style={{ height: `${[38, 55, 28, 78, 48, 63, 21][index]}%` }} /></div><span className={`text-[10px] font-bold ${index === 3 ? 'text-blue' : 'text-muted'}`}>{day}</span></div>)}</div></div><div className="rounded-2xl border border-line bg-ink p-5 text-white shadow-[0_8px_30px_rgba(40,52,80,0.08)] md:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-blue-300"><TerminalSquare size={13} /> Agent-ready workspace</div><h2 className="mt-3 font-display text-xl font-bold tracking-tight">Bring your tools with you.</h2><p className="mt-2 max-w-md text-xs leading-5 text-slate-300">Connect Claude, Manus, or any MCP client to search your library, shape drafts, and prepare platform-ready content.</p></div><div className="hidden rounded-xl bg-white/10 p-3 sm:block"><Command size={21} className="text-blue-200" /></div></div><button onClick={() => setActiveNav('MCP tools')} className="mt-6 flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-xs font-bold text-ink transition hover:bg-blue-50">Explore MCP tools <ArrowUpRight size={14} /></button></div></section>
        </div>
      </main>

      {showComposer && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-3 backdrop-blur-sm md:items-center"><div className="w-full max-w-2xl animate-float-in rounded-2xl border border-line bg-white p-5 shadow-2xl md:p-6"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue"><Sparkles size={14} /> New content</div><h2 className="mt-2 font-display text-xl font-bold">Start with an idea</h2></div><button onClick={() => setShowComposer(false)} className="rounded-lg p-2 text-muted hover:bg-cloud"><X size={18} /></button></div><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What do you want to say? Start with a rough thought, a link, or a prompt for your AI provider..." className="mt-6 min-h-36 w-full resize-none rounded-xl border border-line bg-cloud p-4 text-sm leading-6 outline-none transition placeholder:text-muted/70 focus:border-blue focus:bg-white focus:ring-4 focus:ring-blue/10" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1"><button className="rounded-lg p-2 text-muted hover:bg-cloud"><Paperclip size={16} /></button><button className="rounded-lg p-2 text-muted hover:bg-cloud"><Image size={16} /></button><span className="ml-2 text-[11px] text-muted">Drafts are saved locally</span></div><div className="flex items-center gap-2"><button onClick={() => setShowComposer(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-muted hover:bg-cloud">Cancel</button><button onClick={createDraft} className="flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-700">{saved ? <><Check size={14} /> Saved</> : <><Send size={14} /> Save draft</>}</button></div></div></div></div>}
      {activeModal && <ComplianceModal kind={activeModal} onClose={() => setActiveModal(null)} onSave={activeModal === 'consent' ? async () => { await Promise.all(['privacy_notice', 'analytics'].map((purpose) => fetch(`${API_BASE}/api/consents`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purpose, choice: purpose === 'privacy_notice' ? 'granted' : 'declined', policyVersion: '2026-09-21', source: 'privacy_choices', locale: navigator.language }) }))) } : undefined} />}
    </div>
  )
}

function ComplianceModal({ kind, onClose, onSave }: { kind: 'account' | 'publish' | 'consent'; onClose: () => void; onSave?: () => Promise<void> }) {
  const isAccount = kind === 'account'
  const isPublish = kind === 'publish'
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="compliance-modal-title" className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-soft text-blue">{isAccount ? <Link2 size={19} /> : isPublish ? <Send size={19} /> : <ShieldCheck size={19} />}</div><div><h2 id="compliance-modal-title" className="font-display text-lg font-bold">{isAccount ? 'Connect a publishing account' : isPublish ? 'Review before publishing' : 'Privacy and cookie choices'}</h2><p className="mt-1 text-xs leading-5 text-muted">{isAccount ? 'Choose an approved connection method and review the permissions before continuing.' : isPublish ? 'Nothing will be posted until you explicitly confirm this review.' : 'Control optional analytics and personalization. Essential security storage always remains on.'}</p></div></div><button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-cloud"><X size={17} /></button></div>
    {isAccount && <div className="mt-6 space-y-3"><label className="block text-xs font-bold text-ink" htmlFor="account-platform">Platform<select id="account-platform" className="mt-2 w-full rounded-lg border border-line bg-cloud px-3 py-2.5 text-sm outline-none focus:border-blue focus:ring-4 focus:ring-blue/10"><option>X / Twitter</option><option>Threads</option><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>YouTube</option></select></label><div className="rounded-xl border border-blue/20 bg-blue-soft p-3 text-xs leading-5 text-ink"><strong>Official API first.</strong> ScrollTell will use the platform's approved OAuth/API flow. Browser automation is unavailable where the platform's rules prohibit scripted website access.</div><label className="flex items-start gap-3 rounded-xl border border-line p-3 text-xs leading-5"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue" />I understand which permissions I am granting and can revoke access from the platform at any time.</label></div>}
    {isPublish && <div className="mt-6 space-y-3"><div className="rounded-xl bg-cloud p-4"><div className="flex items-center justify-between text-xs"><span className="font-bold">Destination</span><span className="font-semibold text-muted">X / Twitter</span></div><div className="mt-3 text-sm leading-6">The quiet advantage of building in public is that the work becomes its own feedback loop.</div><div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-muted"><CheckCircle2 size={14} className="text-green" /> Text length checked · No media attached</div></div><label className="flex items-start gap-3 rounded-xl border border-line p-3 text-xs leading-5"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue" />I confirm this content, destination, and account are correct. I have the rights to publish the attached material.</label></div>}
    {!isAccount && !isPublish && <div className="mt-6 space-y-3"><ConsentRow title="Essential security and session storage" description="Required to sign in, protect the service, and remember your privacy choice." required /><ConsentRow title="Analytics" description="Off by default. Enable only if you want to help improve the product with aggregated usage data." /><ConsentRow title="Third-party embeds" description="Not currently used. External content will remain blocked until you choose to load it." /></div>}
    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-muted hover:bg-cloud">Cancel</button><button type="button" onClick={async () => { await onSave?.(); onClose() }} className="rounded-lg bg-ink px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700">{isAccount ? 'Continue to authorization' : isPublish ? 'Confirm and queue' : 'Save preferences'}</button></div>
  </section></div>
}

function ConsentRow({ title, description, required = false }: { title: string; description: string; required?: boolean }) {
  return <label className="flex items-start gap-3 rounded-xl border border-line p-3"><input type="checkbox" defaultChecked={required} disabled={required} className="mt-0.5 h-4 w-4 accent-blue" /><span><span className="block text-xs font-bold">{title} {required && <span className="font-medium text-muted">(always on)</span>}</span><span className="mt-1 block text-[11px] leading-5 text-muted">{description}</span></span></label>
}

function MetricCard({ label, value, detail, icon: Icon, accent, onClick }: { label: string; value: string; detail: string; icon: typeof Zap; accent: 'blue' | 'violet' | 'peach'; onClick?: () => void }) {
  const accents = { blue: 'bg-blue-soft text-blue', violet: 'bg-lilac text-violet', peach: 'bg-peach text-coral' }
  return <button type="button" onClick={onClick} className={`w-full rounded-2xl border border-line bg-white p-5 text-left shadow-[0_8px_30px_rgba(40,52,80,0.035)] ${onClick ? 'transition hover:-translate-y-0.5 hover:border-blue/30' : ''}`}><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}><Icon size={16} /></span></div><div className="mt-4 font-display text-3xl font-bold tracking-tight">{value}</div><div className="mt-1 text-[11px] font-medium text-muted">{detail}</div>{onClick && <span className="mt-3 block text-[11px] font-bold text-blue">Review before posting →</span>}</button>
}

function StatusPill({ status }: { status: string }) {
  const style = status === 'Ready' ? 'bg-mint text-green' : status === 'Scheduled' ? 'bg-lilac text-violet' : 'bg-cloud text-muted'
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}>{status}</span>
}

export default App
