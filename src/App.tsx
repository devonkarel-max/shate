import { useState, useEffect } from "react";
import { db, auth, googleProvider } from "./firebase";
import { doc, collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { User, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { AdvisorChat } from "./components/AdvisorChat";
import { CloudflareSetup } from "./components/CloudflareSetup";
import { 
  Sparkles, Clock, AlertCircle, ListTodo, Brain, Target, 
  Menu, Plus, Search, HelpCircle, Settings, LogIn, LogOut,
  MapPin, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types for structural safety
interface AgentState {
  nextWakeup: string;
  lastWoken: string;
  mainStrategy: string;
}

interface Goal {
  id: string;
  title: string;
  createdAt: string;
  suggestedBy?: string;
}

interface Task {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  createdAt: string;
}

interface Memory {
  id: string;
  summary: string;
  importance: number;
  tags: string[];
  timestamp: string;
}

export default function App() {
  const [activeView, setActiveView] = useState<string>("chat");
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(true);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Real-time states from Firestore
  const [agentState, setAgentState] = useState<AgentState>({
    nextWakeup: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    lastWoken: new Date().toISOString(),
    mainStrategy: "Zatím žádná aktivní strategie. Inicializujte mysl bota pro naplánování strategií.",
  });
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  
  const [loadingState, setLoadingState] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(undefined);

  // Sub to Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // 1. Real-time sub to agent settings/state
  useEffect(() => {
    const ref = doc(db, "settings", "agent_state");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setAgentState({
          nextWakeup: d.nextWakeup || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          lastWoken: d.lastWoken || new Date().toISOString(),
          mainStrategy: d.mainStrategy || "",
        });
      }
      setLoadingState(false);
    }, (error) => {
      console.warn("Could not read settings/agent_state doc, using fallback state:", error);
      setLoadingState(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time sub to strategic goals
  useEffect(() => {
    const q = query(
      collection(db, "goals"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded: Goal[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        loaded.push({
          id: docSnap.id,
          title: d.title || "",
          createdAt: d.createdAt || "",
          suggestedBy: d.suggestedBy,
        });
      });
      setGoals(loaded);
    }, (error) => {
      console.warn("Could not load goals collection, might be uninitialized yet:", error);
    });

    return () => unsubscribe();
  }, []);

  // 3. Real-time sub to tasks
  useEffect(() => {
    const q = query(
      collection(db, "tasks"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded: Task[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        loaded.push({
          id: docSnap.id,
          title: d.title || "",
          priority: d.priority || "medium",
          status: d.status || "pending",
          createdAt: d.createdAt || "",
        });
      });
      setTasks(loaded);
    }, (error) => {
      console.warn("Could not load tasks collection:", error);
    });

    return () => unsubscribe();
  }, []);

  // 4. Real-time sub to memory node logs
  useEffect(() => {
    const q = query(
      collection(db, "memories"),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded: Memory[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        loaded.push({
          id: docSnap.id,
          summary: d.summary || "",
          importance: typeof d.importance === "number" ? d.importance : 5,
          tags: d.tags || [],
          timestamp: d.timestamp || "",
        });
      });
      setMemories(loaded);
    }, (error) => {
      console.warn("Could not load memories collection:", error);
    });

    return () => unsubscribe();
  }, []);

  // Manual Trigger for Cognitive Reflection pulse
  const handleTriggerPulse = async () => {
    if (isTriggering) return;
    setIsTriggering(true);

    try {
      const response = await fetch("/api/agent/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Puls kognitvního cyklu selhal.");
      }

      const data = await response.json();
      if (data.strategy && data.strategy.mainStrategy) {
        setAgentState(data.strategy);
      }
    } catch (err) {
      console.error("Wake up autonomous cycle failed:", err);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleNewChat = () => {
    setSelectedTopic(undefined);
    setActiveView("chat");
    setResetTrigger(prev => prev + 1);
  };

  const toggleSidebar = () => {
    setSidebarExpanded(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-[#131314] font-sans text-zinc-100 flex overflow-hidden">
      
      {/* 1. LEFT SIDEBAR (Gemini Style) */}
      <aside 
        className={`bg-[#1e1f20] h-screen shrink-0 transition-all duration-300 flex flex-col justify-between py-5 px-3 border-r border-[#1e1f20] z-20 ${
          sidebarExpanded ? "w-72" : "w-[68px]"
        }`}
      >
        <div className="flex flex-col gap-6 overflow-hidden">
          
          {/* Logo Brand / Hamburger header */}
          <div className={`flex items-center ${sidebarExpanded ? "justify-between px-2" : "justify-center"}`}>
            {sidebarExpanded && (
              <div className="flex items-center gap-2.5">
                {/* 4-point Gemini star with matching color gradient */}
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
                  <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" fill="url(#geminiGradient)" />
                  <defs>
                    <linearGradient id="geminiGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#4285F4" />
                      <stop offset="0.3" stopColor="#9B51E0" />
                      <stop offset="0.6" stopColor="#E040FB" />
                      <stop offset="0.9" stopColor="#FF7043" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="text-[19px] font-medium font-sans text-white tracking-tight antialiased select-none">
                  Gemini
                </span>
                <span className="text-[10px] uppercase tracking-wide bg-[#2a2b2d] px-1.5 py-0.5 text-zinc-400 rounded">
                  Agent
                </span>
              </div>
            )}
            
            <button 
              onClick={toggleSidebar}
              className="p-2.5 rounded-full hover:bg-[#282a2d] text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
              title={sidebarExpanded ? "Sbalit menu" : "Rozbalit menu"}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* "+ Nový chat" pill */}
          <div className="px-1">
            <button
              onClick={handleNewChat}
              className={`flex items-center gap-3 rounded-full bg-[#131314] hover:bg-[#202124] transition duration-200 cursor-pointer shadow-sm ${
                sidebarExpanded 
                  ? "w-full py-3.5 px-5 font-normal text-sm text-[#80868b] hover:text-white border border-zinc-800/80" 
                  : "w-11 h-11 justify-center rounded-full border border-zinc-800/80"
              }`}
              title="Nový chat"
            >
              <Plus className="h-5 w-5 shrink-0 text-zinc-400" />
              {sidebarExpanded && <span className="font-normal tracking-wide">Nový chat</span>}
            </button>
          </div>

          {/* Navigation Links (Tools list integrated) */}
          <nav className="flex flex-col gap-1.5 px-1">
            
            {/* Active chat link */}
            <button
              onClick={() => setActiveView("chat")}
              className={`flex items-center gap-3.5 py-2.5 rounded-full transition-all duration-200 text-sm cursor-pointer ${
                activeView === "chat" 
                  ? "bg-[#2a2b2d] text-white font-medium pl-5 pr-4" 
                  : "text-zinc-400 hover:bg-[#282a2d] hover:text-white pl-4 pr-3"
              }`}
              title="Konverzace"
            >
              <Brain className={`h-5 w-5 shrink-0 ${activeView === "chat" ? "text-blue-400" : ""}`} />
              {sidebarExpanded && <span>Konzultovat s AI</span>}
            </button>

            {/* Strategic goals link */}
            <button
              onClick={() => setActiveView("goals")}
              className={`flex items-center gap-3.5 py-2.5 rounded-full transition-all duration-200 text-sm cursor-pointer ${
                activeView === "goals" 
                  ? "bg-[#2a2b2d] text-white font-medium pl-5 pr-4" 
                  : "text-zinc-400 hover:bg-[#282a2d] hover:text-white pl-4 pr-3"
              }`}
              title="Strategické cíle"
            >
              <Target className={`h-5 w-5 shrink-0 ${activeView === "goals" ? "text-indigo-400" : ""}`} />
              {sidebarExpanded && (
                <span className="flex items-center justify-between w-full">
                  <span>Strategické cíle</span>
                  {goals.length > 0 && (
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                      {goals.length}
                    </span>
                  )}
                </span>
              )}
            </button>

            {/* Tasks backlog link */}
            <button
              onClick={() => setActiveView("tasks")}
              className={`flex items-center gap-3.5 py-2.5 rounded-full transition-all duration-200 text-sm cursor-pointer ${
                activeView === "tasks" 
                  ? "bg-[#2a2b2d] text-white font-medium pl-5 pr-4" 
                  : "text-zinc-400 hover:bg-[#282a2d] hover:text-white pl-4 pr-3"
              }`}
              title="Backlog úkolů"
            >
              <ListTodo className={`h-5 w-5 shrink-0 ${activeView === "tasks" ? "text-emerald-400" : ""}`} />
              {sidebarExpanded && (
                <span className="flex items-center justify-between w-full">
                  <span>Backlog úkolů</span>
                  {tasks.filter(t => t.status === "pending").length > 0 && (
                    <span className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded-full font-bold">
                      {tasks.filter(t => t.status === "pending").length}
                    </span>
                  )}
                </span>
              )}
            </button>

            {/* Memories link */}
            <button
              onClick={() => setActiveView("memories")}
              className={`flex items-center gap-3.5 py-2.5 rounded-full transition-all duration-200 text-sm cursor-pointer ${
                activeView === "memories" 
                  ? "bg-[#2a2b2d] text-white font-medium pl-5 pr-4" 
                  : "text-zinc-400 hover:bg-[#282a2d] hover:text-white pl-4 pr-3"
              }`}
              title="Dlouhodobá paměť"
            >
              <Clock className={`h-5 w-5 shrink-0 ${activeView === "memories" ? "text-purple-400" : ""}`} />
              {sidebarExpanded && <span>Chronologie paměti</span>}
            </button>

            {/* Reflection / Agent pulse Operational Center link */}
            <button
              onClick={() => setActiveView("activity")}
              className={`flex items-center gap-3.5 py-2.5 rounded-full transition-all duration-200 text-sm cursor-pointer ${
                activeView === "activity" 
                  ? "bg-[#2a2b2d] text-white font-medium pl-5 pr-4" 
                  : "text-zinc-400 hover:bg-[#282a2d] hover:text-white pl-4 pr-3"
              }`}
              title="Kognitivní puls"
            >
              <RefreshCw className={`h-5 w-5 shrink-0 ${activeView === "activity" ? "text-pink-400" : ""}`} />
              {sidebarExpanded && (
                <span className="flex items-center justify-between w-full">
                  <span>Myšlení Agenta</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse border border-zinc-900 shrink-0" />
                </span>
              )}
            </button>

            {/* Deploy configuration instructions link */}
            <button
              onClick={() => setActiveView("cloudflare")}
              className={`flex items-center gap-3.5 py-2.5 rounded-full transition-all duration-200 text-sm cursor-pointer ${
                activeView === "cloudflare" 
                  ? "bg-[#2a2b2d] text-white font-medium pl-5 pr-4" 
                  : "text-zinc-400 hover:bg-[#282a2d] hover:text-white pl-4 pr-3"
              }`}
              title="Nasazení na Cloudflare"
            >
              <Settings className={`h-5 w-5 shrink-0 ${activeView === "cloudflare" ? "text-orange-400" : ""}`} />
              {sidebarExpanded && <span>Návod k Nasazení</span>}
            </button>
          </nav>

          {/* "Poslední" / "Recent" Section (Clicking targets custom context!) */}
          {sidebarExpanded && goals.length > 0 && (
            <div className="flex flex-col gap-2 mt-4 px-3 overflow-hidden select-none">
              <span className="text-xs font-semibold text-[#c4c7c5] uppercase tracking-wider block font-sans">
                Poslední Cíle bota
              </span>
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin scrollbar-thumb-[#202124] scrollbar-track-transparent">
                {goals.slice(0, 5).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedTopic(`Cíl: ${g.title}`);
                      setActiveView("chat");
                    }}
                    className="text-left py-2 px-3 hover:bg-[#282a2d] rounded-lg text-[13px] text-zinc-300 hover:text-white truncate transition-colors duration-150 flex items-center gap-2 w-full cursor-pointer"
                  >
                    <Target className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{g.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sidebarExpanded && memories.length > 0 && (
            <div className="flex flex-col gap-2 mt-2 px-3 overflow-hidden select-none">
              <span className="text-xs font-semibold text-[#c4c7c5] uppercase tracking-wider block font-sans">
                Ponaučení z paměti
              </span>
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin scrollbar-thumb-[#202124] scrollbar-track-transparent">
                {memories.slice(0, 5).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedTopic(`Vzpomínka: ${m.summary}`);
                      setActiveView("chat");
                    }}
                    className="text-left py-2 px-3 hover:bg-[#282a2d] rounded-lg text-[13px] text-[#c4c7c5] hover:text-white truncate transition-colors duration-150 flex items-center gap-2 w-full cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">{m.summary}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM SIDEBAR ZONE: User controls + location indication */}
        <div className="flex flex-col gap-4 overflow-hidden shrink-0">
          
          {/* User Section */}
          <div className="border-t border-zinc-800/60 pt-4 px-1 flex flex-col gap-2">
            {loadingUser ? (
              <div className="h-10 animate-pulse bg-zinc-800 rounded-full" />
            ) : user ? (
              <div className={`flex items-center justify-between rounded-full bg-[#131314] p-1 ${sidebarExpanded ? "pl-3.5 pr-2" : "justify-center"}`}>
                {sidebarExpanded && (
                  <div className="flex flex-col truncate pr-2 select-none">
                    <span className="text-sm font-semibold text-white truncate max-w-[130px]">
                      {user.displayName || "Host"}
                    </span>
                    <span className="text-[10px] text-[#80868b] truncate max-w-[130px]">
                      {user.email}
                    </span>
                  </div>
                )}
                
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                    alt="profil"
                    className="h-8 w-8 rounded-full border border-zinc-700 shrink-0 object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-xs font-bold text-white flex items-center justify-center shrink-0">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}

                {sidebarExpanded && (
                  <button 
                    onClick={handleSignOut}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-[#282a2d] rounded-full transition ml-1 cursor-pointer"
                    title="Odhlásit se"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className={`flex items-center gap-2.5 text-xs text-white p-3 rounded-full hover:bg-[#282a2d] transition duration-200 cursor-pointer ${
                  sidebarExpanded ? "bg-[#131314] hover:text-[#4285F4] border border-zinc-800 font-semibold shadow-sm justify-center" : "justify-center"
                }`}
                title="Přihlásit se přes Google"
              >
                <LogIn className="h-4.5 w-4.5 shrink-0" />
                {sidebarExpanded && <span>Přihlásit se</span>}
              </button>
            )}
          </div>

          {/* Location Area - Identical to screenshot */}
          {sidebarExpanded && (
            <div className="px-3 py-1.5 text-[11px] text-[#80868b] font-sans flex flex-col gap-0.5 leading-normal select-none">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <MapPin className="h-3.5 w-3.5 text-red-400" />
                <span>Naaldwijk, Nizozemsko</span>
              </div>
              <span className="text-[10px] text-[#80868b] leading-relaxed pl-5">
                Z vaší IP adresy • <button className="underline hover:text-zinc-300 transition cursor-pointer">Aktualizovat polohu</button>
              </span>
            </div>
          )}

        </div>
      </aside>

      {/* 2. MAIN CONTAINER PANEL (RIGHT SIDE) */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#131314]">
        
        {/* TOP TRANSPARENT BAR containing Mode & Upgradovat */}
        <header className="h-[72px] shrink-0 flex items-center justify-between px-6 z-10 border-b border-zinc-900">
          
          {/* Logo element if sidebar is collapsed */}
          <div className="flex items-center gap-2">
            {!sidebarExpanded && (
              <div className="flex items-center gap-2 ml-1 select-none">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                  <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" fill="url(#headerGeminiGradient)" />
                  <defs>
                    <linearGradient id="headerGeminiGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#4285F4" />
                      <stop offset="0.3" stopColor="#9B51E0" />
                      <stop offset="0.6" stopColor="#E040FB" />
                      <stop offset="0.9" stopColor="#FF7043" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="text-[16px] font-medium tracking-tight text-white antialiased">
                  Gemini
                </span>
              </div>
            )}
            
            {/* Active Subview Title Indicator */}
            <div className="text-xs justify-start select-none py-1 px-3 bg-[#1e1f20] hover:bg-zinc-800/80 rounded-full text-zinc-300 border border-zinc-800 font-sans hidden sm:inline-flex items-center gap-1.5">
              <span>Model:</span>
              <span className="text-zinc-100 font-bold">1.5 Flash</span>
              <span className="text-[#80868b]">▼</span>
            </div>
          </div>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-3.5">
            
            {/* Upgrade button exact duplicate of "Upgradovat" pill in screenshot */}
            <button
              onClick={() => alert("Tato testovací ukázka má již nejvyšší možný model Google Gemini k dispozici zdarma!")}
              className="group rounded-full bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-sans text-[13px] font-semibold py-2.5 px-6 shadow-md transition duration-250 cursor-pointer flex items-center justify-center gap-2 select-none border border-zinc-800"
            >
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse shrink-0" />
              <span>Upgradovat</span>
            </button>

          </div>
        </header>

        {/* CONTAINER WORKSPACE ROUTER */}
        <section className="flex-1 w-full overflow-hidden relative">
          <AnimatePresence mode="wait">
            
            {/* VIEW A: Active chat */}
            {activeView === "chat" && (
              <motion.div
                key="view-chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-full h-full"
              >
                <AdvisorChat 
                  selectedTopic={selectedTopic} 
                  setSelectedTopic={setSelectedTopic}
                  resetTrigger={resetTrigger} 
                />
              </motion.div>
            )}

            {/* VIEW B: Strategic Goals List */}
            {activeView === "goals" && (
              <motion.div
                key="view-goals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full overflow-y-auto px-6 py-6 scrollbar-thin"
              >
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                  
                  {/* Strategic objective headers */}
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white font-sans flex items-center gap-2.5">
                      <Target className="h-6 w-6 text-indigo-400" />
                      Strategické Cíle Mojeho Agenta
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed leading-normal">
                      Cíle vytyčené na základě dlouhodobých priorit a kognitivní sebereflexe systému. Kliknutím na cíl zahájíte diskuzi v jeho kontextu.
                    </p>
                  </div>

                  {goals.length === 0 ? (
                    <div className="text-center py-16 px-6 bg-[#1e1f20] rounded-2xl border border-zinc-800 text-zinc-500 text-sm">
                      Zatím nebyly sestaveny žádné strategické cíle. Spusťte mysl agenta k jejich automatickému složení.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {goals.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            setSelectedTopic(`Cíl: ${g.title}`);
                            setActiveView("chat");
                          }}
                          className="p-5 rounded-2xl bg-[#1e1f20] hover:bg-[#2a2b2d] border border-zinc-800/20 hover:border-indigo-500/30 cursor-pointer shadow-sm transition duration-200 group flex items-start gap-4"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-550/10 text-indigo-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <Target className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                              {g.title}
                            </h4>
                            <p className="text-xs text-zinc-400 mt-1 font-mono leading-relaxed">
                              Vytvořeno: {new Date(g.createdAt).toLocaleDateString("cs-CZ")} • Suggested: {g.suggestedBy || "System"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* VIEW C: Backlog tasks scheduler */}
            {activeView === "tasks" && (
              <motion.div
                key="view-tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full overflow-y-auto px-6 py-6 scrollbar-thin"
              >
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                  
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white font-sans flex items-center gap-2.5">
                      <ListTodo className="h-6 w-6 text-emerald-400" />
                      Backlog Plánovaných Úkolů
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed leading-normal">
                      Sada dílčích akčních kroků, které agent naplánoval pro vyřízení strategických cílů.
                    </p>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="text-center py-16 px-6 bg-[#1e1f20] rounded-2xl border border-zinc-800 text-zinc-500 text-sm">
                      V backlogu nejsou prozatím naplánovány žádné úkoly.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-[#1e1f20] border border-zinc-805/30 text-zinc-200"
                        >
                          <div className="flex items-center gap-3.5 truncate">
                            <CheckCircle2 className={`h-5 w-5 shrink-0 ${t.status === "completed" ? "text-emerald-500" : "text-zinc-600"}`} />
                            <span className={`text-[14px] font-normal truncate ${t.status === "completed" ? "line-through text-zinc-500" : "text-zinc-200"}`}>
                              {t.title}
                            </span>
                          </div>
                          
                          <span className={`text-[10px] font-semibold tracking-wide font-mono px-2.5 py-1 rounded-full uppercase shrink-0 ${
                            t.priority === "high" 
                              ? "bg-red-500/15 text-red-400 border border-red-500/20" 
                              : t.priority === "medium"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                          }`}>
                            {t.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* VIEW D: Chronological memory feeds */}
            {activeView === "memories" && (
              <motion.div
                key="view-memories"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full overflow-y-auto px-6 py-6 scrollbar-thin"
              >
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                  
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white font-sans flex items-center gap-2.5">
                      <Brain className="h-6 w-6 text-[#9B51E0]" />
                      Dlouhodobé Poznávání a Paměť
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed leading-normal">
                      Zaznamenané reflexe a ponaučení pocházející z kognitivních procesů robota, které používá jako celkový kontext pro strategické rozhodování.
                    </p>
                  </div>

                  {memories.length === 0 ? (
                    <div className="text-center py-16 px-6 bg-[#1e1f20] rounded-2xl border border-zinc-800 text-zinc-500 text-sm">
                      Zatím nejsou v mezipaměti uloženy žádné vzpomínky ani poznatky.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5">
                      {memories.map((m) => (
                        <div
                          key={m.id}
                          className="p-5 rounded-2xl bg-[#1e1f20] border border-zinc-800/10 hover:border-zinc-700/40 transition duration-150 leading-relaxed text-zinc-300"
                        >
                          <p className="text-[14px] font-normal leading-relaxed text-zinc-200">
                            {m.summary}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-3.5 border-t border-zinc-800/50 pt-3 text-[10px] font-semibold font-mono text-[#80868b]">
                            <span>Důležitost ponaučení: {m.importance}/10</span>
                            <div className="flex gap-1">
                              {m.tags.map((t, idx) => (
                                <span key={idx} className="bg-zinc-800/60 px-2 py-0.5 rounded text-zinc-400">#{t}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* VIEW E: Operational Center & Autonomous Cycle Settings */}
            {activeView === "activity" && (
              <motion.div
                key="view-activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full overflow-y-auto px-6 py-6 scrollbar-thin"
              >
                <div className="max-w-4xl mx-auto flex flex-col gap-6 select-none">
                  
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white font-sans flex items-center gap-2.5">
                      <RefreshCw className="h-6 w-6 text-pink-400" />
                      Řídící Kognitivní Centrum bota
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed leading-normal">
                      Tato jednotka řídí autonomní plánovací cyklus, analyzuje v reálném čase úkoly a promítá své závěry do databáze Google Firestore.
                    </p>
                  </div>

                  {/* Operational parameters & Pulse Trigger */}
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    {/* Column 1: Live Status Info */}
                    <div className="rounded-2xl border border-zinc-800/65 bg-[#1e1f20] p-6 flex flex-col gap-6 justify-between shadow-sm">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#80868b] font-mono">Běžný status</span>
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Aktivní
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-zinc-500 font-mono block">Poslední uvažování</span>
                            <span className="font-semibold text-white mt-1 block">
                              {new Date(agentState.lastWoken).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-mono block">Příští automatický krok</span>
                            <span className="font-semibold text-indigo-400 mt-1 block">
                              {new Date(agentState.nextWakeup).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Manual trigger pulse button */}
                      <button
                        id="btn-trigger-pulse-view"
                        onClick={handleTriggerPulse}
                        disabled={isTriggering}
                        className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-800 border border-transparent font-semibold shadow-md active:scale-98 text-sm py-4 px-4 transition cursor-pointer text-white"
                      >
                        <RefreshCw className={`h-4.5 w-4.5 ${isTriggering ? "animate-spin" : ""}`} />
                        {isTriggering ? "Agent uvažuje a ukládá do databáze..." : "Iniciovat Mysl Agenta (Kognitivní puls)"}
                      </button>
                    </div>

                    {/* Column 2: Strategy thought container */}
                    <div className="rounded-2xl border border-zinc-800/65 bg-[#1e1f20] p-6 flex flex-col gap-4 shadow-sm justify-between">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#80868b] font-mono flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-indigo-400" />
                          Hlavní Myšlenkový Směr
                        </span>
                        <p className="text-sm text-zinc-100 mt-2 font-medium leading-relaxed leading-normal">
                          {agentState.mainStrategy || "Běh dokončen, analýza v pořádku."}
                        </p>
                      </div>

                      <div className="bg-[#131314] rounded-xl p-3.5 border border-zinc-800/30 text-[11px] text-[#80868b] leading-normal font-sans">
                        Když iniciujete mysl agenta, na pozadí dojde k analýze cílů a sestavení nových vzpomínek prostřednictvím modelu Google Gemini.
                      </div>
                    </div>

                  </div>

                </div>
              </motion.div>
            )}

            {/* VIEW F: Cloudflare setup instruction panel */}
            {activeView === "cloudflare" && (
              <motion.div
                key="view-cloudflare"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-full h-full overflow-y-auto px-6 py-6 scrollbar-thin"
              >
                <div className="max-w-6xl mx-auto">
                  <CloudflareSetup />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </section>

      </main>

    </div>
  );
}
