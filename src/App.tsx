import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { Header } from "./components/Header";
import { AdvisorChat } from "./components/AdvisorChat";
import { CloudflareSetup } from "./components/CloudflareSetup";
import { Sparkles, Clock, AlertCircle, ListTodo, Brain, Target, Zap, CheckCircle2, RefreshCw } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<string>("chat");
  
  // Real-time states
  const [agentState, setAgentState] = useState<AgentState>({
    nextWakeup: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    lastWoken: new Date().toISOString(),
    mainStrategy: "Zatím žádná aktivní strategie. Klikněte na tlačítko níže pro inicializaci bota.",
  });
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  
  const [loadingState, setLoadingState] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(undefined);

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
      limit(10)
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
      limit(15)
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
      limit(10)
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

  // Manual Trigger for Cognitive Reflection cycle
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

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-white">
      
      {/* Universal Navigation Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        
        <AnimatePresence mode="wait">
          {activeTab === "chat" && (
            <motion.div
              key="chat-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="grid gap-8 lg:grid-cols-12 items-start"
            >
              
              {/* Left Column (Col 4): Live Mind of Autonomous Agent */}
              <section className="lg:col-span-5 flex flex-col gap-6">
                
                {/* 1. Real-time Status Card & Manual Action Button */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-6 shadow-sm">
                  
                  {/* Title Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">Stav Mojeho Agenta</h2>
                        <span className="text-[10px] text-zinc-500 font-mono font-medium">Běží na pozadí</span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Aktivní
                    </span>
                  </div>

                  {/* Active Strategy summary block */}
                  <div className="bg-zinc-955 rounded-xl border border-zinc-800/60 p-4">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-indigo-400" /> Hlavní myšlenkový směr
                    </span>
                    <p className="text-xs text-zinc-200 mt-2 font-medium leading-relaxed">
                      {agentState.mainStrategy || "Probuzení bota zahájí analýzu a naplánuje první strategie!"}
                    </p>
                  </div>

                  {/* Operational stats */}
                  <div className="grid grid-cols-2 gap-4 border-t border-zinc-805/85 pt-4 text-xs">
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

                  {/* Action trigger button */}
                  <button
                    id="btn-trigger-pulse"
                    onClick={handleTriggerPulse}
                    disabled={isTriggering}
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 disabled:bg-zinc-850 disabled:text-zinc-650 disabled:border-zinc-800 border border-transparent font-semibold shadow-md active:scale-98 text-xs py-3.5 px-4 transition cursor-pointer text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ${isTriggering ? "animate-spin" : ""}`} />
                    {isTriggering ? "Agent reflektuje stávající stav..." : "Iniciovat Mysl Agenta"}
                  </button>

                </div>

                {/* 2. Real-time Strategic Goals */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col gap-4 shadow-inner">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-2 px-1">
                    <Target className="h-4 w-4 text-indigo-400" /> Osvojené Cíle ({goals.length})
                  </h3>
                  {goals.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-zinc-900 rounded-xl border border-dashed border-zinc-800 text-zinc-600 text-xs">
                      Zatím nebyly vytyčeny žádné cíle.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {goals.map((g) => (
                        <div 
                          key={g.id}
                          onClick={() => setSelectedTopic(`Cíl: ${g.title}`)}
                          className="p-3 bg-zinc-900 hover:bg-zinc-850 hover:border-indigo-650/40 rounded-xl border border-zinc-800/80 transition cursor-pointer text-xs flex items-start gap-2 text-zinc-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                          <span className="leading-relaxed flex-1">{g.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Real-time Task backlogs */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col gap-4 shadow-inner">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-2 px-1">
                    <ListTodo className="h-4 w-4 text-emerald-400" /> Backlog Plánovaných Úkolů ({tasks.filter(t => t.status === "pending").length})
                  </h3>
                  {tasks.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-zinc-900 rounded-xl border border-dashed border-zinc-800 text-zinc-600 text-xs">
                      Žádné naplánované úkoly v databázi.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                      {tasks.map((t) => (
                        <div 
                          key={t.id}
                          className="p-3 bg-zinc-900 rounded-xl border border-zinc-800/80 text-xs flex items-center justify-between gap-3 text-zinc-300 hover:border-zinc-700 transition"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${t.status === "completed" ? "text-emerald-500" : "text-zinc-650"}`} />
                            <span className={`truncate ${t.status === "completed" ? "line-through text-zinc-600" : ""}`}>{t.title}</span>
                          </div>
                          <span className={`text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded ${
                            t.priority === "high" 
                              ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                              : t.priority === "medium"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                          }`}>
                            {t.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Real-time Memory logs */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col gap-4 shadow-inner">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-2 px-1">
                    <Brain className="h-4 w-4 text-indigo-400" /> Dlouhodobé Ponaučení & Paměť ({memories.length})
                  </h3>
                  {memories.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-zinc-900 rounded-xl border border-dashed border-zinc-800 text-zinc-600 text-xs">
                      Paměť je v tuto chvíli čistá. Spusťte cyklus pro zápis vzpomínek.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 max-h-[250px] overflow-y-auto pr-1">
                      {memories.map((m) => (
                        <div 
                          key={m.id}
                          onClick={() => setSelectedTopic(`Vzpomínka: ${m.summary}`)}
                          className="p-3 bg-zinc-900/90 hover:bg-zinc-850 hover:border-indigo-650/30 rounded-xl border border-zinc-800 text-[11px] leading-relaxed text-zinc-400 transition cursor-pointer"
                        >
                          <p className="text-zinc-300 font-medium">{m.summary}</p>
                          <div className="flex items-center justify-between gap-1 mt-2 border-t border-zinc-800/50 pt-1.5 text-[9px] font-semibold font-mono text-zinc-500">
                            <span>Imp: {m.importance}/10</span>
                            <div className="flex gap-1">
                              {m.tags.slice(0, 2).map((t, idx) => (
                                <span key={idx} className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">#{t}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </section>

              {/* Right Column (Col 8): Elegant full height strategic chat wrapper */}
              <section className="lg:col-span-7 flex flex-col h-full">
                <AdvisorChat selectedTopic={selectedTopic} />
                
                {selectedTopic && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-600/5 border border-indigo-605/20 mt-4 text-xs text-indigo-400">
                    <span className="font-medium">
                      Aktivní vyhledávání v kontextu: <strong>{selectedTopic}</strong>
                    </span>
                    <button 
                      onClick={() => setSelectedTopic(undefined)}
                      className="text-white hover:text-red-400 font-bold font-mono transition text-[10px] uppercase tracking-wider whitespace-nowrap cursor-pointer"
                    >
                      [Vymazat kontext]
                    </button>
                  </div>
                )}
              </section>

            </motion.div>
          )}

          {activeTab === "cloudflare" && (
            <motion.div
              key="cloudflare-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
            >
              {/* Deploy instruction panels */}
              <CloudflareSetup />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Elegant Aesthetic Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-900/40 py-6 px-6 mt-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500 font-mono flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
            Tento chytrý AI Agent ukládá své myšlenkové procesy v reálném čase do Google Firestore.
          </div>
          <p className="text-xs text-zinc-650 font-mono">
            Chytrý AI Agent Client • © 2026. Běží na Google AI Studio.
          </p>
        </div>
      </footer>

    </div>
  );
}
