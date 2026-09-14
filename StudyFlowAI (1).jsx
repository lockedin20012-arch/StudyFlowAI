import { useState, useEffect, useRef, Component } from "react";
import {
  Home, BookOpen, HelpCircle, ListChecks, Layers, FileText, MessageCircle,
  Target, CalendarClock, Library, CreditCard, Flame, LogOut, Sparkles,
  ChevronRight, ChevronLeft, Plus, Upload, Check, X, ArrowRight, Star,
  Zap, Menu, Loader2, RotateCcw, Trash2, Award, TrendingUp, Clock,
  ShieldCheck, CheckCircle2, AlertCircle, GraduationCap, FileUp, Shuffle
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ----------------------------- constants ----------------------------- */

const TOOLS = [
  { key: "guide", name: "AI Study Guide", desc: "Turn notes into an organized guide", icon: FileText, color: "indigo" },
  { key: "flashcards", name: "AI Flashcards", desc: "Auto-generated cards, spaced review", icon: Layers, color: "violet" },
  { key: "quiz", name: "AI Quiz Maker", desc: "Test yourself, see weak spots", icon: ListChecks, color: "amber" },
  { key: "practice", name: "AI Practice Tests", desc: "Targeted drills on weak topics", icon: Target, color: "rose" },
  { key: "homework", name: "AI Homework Helper", desc: "Step-by-step problem help", icon: HelpCircle, color: "emerald" },
  { key: "tutor", name: "AI Tutor", desc: "Chat through any concept", icon: MessageCircle, color: "sky" },
  { key: "planner", name: "AI Study Planner", desc: "A realistic weekly schedule", icon: CalendarClock, color: "orange" },
];

const COLOR = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200", solid: "bg-indigo-600", bar: "bg-indigo-500", activeBorder: "border-indigo-400", activeBg: "bg-indigo-50/60" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200", solid: "bg-violet-600", bar: "bg-violet-500", activeBorder: "border-violet-400", activeBg: "bg-violet-50/60" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", solid: "bg-amber-500", bar: "bg-amber-500", activeBorder: "border-amber-400", activeBg: "bg-amber-50/60" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", solid: "bg-rose-600", bar: "bg-rose-500", activeBorder: "border-rose-400", activeBg: "bg-rose-50/60" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", solid: "bg-emerald-600", bar: "bg-emerald-500", activeBorder: "border-emerald-400", activeBg: "bg-emerald-50/60" },
  sky: { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200", solid: "bg-sky-600", bar: "bg-sky-500", activeBorder: "border-sky-400", activeBg: "bg-sky-50/60" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", solid: "bg-orange-600", bar: "bg-orange-500", activeBorder: "border-orange-400", activeBg: "bg-orange-50/60" },
};

const FREE_MONTHLY_LIMIT = 10;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const daysUntil = (iso) => Math.ceil((new Date(iso) - new Date(todayISO())) / 86400000);
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

const defaultProfile = () => ({
  name: "", email: "", plan: "free", streak: 6, xp: 410, onboarded: false,
  usageCount: 0,
  usageMonth: new Date().getMonth(),
});

const defaultLibrary = () => ({
  subjects: [
    { id: "bio", name: "Biology", color: "emerald", progress: 62 },
    { id: "alg", name: "Algebra II", color: "indigo", progress: 44 },
    { id: "hist", name: "US History", color: "amber", progress: 78 },
    { id: "chem", name: "Chemistry", color: "rose", progress: 30 },
  ],
  exams: [
    { id: uid(), subject: "Chemistry", title: "Unit 4 Test — Stoichiometry", date: addDays(4) },
    { id: uid(), subject: "US History", title: "Chapter 12 Quiz", date: addDays(2) },
    { id: uid(), subject: "Algebra II", title: "Midterm Exam", date: addDays(11) },
  ],
  materials: [],
  quizResults: [],
  topicStats: {},
});

/* ----------------------------- AI helper ----------------------------- */

async function askClaude({ system, prompt, messages, content, json = false, maxTokens = 1000, timeoutMs = 45000 }) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages || [{ role: "user", content: content || prompt }],
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("That took too long and timed out. Try again.");
    throw e;
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error("AI request failed (" + res.status + ")");
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
  if (json) {
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    return JSON.parse(clean.slice(start, end + 1));
  }
  return text;
}

function weakTopics(topicStats, n = 3) {
  return Object.entries(topicStats)
    .map(([topic, s]) => ({ topic, acc: s.total ? s.correct / s.total : 0, total: s.total }))
    .filter((t) => t.total >= 2 && t.acc < 0.75)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, n);
}

/* --------------------------- upload → AI content --------------------------- */

function readFileAsUpload(file) {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read file"));
    if (isImage || isPdf) {
      reader.onload = () => {
        const result = String(reader.result);
        const match = result.match(/^data:(.+);base64,(.*)$/);
        if (!match) return reject(new Error("Unsupported file"));
        resolve({ kind: isImage ? "image" : "pdf", name: file.name, mediaType: match[1], base64: match[2], previewUrl: isImage ? result : null });
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      reader.onload = () => resolve({ kind: "text", name: file.name, textContent: String(reader.result).slice(0, 8000) });
      reader.readAsText(file);
    } else {
      reject(new Error("Upload a photo, a PDF, or a .txt file"));
    }
  });
}

// Builds a multimodal content array (image / PDF / plain text) plus an instruction, for the Messages API.
function buildContent(upload, instruction) {
  if (!upload) return instruction;
  if (upload.kind === "image") {
    return [{ type: "image", source: { type: "base64", media_type: upload.mediaType, data: upload.base64 } }, { type: "text", text: instruction }];
  }
  if (upload.kind === "pdf") {
    return [{ type: "document", source: { type: "base64", media_type: upload.mediaType, data: upload.base64 } }, { type: "text", text: instruction }];
  }
  return [{ type: "text", text: `${instruction}\n\n---\n${upload.textContent}` }];
}

/* ------------------------------ storage ------------------------------ */

const withTimeout = (promise, ms = 2500) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function loadState(setProfile, setLibrary) {
  try {
    if (!window.storage) throw new Error("no storage");
    const p = await withTimeout(window.storage.get("studyflow-profile"));
    setProfile(p ? JSON.parse(p.value) : defaultProfile());
  } catch { setProfile(defaultProfile()); }
  try {
    if (!window.storage) throw new Error("no storage");
    const l = await withTimeout(window.storage.get("studyflow-library"));
    setLibrary(l ? JSON.parse(l.value) : defaultLibrary());
  } catch { setLibrary(defaultLibrary()); }
}
async function saveProfile(p) { try { if (window.storage) await withTimeout(window.storage.set("studyflow-profile", JSON.stringify(p))); } catch {} }
async function saveLibrary(l) { try { if (window.storage) await withTimeout(window.storage.set("studyflow-library", JSON.stringify(l))); } catch {} }

/* ------------------------------- toasts ------------------------------- */

/* ------------------------------ scroll reveal ------------------------------ */

function useInView(threshold = 0.18) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setInView(true); return; }
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) { setInView(true); obs.unobserve(el); } }); },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

// Fades + slides an element up once, the first time it scrolls into view.
function Reveal({ children, delay = 0, className = "", as = "div" }) {
  const [ref, inView] = useInView();
  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0) scale(1)" : "translateY(22px) scale(0.98)",
        transition: `opacity .6s cubic-bezier(.22,.61,.36,1) ${delay}ms, transform .6s cubic-bezier(.22,.61,.36,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

// Wraps a list and staggers each direct child's reveal delay.
function RevealGroup({ children, className = "", step = 70, startDelay = 0 }) {
  const kids = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {kids.map((child, i) => (
        <Reveal key={child?.key ?? i} delay={startDelay + i * step}>{child}</Reveal>
      ))}
    </div>
  );
}

// Cycles through short status lines while a JSON generation is in flight, so waiting feels active, not stuck.
function LoadingMessages({ messages, color = "indigo" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 1300);
    return () => clearInterval(t);
  }, [messages.length]);
  const c = COLOR[color];
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-500">
      <span className={`inline-flex w-4 h-4 rounded-full border-2 border-slate-200 ${c.text.replace("text-", "border-t-")} animate-spin`} />
      <span key={i} style={{ animation: "fadein .3s ease" }}>{messages[i]}</span>
    </div>
  );
}

// A full, friendly placeholder for "nothing generated yet" — keeps the page from feeling like
// a lonely card floating over blank space.
function EmptyState({ icon: Icon, color = "indigo", title, subtitle, loading, loadingMessages, minH = "min-h-[280px]" }) {
  const c = COLOR[color];
  return (
    <MountPop className={`bg-white rounded-2xl border border-dashed border-slate-200 ${minH} flex items-center justify-center p-8`}>
      <div className="text-center max-w-xs">
        {loading ? (
          <LoadingMessages color={color} messages={loadingMessages || ["Working on it…"]} />
        ) : (
          <>
            <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.text} flex items-center justify-center mx-auto mb-3 animate-[floaty_3s_ease-in-out_infinite]`}>
              <Icon size={20} />
            </div>
            <div className="font-semibold text-slate-700 text-sm">{title}</div>
            {subtitle && <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{subtitle}</p>}
          </>
        )}
      </div>
    </MountPop>
  );
}

// Small persistent side panel of clickable tips — fills the empty column next to a short input
// form, and doubles as quick-start examples.
function TipsCard({ icon: Icon = Sparkles, color = "indigo", title = "Tips", tips = [], onPick }) {
  const c = COLOR[color];
  return (
    <Reveal className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}><Icon size={15} /></div>
        <div className="font-semibold text-sm text-slate-800">{title}</div>
      </div>
      <div className="space-y-2">
        {tips.map((t, i) => (
          <button key={i} onClick={() => onPick && onPick(t)}
            disabled={!onPick}
            className={`w-full text-left text-xs rounded-lg px-3 py-2.5 border border-slate-100 bg-slate-50 text-slate-600 transition ${onPick ? "hover:border-slate-300 hover:bg-white hover:-translate-y-0.5 cursor-pointer" : ""}`}>
            {t}
          </button>
        ))}
      </div>
    </Reveal>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (msg, kind = "info") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  };
  return { toasts, push };
}

function ToastStack({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div key={t.id}
          className={
            "px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-[fadein_.2s_ease] " +
            (t.kind === "error" ? "bg-rose-600 text-white" : t.kind === "success" ? "bg-emerald-600 text-white" : "bg-slate-900 text-white")
          }>
          {t.kind === "success" ? <CheckCircle2 size={16} /> : t.kind === "error" ? <AlertCircle size={16} /> : <Sparkles size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ============================== ERROR BOUNDARY ============================== */

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("StudyFlow crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6">
            <div className="font-semibold text-rose-700 mb-1">StudyFlow hit an error</div>
            <p className="text-sm text-slate-600">The app couldn't render. Details below — this usually means a tool or browser API isn't available in this preview.</p>
            <pre className="mt-3 text-xs bg-slate-50 rounded-lg p-3 overflow-auto text-slate-500 max-h-48">{String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}</pre>
            <button onClick={() => this.setState({ error: null })} className="mt-4 text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-lg">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================== APP ROOT ============================== */

export default function StudyFlowAI() {
  return (
    <ErrorBoundary>
      <StudyFlowApp />
    </ErrorBoundary>
  );
}

function StudyFlowApp() {
  const [booted, setBooted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [library, setLibrary] = useState(null);
  const [screen, setScreen] = useState("landing"); // landing | auth | app
  const [page, setPage] = useState("workspace");
  const [navOpen, setNavOpen] = useState(false);
  const [checkout, setCheckout] = useState(null); // plan key or null
  const [billingOpen, setBillingOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const { toasts, push } = useToasts();

  useEffect(() => {
    loadState(setProfile, setLibrary).then(() => setBooted(true));
  }, []);

  useEffect(() => { if (booted && profile) saveProfile(profile); }, [profile, booted]);
  useEffect(() => { if (booted && library) saveLibrary(library); }, [library, booted]);

  useEffect(() => {
    if (booted && profile?.onboarded) setScreen("app");
  }, [booted]);

  useEffect(() => {
    if (!profile) return;
    const m = new Date().getMonth();
    if (profile.usageMonth !== m) {
      setProfile((p) => ({ ...p, usageMonth: m, usageCount: 0 }));
    }
    // eslint-disable-next-line
  }, [profile?.usageMonth]);

  if (!booted || !profile || !library) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
          <GraduationCap size={20} />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="animate-spin text-indigo-500" size={16} /> Loading StudyFlow AI…
        </div>
      </div>
    );
  }

  const isFree = profile.plan === "free";
  // Every AI generation (any tool) draws from one shared monthly pool on the free plan.
  const canUse = () => {
    if (!isFree) return true;
    return (profile.usageCount || 0) < FREE_MONTHLY_LIMIT;
  };
  const bumpUsage = () => {
    setProfile((p) => ({ ...p, usageCount: (p.usageCount || 0) + 1, xp: p.xp + 4 }));
  };
  // Use inside a click handler / effect: returns false AND opens the upgrade paywall when the limit is hit.
  const requireUsage = () => {
    if (canUse()) return true;
    setLimitModalOpen(true);
    return false;
  };

  const addMaterial = (m) => setLibrary((l) => ({ ...l, materials: [{ id: uid(), createdAt: todayISO(), ...m }, ...l.materials] }));

  const recordQuiz = (result) => {
    setLibrary((l) => {
      const stats = { ...l.topicStats };
      result.perTopic.forEach(({ topic, correct, total }) => {
        const s = stats[topic] || { correct: 0, total: 0 };
        stats[topic] = { correct: s.correct + correct, total: s.total + total };
      });
      return { ...l, topicStats: stats, quizResults: [...l.quizResults, { id: uid(), date: todayISO(), ...result }] };
    });
    setProfile((p) => ({ ...p, xp: p.xp + Math.round(result.score * 5) }));
  };

  const signIn = (name, email) => {
    setProfile((p) => ({ ...p, name, email, onboarded: true }));
    setPage("workspace");
    setScreen("app");
    push(`Welcome to StudyFlow, ${name.split(" ")[0]}!`, "success");
  };

  const signOut = () => {
    setProfile((p) => ({ ...p, onboarded: false }));
    setScreen("landing");
    setPage("workspace");
  };

  const ctx = { profile, setProfile, library, setLibrary, addMaterial, recordQuiz, canUse, bumpUsage, requireUsage, push, isFree, setCheckout, setPage, openLimitModal: () => setLimitModalOpen(true) };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        .font-display{font-family:'Space Grotesk',ui-sans-serif,system-ui;}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .flip-card{perspective:1200px}
        .flip-inner{transition:transform .5s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}
        .flip-card.flipped .flip-inner{transform:rotateY(180deg)}
        .flip-face{backface-visibility:hidden}
        .flip-back{transform:rotateY(180deg)}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px}
      `}</style>

      {screen === "landing" && <Landing onStart={() => setScreen("auth")} />}
      {screen === "auth" && <Auth onSignIn={signIn} onBack={() => setScreen("landing")} />}
      {screen === "app" && (
        <AppShell
          page={page} setPage={setPage} navOpen={navOpen} setNavOpen={setNavOpen}
          profile={profile} onSignOut={signOut}
        >
          {page === "workspace" && <Workspace ctx={ctx} />}
          {page === "dashboard" && <Dashboard ctx={ctx} setPage={setPage} />}
          {page === "guide" && <StudyGuideTool ctx={ctx} />}
          {page === "flashcards" && <FlashcardsTool ctx={ctx} />}
          {page === "quiz" && <QuizTool ctx={ctx} />}
          {page === "practice" && <PracticeTool ctx={ctx} />}
          {page === "homework" && <HomeworkTool ctx={ctx} />}
          {page === "tutor" && <TutorTool ctx={ctx} />}
          {page === "planner" && <PlannerTool ctx={ctx} />}
          {page === "library" && <LibraryPage ctx={ctx} setPage={setPage} />}
          {page === "billing" && <BillingPage ctx={ctx} />}
        </AppShell>
      )}

      {checkout && <CheckoutModal plan={checkout} onClose={() => setCheckout(null)}
        onSuccess={(plan) => { setProfile((p) => ({ ...p, plan })); setCheckout(null); push("You're on StudyFlow Plus 🎉", "success"); }} />}

      {limitModalOpen && (
        <LimitModal
          onClose={() => setLimitModalOpen(false)}
          onUpgrade={(plan) => { setLimitModalOpen(false); setCheckout(plan); }}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}

/* ============================== LANDING ============================== */

function Landing({ onStart }) {
  return (
    <div>
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <button onClick={onStart} className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-slate-900">Sign in</button>
          <button onClick={onStart} className="text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition">
            Get started free
          </button>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 px-3 py-1 rounded-full mb-5">
            <Sparkles size={13} /> Built for how students actually study
          </div>
          <h1 className="font-display text-5xl leading-[1.05] font-semibold text-slate-900 tracking-tight">
            Turn your notes into grades that show it.
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-md leading-relaxed">
            Upload a PDF or paste your notes. StudyFlow builds the study guide, the flashcards,
            and the quiz — then tells you exactly what to review next.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <button onClick={onStart} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-500 transition shadow-sm shadow-indigo-200 flex items-center gap-2">
              Start studying free <ArrowRight size={17} />
            </button>
            <span className="text-sm text-slate-500">No credit card needed</span>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-1.5"><Star size={15} className="fill-amber-400 text-amber-400" /> 4.9/5 from students</div>
            <div>7 connected AI tools</div>
          </div>
        </div>

        <FlowDiagram />
      </section>

      {/* tools */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Every tool, one flow</h2>
            <p className="text-slate-600 mt-2 max-w-lg">Each tool feeds the next, so nothing you make ever sits unused.</p>
          </Reveal>
          <RevealGroup className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" step={60}>
            {TOOLS.map((t) => {
              const c = COLOR[t.color];
              return (
                <div key={t.key} className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 transition">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.text} flex items-center justify-center`}>
                    <t.icon size={19} />
                  </div>
                  <div className="mt-3 font-semibold text-slate-900">{t.name}</div>
                  <div className="text-sm text-slate-500 mt-1">{t.desc}</div>
                </div>
              );
            })}
          </RevealGroup>
        </div>
      </section>

      {/* pricing */}
      <section className="max-w-6xl mx-auto px-6 py-20" id="pricing">
        <Reveal className="text-center max-w-xl mx-auto" as="div">
          <h2 className="font-display text-3xl font-semibold text-slate-900">Simple pricing</h2>
          <p className="text-slate-600 mt-2">Start free. Upgrade when you need more.</p>
        </Reveal>
        <PricingGrid onPick={onStart} />
      </section>

      <footer className="border-t border-slate-200 py-8">
        <Reveal className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-slate-500">
          <Logo small />
          <span>© {new Date().getFullYear()} StudyFlow AI. Built for students.</span>
        </Reveal>
      </footer>
    </div>
  );
}

function Logo({ small }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`${small ? "w-6 h-6" : "w-8 h-8"} rounded-lg bg-slate-900 text-white flex items-center justify-center`}>
        <GraduationCap size={small ? 14 : 18} />
      </div>
      <span className={`font-display font-semibold ${small ? "text-sm" : "text-base"} text-slate-900`}>StudyFlow <span className="text-indigo-600">AI</span></span>
    </div>
  );
}

function FlowDiagram() {
  const steps = [
    { icon: Upload, label: "Notes / PDF" },
    { icon: FileText, label: "Study guide" },
    { icon: Layers, label: "Flashcards" },
    { icon: ListChecks, label: "Quiz" },
    { icon: Target, label: "Targeted practice" },
  ];
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(14px)", transition: "opacity .5s ease, transform .5s ease" }}>
      <div className="text-xs font-semibold text-slate-400 mb-4">HOW ONE UPLOAD BECOMES FIVE STUDY TOOLS</div>
      <div className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(-10px)", transition: `opacity .45s ease ${180 + i * 110}ms, transform .45s ease ${180 + i * 110}ms` }}>
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <s.icon size={16} />
              </div>
              {i < steps.length - 1 && <div className="w-px h-6 bg-slate-200" />}
            </div>
            <div className="font-medium text-slate-800 pb-6 pt-1.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 bg-emerald-50 text-emerald-700 rounded-xl p-3 text-sm flex items-center gap-2">
        <TrendingUp size={15} /> Weak topics surface automatically after every quiz.
      </div>
    </div>
  );
}

/* ================================ AUTH ================================ */

function Auth({ onSignIn, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("signup");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    setError("");
    if (mode === "signup" && !name.trim()) { setError("Enter your name to continue."); return; }
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email to continue."); return; }
    if (!pw.trim()) { setError("Enter a password to continue."); return; }
    setSubmitting(true);
    onSignIn(name.trim() || email.split("@")[0], email.trim());
  };

  const onEnter = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <MountPop className="w-full max-w-sm">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1">
          <ChevronLeft size={15} /> Back
        </button>
        <Logo />
        <h1 className="font-display text-2xl font-semibold mt-6">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="text-slate-500 text-sm mt-1">Free plan included. Cancel anytime.</p>

        <div className="mt-6 space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Jordan Lee" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} type="email"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="you@school.edu" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onEnter} type="password"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="••••••••" />
          </div>
          {error && <div className="text-sm text-rose-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</div>}
          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-indigo-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-indigo-500 transition mt-2 disabled:opacity-70 flex items-center justify-center gap-2">
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>

        <p className="text-sm text-slate-500 mt-5 text-center">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} className="text-indigo-600 font-semibold">
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </p>
        <div className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck size={13} /> Demo sign-in for this preview — production uses secure hashed-password + OAuth via a real backend.
        </div>
      </MountPop>
    </div>
  );
}

/* =============================== APP SHELL =============================== */

function AppShell({ children, page, setPage, navOpen, setNavOpen, profile, onSignOut }) {
  const navItems = [
    { key: "workspace", label: "Workspace", icon: Sparkles },
    { key: "dashboard", label: "Dashboard", icon: Home },
    ...TOOLS.map((t) => ({ key: t.key, label: t.name, icon: t.icon })),
    { key: "library", label: "Materials", icon: Library },
    { key: "billing", label: "Billing & Plan", icon: CreditCard },
  ];

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-5 py-5 border-b border-slate-100"><Logo /></div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => { setPage(item.key); setNavOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                page === item.key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:translate-x-0.5"
              }`}>
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
              {profile.name.slice(0, 1).toUpperCase() || "S"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-800 truncate">{profile.name || "Student"}</div>
              <div className="text-xs text-slate-400 capitalize">{profile.plan} plan</div>
            </div>
            <button onClick={onSignOut} title="Sign out" className="text-slate-400 hover:text-slate-700"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* main */}
      <div className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-20">
          <Logo small />
          <button onClick={() => setNavOpen(true)}><Menu size={20} /></button>
        </div>
        <main className="p-5 lg:p-8 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

/* =============================== DASHBOARD =============================== */

function Dashboard({ ctx, setPage }) {
  const { profile, library } = ctx;
  const weak = weakTopics(library.topicStats);
  const scoreTrend = library.quizResults.slice(-8).map((r, i) => ({ name: `Q${i + 1}`, score: Math.round((r.score / r.total) * 100) }));
  const upcoming = [...library.exams].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Welcome back{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}</h1>
          <p className="text-slate-500 text-sm mt-1">Here's where your studying stands today.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Flame size={15} className="fill-orange-500 text-orange-500" /> {profile.streak}-day streak
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Award size={15} /> {profile.xp} XP
          </div>
        </div>
      </div>

      {/* quick access */}
      <RevealGroup className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3" step={45}>
        {TOOLS.map((t) => {
          const c = COLOR[t.color];
          return (
            <button key={t.key} onClick={() => setPage(t.key)}
              className="bg-white border border-slate-200 rounded-xl p-3.5 text-left hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 transition group">
              <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}><t.icon size={15} /></div>
              <div className="text-xs font-semibold mt-2.5 text-slate-800 leading-tight">{t.name.replace("AI ", "")}</div>
            </button>
          );
        })}
      </RevealGroup>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* subjects */}
          <Reveal className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-900 mb-4">Subjects</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {library.subjects.map((s) => {
                const c = COLOR[s.color];
                return (
                  <div key={s.id} className="border border-slate-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <span className="text-slate-400">{s.progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          {/* score trend */}
          <Reveal className="bg-white rounded-2xl border border-slate-200 p-5" delay={80}>
            <div className="font-semibold text-slate-900 mb-1">Quiz scores</div>
            <p className="text-xs text-slate-400 mb-3">Last {scoreTrend.length || 0} quizzes</p>
            {scoreTrend.length ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip formatter={(v) => v + "%"} />
                    <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-sm text-slate-400 py-10 text-center">Take a quiz to start tracking your scores.</div>
            )}
          </Reveal>

          {weak.length > 0 && (
            <Reveal className="bg-rose-50 border border-rose-100 rounded-2xl p-5" delay={120}>
              <div className="font-semibold text-rose-800 flex items-center gap-2"><Target size={16} /> Weak topics detected</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {weak.map((w) => (
                  <span key={w.topic} className="text-xs font-medium bg-white text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
                    {w.topic} · {Math.round(w.acc * 100)}%
                  </span>
                ))}
              </div>
              <button onClick={() => setPage("practice")} className="mt-3 text-sm font-semibold text-rose-700 flex items-center gap-1">
                Generate targeted practice <ArrowRight size={14} />
              </button>
            </Reveal>
          )}
        </div>

        <div className="space-y-5">
          {/* exams */}
          <Reveal className="bg-white rounded-2xl border border-slate-200 p-5" delay={40}>
            <div className="font-semibold text-slate-900 mb-3">Upcoming exams</div>
            <div className="space-y-2.5">
              {upcoming.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-800">{e.title}</div>
                    <div className="text-xs text-slate-400">{e.subject} · {fmtDate(e.date)}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${daysUntil(e.date) <= 3 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                    {daysUntil(e.date)}d
                  </span>
                </div>
              ))}
              {upcoming.length === 0 && <div className="text-sm text-slate-400">No exams scheduled.</div>}
            </div>
          </Reveal>

          {/* streak strip */}
          <Reveal className="bg-white rounded-2xl border border-slate-200 p-5" delay={90}>
            <div className="font-semibold text-slate-900 mb-3">Last 14 days</div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className={`aspect-square rounded-md ${i >= 14 - profile.streak ? "bg-orange-400" : "bg-slate-100"}`} />
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Study once a day to keep your streak alive.</p>
          </Reveal>

          {ctx.isFree && (
            <Reveal className="bg-slate-900 rounded-2xl p-5 text-white" delay={140}>
              <div className="font-semibold flex items-center gap-1.5"><Zap size={15} className="fill-amber-400 text-amber-400" /> StudyFlow Plus</div>
              <p className="text-sm text-slate-300 mt-1.5">Unlimited AI generations, unlimited tutor chat, priority speed.</p>
              <button onClick={() => setPage("billing")} className="mt-3 bg-white text-slate-900 text-sm font-semibold px-3.5 py-2 rounded-lg">Upgrade</button>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}

/* =============================== WORKSPACE =============================== */

const WORKSPACE_TOOLS = [
  { key: "homework", emoji: "📸", name: "Homework Helper", desc: "Step-by-step help with this problem", color: "emerald" },
  { key: "quiz", emoji: "📝", name: "Quiz Maker", desc: "5/10/20 questions, your way", color: "amber" },
  { key: "flashcards", emoji: "🃏", name: "Flashcards", desc: "Flip, shuffle, track what you know", color: "violet" },
  { key: "guide", emoji: "📚", name: "Study Guide", desc: "A clean, organized breakdown", color: "indigo" },
  { key: "tutor", emoji: "🧠", name: "AI Tutor", desc: "Talk it through, question by question", color: "sky" },
  { key: "practice", emoji: "🎯", name: "Practice Test", desc: "Harder, exam-style questions", color: "rose" },
];

// Each section manages its own independent upload — tools no longer share one file.
function useUpload() {
  const [upload, setUpload] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    setError("");
    try {
      const u = await readFileAsUpload(file);
      setUpload(u);
    } catch (e) { setError(e.message || "Couldn't read that file — try a photo, PDF, or .txt."); }
  };
  const onDrop = (e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); };
  const usePastedText = () => {
    if (!pasteText.trim()) return;
    setUpload({ kind: "text", name: "Pasted notes", textContent: pasteText.slice(0, 8000) });
    setPasteOpen(false);
  };
  const reset = () => { setUpload(null); setError(""); setPasteText(""); setPasteOpen(false); };

  return { upload, dragActive, setDragActive, pasteOpen, setPasteOpen, pasteText, setPasteText, error, inputRef, handleFiles, onDrop, usePastedText, reset };
}

function UsageMeter({ ctx }) {
  if (!ctx.isFree) return null;
  const used = ctx.profile.usageCount || 0;
  const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used);
  const pct = Math.min(100, (used / FREE_MONTHLY_LIMIT) * 100);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-medium text-slate-700">Free AI generations this month</span>
          <span className={remaining === 0 ? "text-rose-500 font-semibold" : "text-slate-400"}>{used}/{FREE_MONTHLY_LIMIT}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {remaining <= 3 && (
        <button onClick={ctx.openLimitModal} className="text-xs font-semibold bg-slate-900 text-white px-3.5 py-2 rounded-lg shrink-0 hover:bg-slate-800 transition">
          Upgrade
        </button>
      )}
    </div>
  );
}

// Quick-jump pill nav — click to smooth-scroll to a tool's section.
function SectionNav({ tools, onJump }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6 sticky top-14 lg:top-0 z-10 bg-slate-50/90 backdrop-blur py-2 -mx-1 px-1">
      {tools.map((t, i) => (
        <Reveal key={t.key} delay={i * 40} className="shrink-0">
          <button onClick={() => onJump(t.key)}
            className="text-sm font-medium px-3.5 py-2 rounded-full border border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-sm transition flex items-center gap-1.5 whitespace-nowrap">
            <span>{t.emoji}</span> {t.name}
          </button>
        </Reveal>
      ))}
    </div>
  );
}

function MountPop({ children, className = "", delay = 0 }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 20 + delay); return () => clearTimeout(t); }, []); // eslint-disable-line
  return (
    <div className={className} style={{
      opacity: show ? 1 : 0,
      transform: show ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
      transition: "opacity .4s cubic-bezier(.22,.61,.36,1), transform .4s cubic-bezier(.22,.61,.36,1)",
    }}>
      {children}
    </div>
  );
}

function UploadPreview({ upload, onRemove }) {
  return (
    <MountPop className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3.5">
      {upload.kind === "image" ? (
        <img src={upload.previewUrl} alt={upload.name} className="w-14 h-14 rounded-xl object-cover border border-slate-100" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
          <FileText size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800 truncate">{upload.name}</div>
        <div className="text-xs text-slate-400">{upload.kind === "image" ? "Photo" : upload.kind === "pdf" ? "PDF" : "Pasted text"} · ready to use</div>
      </div>
      <button onClick={onRemove} className="text-xs font-semibold text-slate-400 hover:text-rose-500 flex items-center gap-1 shrink-0"><X size={13} /> Remove</button>
    </MountPop>
  );
}

// Compact per-section dropzone — each tool section gets its own.
function DropZone({ u, color }) {
  const c = COLOR[color];
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); u.setDragActive(true); }}
        onDragLeave={() => u.setDragActive(false)}
        onDrop={u.onDrop}
        onClick={() => u.inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-7 sm:p-9 text-center transition-all duration-200 ${
          u.dragActive ? `${c.activeBorder} ${c.activeBg} scale-[1.01]` : "border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <div className={`w-12 h-12 mx-auto rounded-xl ${c.solid} text-white flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${u.dragActive ? "scale-110" : "animate-[floaty_3s_ease-in-out_infinite]"}`}>
          <Upload size={20} />
        </div>
        <div className="mt-3 font-semibold text-slate-800">Drop a file here</div>
        <p className="text-xs text-slate-500 mt-1">Photo, scanned page, or PDF — or click to browse</p>
        <input ref={u.inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => u.handleFiles(e.target.files)} />
      </div>
      {u.error && <div className="mt-2 text-xs text-rose-600 flex items-center justify-center gap-1.5"><AlertCircle size={13} /> {u.error}</div>}
      <div className="text-center mt-3">
        <button onClick={() => u.setPasteOpen((o) => !o)} className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2">
          Don't have a file? Paste notes instead
        </button>
      </div>
      {u.pasteOpen && (
        <MountPop className="mt-3">
          <textarea value={u.pasteText} onChange={(e) => u.setPasteText(e.target.value)} rows={4}
            placeholder="Paste your notes or homework text here..."
            className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <button onClick={u.usePastedText} className="mt-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">Use this text</button>
        </MountPop>
      )}
    </div>
  );
}

// One independent, self-contained tool card: header + its own dropzone + (once uploaded) the live tool.
function ToolSection({ ctx, tool, sectionRef, children }) {
  const u = useUpload();
  const c = COLOR[tool.color];
  return (
    <div ref={sectionRef} className="scroll-mt-32">
      <Reveal>
        <div className="group relative bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 overflow-hidden hover:shadow-md hover:shadow-slate-200/60 transition-shadow duration-300">
          <div className={`absolute top-0 left-0 right-0 h-1 ${c.solid} opacity-80`} />
          <div className="flex items-start gap-3.5 mb-5">
            <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
              {tool.emoji}
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-slate-900">{tool.name}</div>
              <div className="text-sm text-slate-500">{tool.desc}</div>
            </div>
          </div>

          {!u.upload ? (
            <DropZone u={u} color={tool.color} />
          ) : (
            <div className="space-y-5">
              <UploadPreview upload={u.upload} onRemove={u.reset} />
              <MountPop delay={80}>{children(u.upload)}</MountPop>
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

const WORKSPACE_TOOL_RENDER = {
  homework: (ctx, upload) => <WorkspaceHomework ctx={ctx} upload={upload} />,
  quiz: (ctx, upload) => <WorkspaceQuiz ctx={ctx} upload={upload} mode="quiz" />,
  flashcards: (ctx, upload) => <WorkspaceFlashcards ctx={ctx} upload={upload} />,
  guide: (ctx, upload) => <WorkspaceGuide ctx={ctx} upload={upload} />,
  tutor: (ctx, upload) => <WorkspaceTutor ctx={ctx} upload={upload} />,
  practice: (ctx, upload) => <WorkspaceQuiz ctx={ctx} upload={upload} mode="practice" />,
};

function Workspace({ ctx }) {
  const sectionRefs = useRef({});
  const jumpTo = (key) => sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div>
      <style>{`
        @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{scrollbar-width:none}
      `}</style>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Workspace</h1>
        <p className="text-slate-500 text-sm mt-1">Pick a tool below, drop in your homework, and go — each one's independent.</p>
      </div>

      <UsageMeter ctx={ctx} />
      <SectionNav tools={WORKSPACE_TOOLS} onJump={jumpTo} />

      <div className="space-y-6">
        {WORKSPACE_TOOLS.map((t) => (
          <ToolSection key={t.key} ctx={ctx} tool={t} sectionRef={(el) => (sectionRefs.current[t.key] = el)}>
            {(upload) => WORKSPACE_TOOL_RENDER[t.key](ctx, upload)}
          </ToolSection>
        ))}
      </div>
    </div>
  );
}

/* ---------- Workspace: Homework Helper ---------- */

function WorkspaceHomework({ ctx, upload }) {
  const [loading, setLoading] = useState(true);
  const [apiHistory, setApiHistory] = useState(null);
  const [convo, setConvo] = useState([]);
  const [followUp, setFollowUp] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const ran = useRef(false);

  useEffect(() => { if (ran.current) return; ran.current = true; run(); }, []); // eslint-disable-line

  const run = async () => {
    if (!ctx.requireUsage("homework")) { setLoading(false); return; }
    setLoading(true);
    setConvo([]);
    try {
      const content = buildContent(upload, "This is a student's homework (photo, PDF, or notes). Identify the problem(s) and explain how to solve them step by step, showing your reasoning, then clearly label the final answer(s). Be encouraging and clear.");
      const msgs = [{ role: "user", content }];
      const a = await askClaude({
        system: "You are StudyFlow's AI Homework Helper — patient, clear, and step-by-step. Never just give the answer with no explanation.",
        messages: msgs, maxTokens: 900,
      });
      setApiHistory([...msgs, { role: "assistant", content: a }]);
      setConvo([{ role: "assistant", text: a }]);
      ctx.bumpUsage("homework");
    } catch (e) { ctx.push(e.message || "Couldn't read that homework. Try another photo or a clearer scan.", "error"); }
    setLoading(false);
  };

  const ask = async () => {
    if (!followUp.trim() || !apiHistory) return;
    if (!ctx.requireUsage("homework")) return;
    const q = followUp.trim();
    setFollowUp(""); setFollowLoading(true);
    const nextHistory = [...apiHistory, { role: "user", content: q }];
    setConvo((c) => [...c, { role: "user", text: q }]);
    try {
      const a = await askClaude({
        system: "You are StudyFlow's AI Homework Helper. Continue helping with the same problem, staying clear and step-by-step.",
        messages: nextHistory, maxTokens: 700,
      });
      setApiHistory([...nextHistory, { role: "assistant", content: a }]);
      setConvo((c) => [...c, { role: "assistant", text: a }]);
      ctx.bumpUsage("homework");
    } catch (e) { ctx.push(e.message || "Couldn't get a reply. Try again.", "error"); }
    setFollowLoading(false);
  };

  const visibleConvo = convo.filter((m) => m.text);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      {loading && <LoadingMessages color="emerald" messages={["Reading your homework…", "Working through the problem…", "Writing the steps out…"]} />}
      {!loading && visibleConvo.length > 0 && (
        <div className="space-y-4">
          {visibleConvo.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user" ? "bg-emerald-600 text-white rounded-2xl px-4 py-2.5 text-sm max-w-[80%]" : "text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"}>
                {m.text}
              </div>
            </div>
          ))}
          {followLoading && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={14} /> Thinking…</div>}
          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <input value={followUp} onChange={(e) => setFollowUp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ask a follow-up…" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={ask} disabled={followLoading} className="bg-emerald-600 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-60">Ask</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Workspace: Study Guide ---------- */

function WorkspaceGuide({ ctx, upload }) {
  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState(null);
  const ran = useRef(false);

  useEffect(() => { if (ran.current) return; ran.current = true; generate(); }, []); // eslint-disable-line

  const generate = async () => {
    if (!ctx.requireUsage("guide")) { setLoading(false); return; }
    setLoading(true);
    try {
      const content = buildContent(upload, "Create a well-organized study guide from this material.");
      const g = await askClaude({
        system: "You are an expert study guide creator. Return ONLY valid JSON (no markdown) matching: {\"title\":string,\"sections\":[{\"heading\":string,\"topic\":string,\"summary\":string,\"keyPoints\":[string,string,string]}]}. Produce 3-5 sections, concise and accurate.",
        content, json: true, maxTokens: 1200,
      });
      setGuide(g);
      ctx.bumpUsage("guide");
    } catch { ctx.push("Couldn't generate the guide. Try again.", "error"); }
    setLoading(false);
  };

  if (!ctx.canUse("guide") && !guide) return <UpgradeBlock ctx={ctx} setPage={ctx.setPage} />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      {loading && <LoadingMessages color="indigo" messages={["Reading your material…", "Spotting the key ideas…", "Organizing it into sections…"]} />}
      {!loading && guide && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-900">{guide.title}</h3>
            <button onClick={() => { ctx.addMaterial({ type: "guide", title: guide.title, subject: "Uploaded work", payload: guide }); ctx.push("Saved to your library.", "success"); }}
              className="text-xs font-semibold text-indigo-600 flex items-center gap-1"><Plus size={13} /> Save</button>
          </div>
          <div className="space-y-4">
            {guide.sections.map((s, i) => (
              <div key={i} className="border-l-2 border-indigo-200 pl-3">
                <div className="text-sm font-semibold text-slate-800">{s.heading}</div>
                <p className="text-sm text-slate-600 mt-1">{s.summary}</p>
                <ul className="mt-1.5 space-y-1">{s.keyPoints?.map((k, j) => <li key={j} className="text-xs text-slate-500 flex gap-1.5"><span className="text-indigo-400">•</span>{k}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Workspace: Flashcards (know / need practice) ---------- */

function WorkspaceFlashcards({ ctx, upload }) {
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState(null);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const ran = useRef(false);

  useEffect(() => { if (ran.current) return; ran.current = true; generate(); }, []); // eslint-disable-line

  const generate = async () => {
    if (!ctx.requireUsage("flashcards")) { setLoading(false); return; }
    setLoading(true);
    try {
      const content = buildContent(upload, "Generate flashcards for spaced-repetition study from this material.");
      const d = await askClaude({
        system: "Return ONLY JSON: {\"title\":string,\"cards\":[{\"front\":string,\"back\":string,\"topic\":string}]}. Produce 8-10 concise cards covering the material.",
        content, json: true, maxTokens: 1200,
      });
      const cards = d.cards.map((c) => ({ ...c, id: uid(), status: "new" }));
      setDeck({ title: d.title, cards });
      setOrder(cards.map((_, i) => i));
      ctx.bumpUsage("flashcards");
    } catch { ctx.push("Couldn't generate flashcards. Try again.", "error"); }
    setLoading(false);
  };

  if (!ctx.canUse("flashcards") && !deck) return <UpgradeBlock ctx={ctx} setPage={ctx.setPage} />;
  if (loading) return <div className="bg-white rounded-2xl border border-slate-200 p-6"><LoadingMessages color="violet" messages={["Reading your material…", "Pulling out key terms…", "Writing the back of each card…"]} /></div>;
  if (!deck) return null;

  const visibleOrder = reviewMode ? order.filter((i) => deck.cards[i].status !== "know") : order;

  if (reviewMode && visibleOrder.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={28} />
        <div className="font-semibold text-slate-800">Every card is marked "Know it"!</div>
        <button onClick={() => setReviewMode(false)} className="mt-4 text-sm font-semibold text-indigo-600">Back to full deck</button>
      </div>
    );
  }

  const safeIdx = Math.min(idx, Math.max(0, visibleOrder.length - 1));
  const cardIdx = visibleOrder[safeIdx];
  const card = deck.cards[cardIdx];
  const known = deck.cards.filter((c) => c.status === "know").length;

  const mark = (status) => {
    setDeck((d) => ({ ...d, cards: d.cards.map((c, i) => (i === cardIdx ? { ...c, status } : c)) }));
    setFlipped(false);
    setIdx((i) => (i + 1 < visibleOrder.length ? i + 1 : 0));
  };

  const shuffle = () => {
    const shuffled = [...order];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    setOrder(shuffled); setIdx(0); setFlipped(false);
  };

  const save = () => { ctx.addMaterial({ type: "flashcards", title: deck.title, subject: "Uploaded work", payload: { title: deck.title, cards: deck.cards } }); ctx.push("Saved to your library.", "success"); };

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-3">
          <span className="text-sm text-slate-400">{safeIdx + 1} / {visibleOrder.length}</span>
          <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">{card.topic}</span>
        </div>
        <div className="flip-card w-full max-w-md h-56" onClick={() => setFlipped(!flipped)}>
          <div className={`flip-inner relative w-full h-full cursor-pointer ${flipped ? "flipped" : ""}`}>
            <div className="flip-face absolute inset-0 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center p-6 text-center">
              <p className="font-medium text-slate-800">{card.front}</p>
            </div>
            <div className="flip-face flip-back absolute inset-0 bg-slate-900 text-white rounded-2xl flex items-center justify-center p-6 text-center">
              <p className="font-medium">{card.back}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">Tap the card to flip</p>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={() => mark("practice")} className="text-sm font-semibold bg-rose-50 text-rose-600 px-4 py-2 rounded-lg">Need practice</button>
          <button onClick={() => mark("know")} className="text-sm font-semibold bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg">Know it</button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => { setIdx((i) => Math.max(0, i - 1)); setFlipped(false); }} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <button onClick={shuffle} title="Shuffle" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"><Shuffle size={15} /></button>
          <button onClick={() => { setIdx((i) => (i + 1 < visibleOrder.length ? i + 1 : 0)); setFlipped(false); }} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="font-semibold text-slate-900 mb-1">{deck.title}</div>
        <div className="text-xs text-slate-400 mb-3">{known}/{deck.cards.length} known</div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(known / deck.cards.length) * 100}%` }} /></div>
        <button onClick={() => { setReviewMode((r) => !r); setIdx(0); setFlipped(false); }}
          className={`w-full text-sm font-semibold rounded-lg py-2 mb-2 ${reviewMode ? "bg-slate-900 text-white" : "bg-rose-50 text-rose-700"}`}>
          {reviewMode ? "Reviewing weak cards" : "Review weak cards"}
        </button>
        <button onClick={save} className="w-full text-sm font-semibold bg-violet-50 text-violet-700 rounded-lg py-2 flex items-center justify-center gap-1.5"><Plus size={14} /> Save deck</button>
      </div>
    </div>
  );
}

/* ---------- Workspace: Quiz Maker / Practice Test ---------- */

function WorkspaceQuestion({ q, index, total, color, onAnswer }) {
  const c = COLOR[color];
  const [picked, setPicked] = useState(null);
  const [shortInput, setShortInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const isChoice = q.type === "mcq" || q.type === "truefalse";

  const next = () => {
    const correct = picked === q.correctIndex;
    onAnswer({ topic: q.topic, correct, question: q.question, yourAnswer: q.options[picked], correctAnswer: q.options[q.correctIndex] });
  };
  const selfGrade = (correct) => {
    onAnswer({ topic: q.topic, correct, question: q.question, yourAnswer: shortInput || "(no answer)", correctAnswer: q.answer });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-400">Question {index + 1} of {total}</span>
        <span className={`text-xs font-semibold ${c.text}`}>{q.topic}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div className={`h-full ${c.solid} rounded-full transition-all`} style={{ width: `${(index / total) * 100}%` }} />
      </div>
      <p className="font-medium text-slate-900 mb-4">{q.question}</p>

      {isChoice && (
        <>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              let cls = "border-slate-200 hover:border-slate-300";
              if (picked !== null) {
                if (oi === q.correctIndex) cls = "border-emerald-400 bg-emerald-50";
                else if (oi === picked) cls = "border-rose-300 bg-rose-50";
                else cls = "border-slate-100 opacity-60";
              }
              return <button key={oi} onClick={() => picked === null && setPicked(oi)} className={`w-full text-left border rounded-xl px-4 py-2.5 text-sm transition ${cls}`}>{opt}</button>;
            })}
          </div>
          {picked !== null && <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">{q.explanation}</div>}
          <div className="flex justify-end mt-5">
            <button onClick={next} disabled={picked === null} className={`text-sm font-semibold text-white px-4 py-2 rounded-lg ${c.solid} disabled:opacity-40`}>
              {index + 1 === total ? "See results" : "Next question"}
            </button>
          </div>
        </>
      )}

      {q.type === "short" && (
        !revealed ? (
          <>
            <input value={shortInput} onChange={(e) => setShortInput(e.target.value)} placeholder="Type your answer…"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <div className="flex justify-end mt-4">
              <button onClick={() => setRevealed(true)} className={`text-sm font-semibold text-white px-4 py-2 rounded-lg ${c.solid}`}>Check answer</button>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600 mb-2"><span className="font-semibold text-slate-800">Model answer: </span>{q.answer}</div>
            {q.explanation && <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-500 mb-4">{q.explanation}</div>}
            <div className="text-xs text-slate-400 mb-2">Be honest — did you get it right?</div>
            <div className="flex gap-2">
              <button onClick={() => selfGrade(false)} className="text-sm font-semibold bg-rose-50 text-rose-600 px-4 py-2 rounded-lg flex-1">I missed it</button>
              <button onClick={() => selfGrade(true)} className="text-sm font-semibold bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg flex-1">I got it right</button>
            </div>
          </>
        )
      )}
    </div>
  );
}

function WorkspaceQuiz({ ctx, upload, mode }) {
  const isPractice = mode === "practice";
  const toolKey = isPractice ? "practice" : "quiz";
  const [count, setCount] = useState(5);
  const [customCount, setCustomCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [types, setTypes] = useState({ mcq: true, truefalse: true, short: false });
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [i, setI] = useState(0);
  const [result, setResult] = useState(null);

  const effectiveCount = count === "custom" ? Math.max(1, Math.min(40, customCount || 10)) : count;
  const selectedTypes = Object.entries(types).filter(([, v]) => v).map(([k]) => k);

  const generate = async () => {
    if (!ctx.requireUsage(toolKey)) return;
    if (!isPractice && selectedTypes.length === 0) { ctx.push("Pick at least one question type.", "error"); return; }
    setLoading(true); setQuiz(null); setResult(null); setAnswers([]); setI(0);
    try {
      const instruction = isPractice
        ? `Create a challenging, exam-style practice test with ${effectiveCount} multiple-choice questions based on this material. Push beyond simple recall — application and analysis level.`
        : `Create a ${difficulty}-difficulty quiz with exactly ${effectiveCount} questions based on this material, using only these question types: ${selectedTypes.join(", ")}. If more than one type is selected, mix them roughly evenly.`;
      const content = buildContent(upload, instruction);
      const q = await askClaude({
        system: 'Return ONLY valid JSON, no markdown fences: {"title":string,"questions":[{"type":"mcq"|"truefalse"|"short","question":string,"topic":string,"explanation":string,"options":[string,...],"correctIndex":number,"answer":string}]}. For "mcq" give exactly 4 options and a correctIndex. For "truefalse" give options ["True","False"] and a correctIndex. For "short" omit options/correctIndex and give a concise ideal "answer" instead. Give every question a specific topic tag.',
        content, json: true, maxTokens: 1800,
      });
      setQuiz(q);
      ctx.bumpUsage(toolKey);
    } catch { ctx.push("Couldn't build the quiz. Try again.", "error"); }
    setLoading(false);
  };

  const finish = (allAnswers) => {
    const byTopic = {};
    allAnswers.forEach((a) => { byTopic[a.topic] = byTopic[a.topic] || { correct: 0, total: 0 }; byTopic[a.topic].total++; if (a.correct) byTopic[a.topic].correct++; });
    const score = allAnswers.filter((a) => a.correct).length;
    const r = { score, total: allAnswers.length, perTopic: Object.entries(byTopic).map(([topic, v]) => ({ topic, ...v })), mistakes: allAnswers.filter((a) => !a.correct) };
    setResult(r);
    ctx.recordQuiz({ score: r.score, total: r.total, perTopic: r.perTopic });
  };

  const submitAnswer = (entry) => {
    const next = [...answers, entry];
    setAnswers(next);
    if (i + 1 < quiz.questions.length) setI(i + 1);
    else finish(next);
  };

  const retry = () => { setAnswers([]); setI(0); setResult(null); };
  const newQuiz = () => { setQuiz(null); setResult(null); setAnswers([]); setI(0); };

  if (!ctx.canUse(toolKey) && !quiz) return <UpgradeBlock ctx={ctx} setPage={ctx.setPage} />;

  if (!quiz) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-xl">
        <div className="font-semibold text-slate-900 mb-4">{isPractice ? "Set up your practice test" : "Set up your quiz"}</div>
        <div className="mb-4">
          <div className="text-xs font-medium text-slate-500 mb-1.5">Number of questions</div>
          <div className="flex flex-wrap items-center gap-2">
            {[5, 10, 20].map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg border ${count === n ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>{n}</button>
            ))}
            <button onClick={() => setCount("custom")} className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg border ${count === "custom" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>Custom</button>
            {count === "custom" && (
              <input type="number" min={1} max={40} value={customCount} onChange={(e) => setCustomCount(Number(e.target.value))} className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
            )}
          </div>
        </div>
        {!isPractice && (
          <>
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 mb-1.5">Difficulty</div>
              <div className="flex gap-2">
                {["easy", "medium", "hard"].map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)} className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg border capitalize ${difficulty === d ? "bg-amber-500 text-white border-amber-500" : "border-slate-300 text-slate-600"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-medium text-slate-500 mb-1.5">Question types</div>
              <div className="flex flex-wrap gap-2">
                {[["mcq", "Multiple choice"], ["truefalse", "True / False"], ["short", "Short answer"]].map(([k, label]) => (
                  <button key={k} onClick={() => setTypes((t) => ({ ...t, [k]: !t[k] }))}
                    className={`text-sm font-medium px-3.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${types[k] ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-300 text-slate-500"}`}>
                    {types[k] && <Check size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button onClick={generate} disabled={loading} className={`text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60 flex items-center gap-2 ${isPractice ? "bg-rose-600 hover:bg-rose-500" : "bg-amber-500 hover:bg-amber-400"}`}>
          {loading && <Loader2 size={14} className="animate-spin" />} Generate {isPractice ? "practice test" : "quiz"}
        </button>
        {loading && (
          <div className="mt-3">
            <LoadingMessages color={isPractice ? "rose" : "amber"} messages={["Reading your material…", "Writing questions…", "Double-checking answers…"]} />
          </div>
        )}
      </div>
    );
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="text-center">
          <div className="text-4xl font-display font-semibold text-slate-900">{pct}%</div>
          <p className="text-slate-500 mt-1">{result.score} of {result.total} correct</p>
        </div>
        {result.mistakes.length > 0 && (
          <div className="mt-6 max-w-lg mx-auto text-left">
            <div className="text-sm font-semibold text-slate-700 mb-2">Review your mistakes</div>
            <div className="space-y-2">
              {result.mistakes.map((m, mi) => (
                <div key={mi} className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-sm">
                  <div className="font-medium text-slate-800">{m.question}</div>
                  <div className="text-rose-600 mt-1">Your answer: {m.yourAnswer}</div>
                  <div className="text-emerald-600">Correct: {m.correctAnswer}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={retry} className="text-sm font-semibold border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-1.5"><RotateCcw size={14} /> Retry same {isPractice ? "test" : "quiz"}</button>
          <button onClick={newQuiz} className="text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-lg">New {isPractice ? "test" : "quiz"}</button>
        </div>
      </div>
    );
  }

  const q = quiz.questions[i];
  return <WorkspaceQuestion key={i} q={q} index={i} total={quiz.questions.length} color={isPractice ? "rose" : "amber"} onAnswer={submitAnswer} />;
}

/* ---------- Workspace: AI Tutor ---------- */

function WorkspaceTutor({ ctx, upload }) {
  const [apiHistory, setApiHistory] = useState(null);
  const [convo, setConvo] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const ran = useRef(false);
  const endRef = useRef(null);

  useEffect(() => { if (ran.current) return; ran.current = true; start(); }, []); // eslint-disable-line
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convo]);

  const start = async () => {
    if (!ctx.requireUsage("tutor")) { setLoading(false); return; }
    setLoading(true);
    try {
      const content = buildContent(upload, "Briefly (2-3 sentences) acknowledge what this homework or notes appear to cover, then ask the student what they'd like help understanding.");
      const msgs = [{ role: "user", content }];
      const a = await askClaude({ system: "You are StudyFlow AI Tutor — friendly, Socratic, encouraging.", messages: msgs, maxTokens: 300 });
      setApiHistory([...msgs, { role: "assistant", content: a }]);
      setConvo([{ role: "assistant", text: a }]);
      ctx.bumpUsage("tutor");
    } catch { ctx.push("Tutor is unavailable right now.", "error"); }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || !apiHistory) return;
    if (!ctx.requireUsage("tutor")) return;
    const q = input.trim(); setInput("");
    const nextHistory = [...apiHistory, { role: "user", content: q }];
    setConvo((c) => [...c, { role: "user", text: q }]);
    setLoading(true);
    try {
      const a = await askClaude({ system: "You are StudyFlow AI Tutor — friendly, Socratic, encouraging. Keep responses focused and conversational.", messages: nextHistory, maxTokens: 500 });
      setApiHistory([...nextHistory, { role: "assistant", content: a }]);
      setConvo((c) => [...c, { role: "assistant", text: a }]);
      ctx.bumpUsage("tutor");
    } catch { ctx.push("Tutor is unavailable right now.", "error"); }
    setLoading(false);
  };

  if (!ctx.canUse("tutor") && convo.length === 0 && !loading) return <UpgradeBlock ctx={ctx} setPage={ctx.setPage} />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[480px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {convo.map((m, mi) => (
          <div key={mi} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-800"}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-slate-100 rounded-2xl px-3.5 py-2.5"><Loader2 size={14} className="animate-spin text-slate-500" /></div></div>}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-slate-100 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask anything about this…" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        <button onClick={send} disabled={loading} className="bg-sky-600 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-60">Send</button>
      </div>
    </div>
  );
}

/* ============================ SHARED UI BITS ============================ */

function PageHeader({ icon: Icon, color, title, desc }) {
  const c = COLOR[color];
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}><Icon size={19} /></div>
      <div>
        <h1 className="font-display text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function LimitBanner({ ctx }) {
  if (!ctx.isFree) return null;
  const used = ctx.profile.usageCount || 0;
  const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used);
  return (
    <div className={`text-xs font-medium rounded-lg px-3 py-2 mb-4 inline-flex items-center gap-1.5 ${remaining === 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
      <Zap size={12} /> {remaining === 0 ? "Free limit reached this month — upgrade for unlimited" : `${remaining} of ${FREE_MONTHLY_LIMIT} free AI generations left this month`}
    </div>
  );
}

function UpgradeBlock({ ctx, setPage }) {
  const open = () => (ctx ? ctx.openLimitModal() : setPage && setPage("billing"));
  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
      <Zap className="mx-auto text-indigo-500 mb-2" size={22} />
      <div className="font-semibold text-slate-800">You've hit your free limit</div>
      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Upgrade to StudyFlow Plus for unlimited AI generations across every tool.</p>
      <button onClick={open} className="mt-4 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500">
        View plans
      </button>
    </div>
  );
}

function SubjectSelect({ value, onChange, subjects }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
      {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
    </select>
  );
}

/* =========================== STUDY GUIDE TOOL =========================== */

function StudyGuideTool({ ctx }) {
  const [subject, setSubject] = useState(ctx.library.subjects[0]?.name || "General");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf") {
      ctx.push("PDF text extraction needs a backend service — for this preview, paste the text instead.", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setNotes(String(reader.result).slice(0, 6000));
    reader.readAsText(file);
  };

  const generate = async () => {
    if (!ctx.requireUsage("guide")) return;
    if (!notes.trim()) { ctx.push("Paste some notes or a topic first.", "error"); return; }
    setLoading(true);
    try {
      const g = await askClaude({
        system: "You are an expert study guide creator for students. Return ONLY valid JSON (no markdown) matching: {\"title\":string,\"sections\":[{\"heading\":string,\"topic\":string,\"summary\":string,\"keyPoints\":[string,string,string]}]}. Produce 3-5 sections. Keep it concise and accurate.",
        prompt: `Subject: ${subject}\nNotes:\n${notes}`,
        json: true,
      });
      setGuide(g);
      ctx.bumpUsage("guide");
      ctx.push("Study guide ready.", "success");
    } catch (e) { ctx.push("Couldn't generate the guide. Try again.", "error"); }
    setLoading(false);
  };

  const save = () => {
    ctx.addMaterial({ type: "guide", title: guide.title, subject, payload: guide });
    ctx.push("Saved to your library.", "success");
  };

  return (
    <div>
      <Reveal><PageHeader icon={FileText} color="indigo" title="AI Study Guide" desc="Paste notes or a topic — get a clean, organized guide." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="guide" label="study guides" />

      <div className="grid lg:grid-cols-2 gap-5">
        <Reveal className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">Subject</label>
            <SubjectSelect value={subject} onChange={setSubject} subjects={ctx.library.subjects} />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={10}
            placeholder="Paste your class notes, a textbook section, or just a topic like 'Photosynthesis'..."
            className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <div className="flex items-center justify-between mt-3">
            <button onClick={() => fileRef.current?.click()} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5">
              <Upload size={14} /> Upload .txt / .pdf
            </button>
            <input ref={fileRef} type="file" accept=".txt,.pdf,.md" className="hidden" onChange={handleFile} />
            {ctx.canUse("guide") ? (
              <button onClick={generate} disabled={loading} className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 disabled:opacity-60 flex items-center gap-2 hover:-translate-y-0.5 transition">
                {loading && <Loader2 size={14} className="animate-spin" />} Generate study guide
              </button>
            ) : null}
          </div>
          {!ctx.canUse("guide") && <div className="mt-4"><UpgradeBlock ctx={ctx} setPage={ctx.setPage} /></div>}
        </Reveal>

        {!guide ? (
          <EmptyState icon={FileText} color="indigo" minH="min-h-[320px]"
            loading={loading} loadingMessages={["Reading your material…", "Spotting the key ideas…", "Organizing it into sections…"]}
            title="Your generated guide will appear here" subtitle="Sections, summaries, and key points — ready to save or turn into flashcards." />
        ) : (
          <MountPop className="bg-white rounded-2xl border border-slate-200 p-5">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-slate-900">{guide.title}</h3>
                <button onClick={save} className="text-xs font-semibold text-indigo-600 flex items-center gap-1"><Plus size={13} /> Save</button>
              </div>
              <div className="space-y-4">
                {guide.sections.map((s, i) => (
                  <div key={i} className="border-l-2 border-indigo-200 pl-3">
                    <div className="text-sm font-semibold text-slate-800">{s.heading}</div>
                    <p className="text-sm text-slate-600 mt-1">{s.summary}</p>
                    <ul className="mt-1.5 space-y-1">
                      {s.keyPoints?.map((k, j) => <li key={j} className="text-xs text-slate-500 flex gap-1.5"><span className="text-indigo-400">•</span>{k}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
                <ToolChain ctx={ctx} source={guide} sourceType="guide" subject={subject} />
              </div>
            </div>
          </MountPop>
        )}
      </div>
    </div>
  );
}

function ToolChain({ ctx, source, sourceType, subject }) {
  return (
    <>
      <button onClick={() => { ctx.setPage("flashcards"); ctx.setPendingSource?.(source); }}
        className="text-xs font-semibold bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg flex items-center gap-1">
        Turn into flashcards <ArrowRight size={12} />
      </button>
      <button onClick={() => { ctx.setPage("quiz"); }}
        className="text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg flex items-center gap-1">
        Create a quiz <ArrowRight size={12} />
      </button>
    </>
  );
}

/* =========================== FLASHCARDS TOOL =========================== */

function FlashcardsTool({ ctx }) {
  const guides = ctx.library.materials.filter((m) => m.type === "guide");
  const [subject, setSubject] = useState(ctx.library.subjects[0]?.name || "General");
  const [sourceGuideId, setSourceGuideId] = useState(guides[0]?.id || "");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const generate = async () => {
    if (!ctx.requireUsage("flashcards")) return;
    const guide = guides.find((g) => g.id === sourceGuideId);
    if (!guide && !topic.trim()) { ctx.push("Pick a saved study guide or type a topic.", "error"); return; }
    setLoading(true);
    try {
      const d = await askClaude({
        system: "Generate flashcards for spaced-repetition study. Return ONLY JSON: {\"title\":string,\"cards\":[{\"front\":string,\"back\":string,\"topic\":string}]}. Produce 8-10 concise cards.",
        prompt: guide ? `Study guide:\n${JSON.stringify(guide.payload)}` : `Subject: ${subject}\nTopic: ${topic}`,
        json: true,
      });
      setDeck(d); setIdx(0); setFlipped(false);
      ctx.bumpUsage("flashcards");
      ctx.push("Flashcards ready.", "success");
    } catch { ctx.push("Couldn't generate flashcards. Try again.", "error"); }
    setLoading(false);
  };

  const save = () => { ctx.addMaterial({ type: "flashcards", title: deck.title, subject, payload: deck }); ctx.push("Saved to your library.", "success"); };

  return (
    <div>
      <Reveal><PageHeader icon={Layers} color="violet" title="AI Flashcards" desc="Generated from a study guide, or straight from a topic." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="flashcards" label="flashcard decks" />

      <Reveal className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">From a saved guide</label>
            <select value={sourceGuideId} onChange={(e) => setSourceGuideId(e.target.value)}
              className="block mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">— none —</option>
              {guides.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
          <div className="text-xs text-slate-400 pb-2">or</div>
          <div>
            <label className="text-xs font-medium text-slate-500">Subject</label>
            <div className="mt-1"><SubjectSelect value={subject} onChange={setSubject} subjects={ctx.library.subjects} /></div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-slate-500">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cell division"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {ctx.canUse("flashcards") && (
            <button onClick={generate} disabled={loading} className="bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-500 disabled:opacity-60 flex items-center gap-2 hover:-translate-y-0.5 transition">
              {loading && <Loader2 size={14} className="animate-spin" />} Generate
            </button>
          )}
        </div>
        {!ctx.canUse("flashcards") && <div className="mt-4"><UpgradeBlock ctx={ctx} setPage={ctx.setPage} /></div>}
      </Reveal>

      {!deck ? (
        <EmptyState icon={Layers} color="violet" minH="min-h-[300px]"
          loading={loading} loadingMessages={["Reading your material…", "Pulling out key terms…", "Writing the back of each card…"]}
          title="Your flashcard deck will appear here" subtitle="Flip through them, shuffle, and mark what you know as you go." />
      ) : (
        <div className="grid lg:grid-cols-[1fr_260px] gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center">
            <div className="text-sm text-slate-400 mb-4">{idx + 1} / {deck.cards.length}</div>
            <div className="flip-card w-full max-w-md h-56" onClick={() => setFlipped(!flipped)}>
              <div className={`flip-inner relative w-full h-full cursor-pointer ${flipped ? "flipped" : ""}`}>
                <div className="flip-face absolute inset-0 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center p-6 text-center">
                  <p className="font-medium text-slate-800">{deck.cards[idx].front}</p>
                </div>
                <div className="flip-face flip-back absolute inset-0 bg-slate-900 text-white rounded-2xl flex items-center justify-center p-6 text-center">
                  <p className="font-medium">{deck.cards[idx].back}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Tap the card to flip</p>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={() => { setIdx((i) => Math.max(0, i - 1)); setFlipped(false); }} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronLeft size={16} /></button>
              <button onClick={() => { setFlipped(false); setIdx(0); }} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"><RotateCcw size={15} /></button>
              <button onClick={() => { setIdx((i) => Math.min(deck.cards.length - 1, i + 1)); setFlipped(false); }} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-900 mb-3">{deck.title}</div>
            <button onClick={save} className="w-full text-sm font-semibold bg-violet-50 text-violet-700 rounded-lg py-2 mb-2 flex items-center justify-center gap-1.5"><Plus size={14} /> Save deck</button>
            <button onClick={() => ctx.setPage("quiz")} className="w-full text-sm font-semibold bg-amber-50 text-amber-700 rounded-lg py-2 flex items-center justify-center gap-1.5">Create quiz from this <ArrowRight size={13} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== QUIZ + PRACTICE (shared engine) ============================== */

function QuizRunner({ quiz, onFinish, color = "amber" }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const c = COLOR[color];
  const q = quiz.questions[i];

  const choose = (optIdx) => {
    if (picked !== null) return;
    setPicked(optIdx);
    const correct = optIdx === q.correctIndex;
    setAnswers([...answers, { topic: q.topic, correct }]);
  };

  const next = () => {
    if (i + 1 < quiz.questions.length) { setI(i + 1); setPicked(null); }
    else {
      const perTopicMap = {};
      answers.concat(picked !== null ? [] : []).forEach(() => {});
      const all = [...answers];
      const byTopic = {};
      all.forEach((a) => { byTopic[a.topic] = byTopic[a.topic] || { correct: 0, total: 0 }; byTopic[a.topic].total++; if (a.correct) byTopic[a.topic].correct++; });
      const score = all.filter((a) => a.correct).length;
      onFinish({ score, total: quiz.questions.length, perTopic: Object.entries(byTopic).map(([topic, v]) => ({ topic, ...v })) });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-400">Question {i + 1} of {quiz.questions.length}</span>
        <span className={`text-xs font-semibold ${c.text}`}>{q.topic}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div className={`h-full ${c.solid} rounded-full transition-all`} style={{ width: `${((i) / quiz.questions.length) * 100}%` }} />
      </div>
      <p className="font-medium text-slate-900 mb-4">{q.question}</p>
      <div className="space-y-2">
        {q.options.map((opt, oi) => {
          let cls = "border-slate-200 hover:border-slate-300";
          if (picked !== null) {
            if (oi === q.correctIndex) cls = "border-emerald-400 bg-emerald-50";
            else if (oi === picked) cls = "border-rose-300 bg-rose-50";
            else cls = "border-slate-100 opacity-60";
          }
          return (
            <button key={oi} onClick={() => choose(oi)} className={`w-full text-left border rounded-xl px-4 py-2.5 text-sm transition ${cls}`}>
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">{q.explanation}</div>
      )}
      <div className="flex justify-end mt-5">
        <button onClick={next} disabled={picked === null} className={`text-sm font-semibold text-white px-4 py-2 rounded-lg ${c.solid} disabled:opacity-40`}>
          {i + 1 === quiz.questions.length ? "See results" : "Next question"}
        </button>
      </div>
    </div>
  );
}

function QuizResults({ result, setPage, color = "amber" }) {
  const pct = Math.round((result.score / result.total) * 100);
  const weakHere = result.perTopic.filter((t) => t.correct / t.total < 0.75);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <div className="text-4xl font-display font-semibold text-slate-900">{pct}%</div>
      <p className="text-slate-500 mt-1">{result.score} of {result.total} correct</p>
      {weakHere.length > 0 && (
        <div className="mt-5 max-w-sm mx-auto text-left bg-rose-50 border border-rose-100 rounded-xl p-4">
          <div className="text-sm font-semibold text-rose-700 mb-1.5">Focus next on:</div>
          {weakHere.map((t) => (
            <div key={t.topic} className="text-sm text-rose-600 flex justify-between"><span>{t.topic}</span><span>{Math.round((t.correct / t.total) * 100)}%</span></div>
          ))}
        </div>
      )}
      <button onClick={() => setPage("practice")} className="mt-6 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
        Generate targeted practice
      </button>
    </div>
  );
}

function QuizTool({ ctx }) {
  const decks = ctx.library.materials.filter((m) => m.type === "flashcards" || m.type === "guide");
  const [subject, setSubject] = useState(ctx.library.subjects[0]?.name || "General");
  const [sourceId, setSourceId] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!ctx.requireUsage("quiz")) return;
    const source = decks.find((d) => d.id === sourceId);
    if (!source && !topic.trim()) { ctx.push("Pick saved material or type a topic.", "error"); return; }
    setLoading(true);
    try {
      const q = await askClaude({
        system: "Create a multiple-choice quiz. Return ONLY JSON: {\"title\":string,\"questions\":[{\"question\":string,\"options\":[string,string,string,string],\"correctIndex\":number,\"topic\":string,\"explanation\":string}]}. Produce 5 questions, varied difficulty, each with a specific topic tag.",
        prompt: source ? `Source material:\n${JSON.stringify(source.payload)}` : `Subject: ${subject}\nTopic: ${topic}`,
        json: true,
      });
      setQuiz(q); setResult(null);
      ctx.bumpUsage("quiz");
    } catch { ctx.push("Couldn't build the quiz. Try again.", "error"); }
    setLoading(false);
  };

  return (
    <div>
      <Reveal><PageHeader icon={ListChecks} color="amber" title="AI Quiz Maker" desc="Test yourself — StudyFlow tracks your weak spots automatically." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="quiz" label="quizzes" />

      {!quiz && (
        <Reveal className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">From saved material</label>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">— none —</option>
                {decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div className="text-xs text-slate-400 pb-2">or</div>
            <div><label className="text-xs font-medium text-slate-500">Subject</label><div className="mt-1"><SubjectSelect value={subject} onChange={setSubject} subjects={ctx.library.subjects} /></div></div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-slate-500">Topic</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. World War I causes"
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {ctx.canUse("quiz") && (
              <button onClick={generate} disabled={loading} className="bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-400 disabled:opacity-60 flex items-center gap-2 hover:-translate-y-0.5 transition">
                {loading && <Loader2 size={14} className="animate-spin" />} Generate quiz
              </button>
            )}
          </div>
          {!ctx.canUse("quiz") && <div className="mt-4"><UpgradeBlock ctx={ctx} setPage={ctx.setPage} /></div>}
        </Reveal>
      )}

      {!quiz && !result && (
        <div className="mt-5">
          <EmptyState icon={ListChecks} color="amber" minH="min-h-[260px]"
            loading={loading} loadingMessages={["Reading your material…", "Writing questions…", "Double-checking answers…"]}
            title="Your quiz will appear here" subtitle="Answer at your own pace — StudyFlow tracks which topics need more work." />
        </div>
      )}

      {quiz && !result && <MountPop><QuizRunner quiz={quiz} color="amber" onFinish={(r) => { setResult(r); ctx.recordQuiz(r); }} /></MountPop>}
      {result && <MountPop><QuizResults result={result} setPage={ctx.setPage} color="amber" /></MountPop>}
      {result && <button onClick={() => { setQuiz(null); setResult(null); }} className="mt-4 text-sm text-slate-500 hover:text-slate-800">← Make another quiz</button>}
    </div>
  );
}

/* ============================== PRACTICE TESTS ============================== */

function PracticeTool({ ctx }) {
  const weak = weakTopics(ctx.library.topicStats, 5);
  const [subject, setSubject] = useState(ctx.library.subjects[0]?.name || "General");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);

  const generate = async (useWeak) => {
    if (!ctx.requireUsage("practice")) return;
    setLoading(true);
    try {
      const topics = useWeak ? weak.map((w) => w.topic).join(", ") : subject;
      const q = await askClaude({
        system: "Create a harder, targeted practice test. Return ONLY JSON: {\"title\":string,\"questions\":[{\"question\":string,\"options\":[string,string,string,string],\"correctIndex\":number,\"topic\":string,\"explanation\":string}]}. Produce 6 challenging questions focused specifically on the listed topics.",
        prompt: `Focus topics: ${topics}`,
        json: true,
      });
      setQuiz(q); setResult(null);
      ctx.bumpUsage("practice");
    } catch { ctx.push("Couldn't build the practice test. Try again.", "error"); }
    setLoading(false);
  };

  return (
    <div>
      <Reveal><PageHeader icon={Target} color="rose" title="AI Practice Tests" desc="Harder questions, aimed at exactly what you're missing." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="practice" label="practice tests" />

      {!quiz && (
        <RevealGroup className="grid sm:grid-cols-2 gap-4" step={80}>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-900 mb-2">Target your weak topics</div>
            {weak.length ? (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {weak.map((w) => <span key={w.topic} className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded-full">{w.topic}</span>)}
              </div>
            ) : <p className="text-sm text-slate-400 mb-4">Take a quiz first — StudyFlow needs a couple of results to detect weak spots.</p>}
            {ctx.canUse("practice") && (
              <button disabled={!weak.length || loading} onClick={() => generate(true)} className="w-full bg-rose-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition">
                {loading && <Loader2 size={14} className="animate-spin" />} Generate from weak topics
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-900 mb-2">Or pick a subject</div>
            <div className="mb-4"><SubjectSelect value={subject} onChange={setSubject} subjects={ctx.library.subjects} /></div>
            {ctx.canUse("practice") && (
              <button disabled={loading} onClick={() => generate(false)} className="w-full bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition">
                {loading && <Loader2 size={14} className="animate-spin" />} Generate full practice test
              </button>
            )}
          </div>
          {!ctx.canUse("practice") && <div className="sm:col-span-2"><UpgradeBlock ctx={ctx} setPage={ctx.setPage} /></div>}
        </RevealGroup>
      )}

      {!quiz && !result && (
        <div className="mt-5">
          <EmptyState icon={Target} color="rose" minH="min-h-[220px]"
            loading={loading} loadingMessages={["Reading your material…", "Raising the difficulty…", "Double-checking answers…"]}
            title="Your practice test will appear here" subtitle="Exam-style questions built around exactly what you're missing." />
        </div>
      )}

      {quiz && !result && <MountPop><QuizRunner quiz={quiz} color="rose" onFinish={(r) => { setResult(r); ctx.recordQuiz(r); }} /></MountPop>}
      {result && <MountPop><QuizResults result={result} setPage={ctx.setPage} color="rose" /></MountPop>}
      {result && <button onClick={() => { setQuiz(null); setResult(null); }} className="mt-4 text-sm text-slate-500 hover:text-slate-800">← New practice test</button>}
    </div>
  );
}

/* ============================== HOMEWORK HELPER ============================== */

function HomeworkTool({ ctx }) {
  const [subject, setSubject] = useState(ctx.library.subjects[0]?.name || "General");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");

  const ask = async () => {
    if (!q.trim()) return;
    if (!ctx.requireUsage("homework")) return;
    setLoading(true); setAnswer("");
    try {
      const a = await askClaude({
        system: "You are a patient, encouraging AI homework helper for students. Explain step by step how to solve the problem, showing the reasoning, then clearly label the final answer. Keep it focused — don't pad. Never just give the answer with no explanation.",
        prompt: `Subject: ${subject}\nQuestion: ${q}`,
        maxTokens: 900,
      });
      setAnswer(a);
      ctx.bumpUsage("homework");
    } catch (e) { ctx.push(e.message || "Couldn't get an answer. Try again.", "error"); }
    setLoading(false);
  };

  return (
    <div>
      <Reveal><PageHeader icon={HelpCircle} color="emerald" title="AI Homework Helper" desc="Paste a problem and get a step-by-step walkthrough." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="homework" label="homework help" />
      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-5">
          <Reveal className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Subject</label>
              <SubjectSelect value={subject} onChange={setSubject} subjects={ctx.library.subjects} />
            </div>
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={4}
              placeholder="e.g. Solve for x: 3x + 7 = 22, and explain each step"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            <button onClick={ask} disabled={loading} className="mt-3 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-500 disabled:opacity-60 flex items-center gap-2 hover:-translate-y-0.5 transition">
              {loading && <Loader2 size={14} className="animate-spin" />} Get help
            </button>
          </Reveal>

          {(loading || answer) ? (
            <MountPop className="bg-white rounded-2xl border border-slate-200 p-5">
              {loading && !answer ? <LoadingMessages color="emerald" messages={["Reading your problem…", "Working through it…", "Writing the steps out…"]} />
                : <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{answer}</p>}
            </MountPop>
          ) : (
            <EmptyState icon={HelpCircle} color="emerald" title="Your step-by-step help will show up here"
              subtitle="Paste any problem — math, science, writing — and get a clear walkthrough, not just the answer." />
          )}
        </div>

        <TipsCard icon={Sparkles} color="emerald" title="Try an example" onPick={setQ} tips={[
          "Solve for x: 2(x - 3) + 5 = 15, show every step",
          "Explain how photosynthesis converts sunlight into energy",
          "Balance this equation: Fe + O2 → Fe2O3",
          "What's the theme of a story where the hero fails, then tries again?",
        ]} />
      </div>
    </div>
  );
}

/* ================================= AI TUTOR ================================= */

function TutorTool({ ctx }) {
  const [subject, setSubject] = useState(ctx.library.subjects[0]?.name || "General");
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! I'm your AI tutor. What are we working on today?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    if (!ctx.requireUsage("tutor")) return;
    const next = [...messages, { role: "user", content: input }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const reply = await askClaude({
        system: `You are StudyFlow AI Tutor, a friendly, Socratic tutor helping a student with ${subject}. Ask guiding questions when useful, explain clearly, keep responses conversational and not too long.`,
        messages: next,
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      ctx.bumpUsage("tutor");
    } catch { ctx.push("Tutor is unavailable right now.", "error"); }
    setLoading(false);
  };

  return (
    <div>
      <Reveal><PageHeader icon={MessageCircle} color="sky" title="AI Tutor" desc="Work through a concept together, one question at a time." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="tutor" label="tutor messages" />
      <Reveal delay={60} className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[520px]">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Subject</span>
          <SubjectSelect value={subject} onChange={setSubject} subjects={ctx.library.subjects} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} style={{ animation: "fadein .3s ease" }}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-slate-100 rounded-2xl px-3.5 py-2.5"><Loader2 size={14} className="animate-spin text-slate-500" /></div></div>}
          <div ref={endRef} />
        </div>
        <div className="p-3 border-t border-slate-100 flex gap-2">
          {ctx.canUse("tutor") ? (
            <>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask anything…" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              <button onClick={send} disabled={loading} className="bg-sky-600 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-60 hover:bg-sky-500 transition">Send</button>
            </>
          ) : <div className="flex-1"><UpgradeBlock ctx={ctx} setPage={ctx.setPage} /></div>}
        </div>
      </Reveal>
    </div>
  );
}

/* ================================ PLANNER ================================ */

function PlannerTool({ ctx }) {
  const [hours, setHours] = useState(2);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);

  const generate = async () => {
    if (!ctx.requireUsage("planner")) return;
    setLoading(true);
    try {
      const weak = weakTopics(ctx.library.topicStats).map((w) => w.topic);
      const p = await askClaude({
        system: "You are an AI study planner. Build a realistic 7-day study schedule prioritizing near-term exams and weak topics. Return ONLY JSON: {\"weekPlan\":[{\"day\":string,\"blocks\":[{\"time\":string,\"subject\":string,\"task\":string}]}]}. 2-3 blocks per day max, keep tasks short.",
        prompt: `Subjects: ${ctx.library.subjects.map((s) => s.name).join(", ")}\nUpcoming exams: ${ctx.library.exams.map((e) => `${e.title} (${e.subject}) in ${daysUntil(e.date)} days`).join("; ")}\nWeak topics: ${weak.join(", ") || "none yet"}\nAvailable study time: ${hours} hours/day`,
        json: true,
      });
      setPlan(p);
      ctx.bumpUsage("planner");
      ctx.addMaterial({ type: "plan", title: `Weekly plan — ${new Date().toLocaleDateString()}`, subject: "All subjects", payload: p });
    } catch { ctx.push("Couldn't build a plan. Try again.", "error"); }
    setLoading(false);
  };

  const weakList = weakTopics(ctx.library.topicStats, 4);
  const upcoming = [...ctx.library.exams].sort((a, b) => daysUntil(a.date) - daysUntil(b.date)).slice(0, 4);

  return (
    <div>
      <Reveal><PageHeader icon={CalendarClock} color="orange" title="AI Study Planner" desc="A realistic weekly schedule built around your exams." /></Reveal>
      <LimitBanner ctx={ctx} toolKey="planner" label="weekly plans" />

      <Reveal className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500">Hours available per day</label>
          <input type="number" min={1} max={8} value={hours} onChange={(e) => setHours(Number(e.target.value))}
            className="mt-1 block w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {ctx.canUse("planner") && (
          <button onClick={generate} disabled={loading} className="bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-500 disabled:opacity-60 flex items-center gap-2 hover:-translate-y-0.5 transition">
            {loading && <Loader2 size={14} className="animate-spin" />} Generate my week
          </button>
        )}
        {!ctx.canUse("planner") && <UpgradeBlock ctx={ctx} setPage={ctx.setPage} />}
      </Reveal>

      {!plan && (
        <RevealGroup className="grid sm:grid-cols-2 gap-4 mb-5" step={80}>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><CalendarClock size={16} className="text-orange-500" /> What it'll prioritize</div>
            {upcoming.length ? (
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{e.title}</span>
                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{daysUntil(e.date)}d</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No exams on the calendar yet — it'll build a general review week instead.</p>}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Target size={16} className="text-rose-500" /> Weak spots it'll target</div>
            {weakList.length ? (
              <div className="flex flex-wrap gap-1.5">
                {weakList.map((w) => <span key={w.topic} className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded-full">{w.topic}</span>)}
              </div>
            ) : <p className="text-sm text-slate-400">Take a quiz or two and this'll fill in with exactly what to review.</p>}
          </div>
        </RevealGroup>
      )}

      {!plan ? (
        <EmptyState icon={CalendarClock} color="orange" minH="min-h-[220px]"
          loading={loading} loadingMessages={["Checking your exam dates…", "Balancing your subjects…", "Blocking out study time…"]}
          title="Your weekly schedule will appear here" subtitle="A day-by-day plan built from your exams, subjects, and weak topics." />
      ) : (
        <RevealGroup className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" step={60}>
          {plan.weekPlan.map((d, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm hover:-translate-y-0.5 transition">
              <div className="font-semibold text-sm text-slate-900 mb-2.5">{d.day}</div>
              <div className="space-y-2">
                {d.blocks.map((b, j) => (
                  <div key={j} className="text-xs bg-orange-50 rounded-lg p-2">
                    <div className="font-semibold text-orange-700 flex items-center gap-1"><Clock size={11} /> {b.time}</div>
                    <div className="text-slate-700 mt-0.5">{b.subject}</div>
                    <div className="text-slate-500">{b.task}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </RevealGroup>
      )}
    </div>
  );
}

/* ================================ LIBRARY ================================ */

function LibraryPage({ ctx, setPage }) {
  const [filter, setFilter] = useState("all");
  const items = ctx.library.materials.filter((m) => filter === "all" || m.type === filter);
  const del = (id) => ctx.setLibrary((l) => ({ ...l, materials: l.materials.filter((m) => m.id !== id) }));
  const typeLabel = { guide: "Study Guide", flashcards: "Flashcards", plan: "Weekly Plan" };
  const typeIcon = { guide: FileText, flashcards: Layers, plan: CalendarClock };

  return (
    <div>
      <Reveal><PageHeader icon={Library} color="indigo" title="Your Materials" desc="Everything you've generated and saved, in one place." /></Reveal>
      <Reveal delay={40} className="flex gap-2 mb-5">
        {["all", "guide", "flashcards", "plan"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition hover:-translate-y-0.5 ${filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{f}</button>
        ))}
      </Reveal>
      {items.length === 0 ? (
        <EmptyState icon={Library} color="indigo" minH="min-h-[280px]"
          title="Nothing saved yet" subtitle="Generate a study guide, flashcard deck, or weekly plan and save it here for quick access later." />
      ) : (
        <RevealGroup className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" step={50}>
          {items.map((m) => {
            const Icon = typeIcon[m.type] || FileText;
            return (
              <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:-translate-y-0.5 transition">
                <div className="flex items-start justify-between">
                  <Icon className="text-indigo-500" size={17} />
                  <button onClick={() => del(m.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                </div>
                <div className="font-medium text-sm text-slate-800 mt-2">{m.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{typeLabel[m.type]} · {m.subject} · {m.createdAt}</div>
              </div>
            );
          })}
        </RevealGroup>
      )}
    </div>
  );
}

/* ================================ PRICING / BILLING ================================ */

const PLANS = [
  { key: "free", name: "Free", price: "$0", per: "forever", features: [`${FREE_MONTHLY_LIMIT} AI generations / mo`, "Any mix of all 6 tools", "Homework help included", "Resets monthly"] },
  { key: "plus-monthly", name: "Plus Monthly", price: "$7.99", per: "/month", features: ["Unlimited everything", "All 7 AI tools", "Priority generation speed", "Cancel anytime"] },
  { key: "plus-yearly", name: "Plus Yearly", price: "$59.99", per: "/year", badge: "Best Value", features: ["Unlimited everything", "All 7 AI tools", "Priority generation speed", "Equivalent to $5/month"] },
];

function PricingGrid({ onPick, current, onUpgrade }) {
  return (
    <RevealGroup className="mt-10 grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto" step={90}>
      {PLANS.map((p) => (
        <div key={p.key} className={`relative rounded-2xl p-6 border transition hover:-translate-y-0.5 ${p.badge ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white"}`}>
          {p.badge && <span className="absolute -top-3 left-6 bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">{p.badge}</span>}
          <div className="font-semibold text-slate-900">{p.name}</div>
          <div className="mt-2 flex items-baseline gap-1"><span className="text-3xl font-display font-semibold">{p.price}</span><span className="text-sm text-slate-400">{p.per}</span></div>
          <ul className="mt-4 space-y-2">
            {p.features.map((f, i) => <li key={i} className="text-sm text-slate-600 flex items-center gap-2"><Check size={14} className="text-emerald-500 shrink-0" /> {f}</li>)}
          </ul>
          {current ? (
            current === p.key
              ? <div className="mt-5 text-center text-sm font-semibold text-slate-400 border border-slate-200 rounded-lg py-2">Current plan</div>
              : <button onClick={() => onUpgrade(p.key)} className={`mt-5 w-full text-sm font-semibold rounded-lg py-2.5 ${p.key === "free" ? "border border-slate-300 text-slate-600" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}>
                  {p.key === "free" ? "Downgrade" : "Upgrade"}
                </button>
          ) : (
            <button onClick={onPick} className={`mt-5 w-full text-sm font-semibold rounded-lg py-2.5 ${p.key === "free" ? "border border-slate-300 text-slate-600" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}>
              {p.key === "free" ? "Start free" : "Choose plan"}
            </button>
          )}
        </div>
      ))}
    </RevealGroup>
  );
}

function BillingPage({ ctx }) {
  const { profile, setCheckout } = ctx;
  const currentPlanKey = profile.plan === "free" ? "free" : profile.plan;

  return (
    <div>
      <Reveal><PageHeader icon={CreditCard} color="indigo" title="Billing & Plan" desc="Manage your subscription securely through Stripe." /></Reveal>

      <Reveal delay={40} className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-slate-400">Current plan</div>
          <div className="font-semibold text-slate-900 capitalize">{profile.plan.replace("-", " ")}</div>
        </div>
        {profile.plan !== "free" && (
          <button onClick={() => ctx.push("In production this opens the Stripe Customer Portal to update payment method or cancel.", "info")}
            className="text-sm font-semibold border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 hover:-translate-y-0.5 transition flex items-center gap-2">
            <CreditCard size={15} /> Manage billing
          </button>
        )}
      </Reveal>

      <Reveal delay={80} className="mb-6"><UsageMeter ctx={ctx} /></Reveal>

      <PricingGrid current={currentPlanKey} onUpgrade={(key) => {
        if (key === "free") { ctx.setProfile((p) => ({ ...p, plan: "free" })); ctx.push("Downgraded to Free.", "info"); return; }
        setCheckout(key);
      }} />

      <Reveal delay={120} className="mt-8 max-w-2xl mx-auto flex items-start gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-4">
        <ShieldCheck size={15} className="shrink-0 mt-0.5" />
        Payments go through Stripe's own hosted checkout — StudyFlow's servers never see or store your card details.
        {STRIPE_PAYMENT_LINKS["plus-monthly"] || STRIPE_PAYMENT_LINKS["plus-yearly"]
          ? " This account is connected to a live Stripe Checkout link."
          : " No Stripe account is connected in this preview yet, so upgrades run in a clearly-labeled demo mode rather than faking a real purchase."}
      </Reveal>
    </div>
  );
}

function LimitModal({ onClose, onUpgrade }) {
  const resetLabel = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  })();

  return (
    <div className="fixed inset-0 bg-slate-900/55 z-[95] flex items-center justify-center p-4 animate-[fadein_.2s_ease]" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-7 relative overflow-hidden" onClick={(e) => e.stopPropagation()}
        style={{ animation: "popmodal .35s cubic-bezier(.22,.9,.4,1.3)" }}>
        <style>{`@keyframes popmodal{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full" />
        <div className="absolute -bottom-12 -left-8 w-28 h-28 bg-amber-50 rounded-full" />
        <div className="relative">
          <button onClick={onClose} className="absolute -top-1 -right-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Zap size={22} />
          </div>
          <div className="font-display text-xl font-semibold text-slate-900">You've used all {FREE_MONTHLY_LIMIT} free AI generations</div>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Free plan includes {FREE_MONTHLY_LIMIT} AI generations a month across every tool. Yours refresh on{" "}
            <span className="font-semibold text-slate-700">{resetLabel}</span> — or go Plus now for unlimited access, no waiting.
          </p>
          <div className="mt-5 space-y-2">
            <button onClick={() => onUpgrade("plus-yearly")}
              className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-indigo-500 transition flex items-center justify-center gap-2">
              Go Plus Yearly — $59.99/yr
              <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">BEST VALUE</span>
            </button>
            <button onClick={() => onUpgrade("plus-monthly")}
              className="w-full border border-slate-300 text-slate-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition">
              Go Plus Monthly — $7.99/mo
            </button>
          </div>
          <button onClick={onClose} className="w-full text-center text-xs text-slate-400 mt-4 hover:text-slate-600">
            Maybe later — I'll wait for the reset
          </button>
        </div>
      </div>
    </div>
  );
}

// Fill these in with your real Stripe Payment Link URLs (Stripe Dashboard → Payment Links — no backend
// required to create them). Until they're set, checkout runs in an explicit, clearly-labeled demo mode
// instead of silently granting Plus for free.
const STRIPE_PAYMENT_LINKS = {
  "plus-monthly": "https://buy.stripe.com/test_14A14g6G25Pv7kqdZtc3m00", // TEST MODE — swap for your live link before launch
  "plus-yearly": "https://buy.stripe.com/test_6oUaEQfcy7XDeMS08Dc3m01",  // TEST MODE — swap for your live link before launch
};

function CheckoutModal({ plan, onClose, onSuccess }) {
  const [state, setState] = useState("confirm"); // confirm | waiting | demo-confirm
  const p = PLANS.find((x) => x.key === plan);
  const stripeUrl = STRIPE_PAYMENT_LINKS[plan];
  const hasRealStripe = !!stripeUrl;

  const goToStripe = () => {
    window.open(stripeUrl, "_blank", "noopener,noreferrer");
    setState("waiting");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        {state === "confirm" && (
          <>
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-slate-900">Upgrade to {p.name}</div>
              <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="text-2xl font-display font-semibold mt-2">{p.price} <span className="text-sm text-slate-400 font-normal">{p.per}</span></div>

            {hasRealStripe ? (
              <>
                <p className="text-sm text-slate-500 mt-3">You'll be taken to Stripe's secure, hosted checkout in a new tab to enter payment details. StudyFlow never sees or stores your card information.</p>
                <button onClick={goToStripe} className="mt-5 w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-indigo-500 flex items-center justify-center gap-2">
                  <ShieldCheck size={15} /> Continue to Stripe Checkout
                </button>
              </>
            ) : (
              <>
                <div className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  Demo mode — no Stripe account is connected in this preview, so no real charge can happen here. In production this button opens a real Stripe Checkout page.
                </div>
                <button onClick={() => setState("demo-confirm")} className="mt-4 w-full border-2 border-dashed border-amber-300 text-amber-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-amber-50 flex items-center justify-center gap-2">
                  Simulate demo upgrade (no real charge)
                </button>
              </>
            )}
          </>
        )}

        {state === "waiting" && (
          <div className="py-4 text-center">
            <ShieldCheck className="mx-auto text-indigo-500 mb-3" size={28} />
            <div className="font-semibold text-slate-900">Complete your purchase on Stripe</div>
            <p className="text-sm text-slate-500 mt-2">Finish checking out in the tab that just opened. Once Stripe confirms your payment, come back here.</p>
            <button onClick={() => onSuccess(plan)} className="mt-5 w-full bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg">
              I've completed my purchase
            </button>
            <button onClick={onClose} className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
              In a full production build, this step is automated: a server verifies your payment via a Stripe webhook and activates Plus for you — no manual confirmation needed.
            </p>
          </div>
        )}

        {state === "demo-confirm" && (
          <div className="py-4 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-3" size={28} />
            <div className="font-semibold text-slate-900">This won't charge a real card</div>
            <p className="text-sm text-slate-500 mt-2">Since Stripe isn't connected here, this just simulates what Plus looks like — no payment is processed.</p>
            <button onClick={() => onSuccess(plan)} className="mt-5 w-full bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg">
              Continue in demo mode
            </button>
            <button onClick={() => setState("confirm")} className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600">Go back</button>
          </div>
        )}
      </div>
    </div>
  );
}
