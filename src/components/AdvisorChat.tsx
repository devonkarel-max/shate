import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { UserMessage } from "../types";
import { Send, Bot, User, AlertTriangle, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Markdown from "react-markdown";

interface AdvisorChatProps {
  selectedTopic: string | undefined;
}

// Security error-handling infrastructure as mandated by rules
enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
}

const PRESETS = [
  "Jaké jsou tvé současné strategické cíle a jak jich hodláš dosáhnout?",
  "Napiš mi jednoduchý Python skript pro stažení a analýzu dat z libovolného webu.",
  "Jak si mohu vybudovat ucelenou znalostní bázi a automatizovat běžnou denní rutinu?",
  "Pomoz mi naplánovat nový projekt a rozdělit ho na jednotlivé podúkoly."
];

export function AdvisorChat({ selectedTopic }: AdvisorChatProps) {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<UserMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ahoj! Jsem tvůj chytrý autonomní AI Agent postavený na modelu Google Gemini. Můžeš se mě zeptat na cokoliv – od strategického plánování po pomoc s programováním, psaním textů či analýzou úkolů.",
      createdAt: new Date().toISOString(),
      ownerId: "system"
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Monitor user state
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubAuth();
  }, []);

  // Sync real-time Firestore database for logged-in tenants
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const path = "user_messages";
    try {
      // Secure "Query Enforcer" - must match the exact security rule filter 'ownerId == uid'
      const q = query(
        collection(db, path),
        where("ownerId", "==", user.uid),
        orderBy("createdAt", "asc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loaded: UserMessage[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          loaded.push({
            id: doc.id,
            role: d.role,
            content: d.content,
            createdAt: d.createdAt,
            ownerId: d.ownerId,
          });
        });
        setMessages(loaded);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, localMessages]);

  const activeMessages = user ? messages : localMessages;

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;
    setIsSending(true);
    setInputText("");

    const timestamp = new Date().toISOString();
    const cleanText = selectedTopic 
      ? `[Kontext: ${selectedTopic}] ${textToSend}`
      : textToSend;

    try {
      // 1. Save user message
      if (user) {
        const path = "user_messages";
        try {
          await addDoc(collection(db, path), {
            role: "user",
            content: cleanText,
            createdAt: timestamp,
            ownerId: user.uid,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setLocalMessages(prev => [
          ...prev,
          {
            id: `usr_${Date.now()}`,
            role: "user",
            content: cleanText,
            createdAt: timestamp,
            ownerId: "local"
          }
        ]);
      }

      // 2. Fetch from Gemini endpoint
      const bodyMessages = user 
        ? [...messages, { role: "user", content: cleanText }]
        : [...localMessages, { role: "user", content: cleanText }];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: bodyMessages }),
      });

      if (!response.ok) {
        throw new Error("Tento server neodpověděl včas.");
      }

      const responseData = await response.json();
      const aiContent = responseData.content;

      // 3. Save assistant response
      if (user) {
        const path = "user_messages";
        try {
          await addDoc(collection(db, path), {
            role: "assistant",
            content: aiContent,
            createdAt: new Date().toISOString(),
            ownerId: user.uid,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setLocalMessages(prev => [
          ...prev,
          {
            id: `ai_${Date.now()}`,
            role: "assistant",
            content: aiContent,
            createdAt: new Date().toISOString(),
            ownerId: "local"
          }
        ]);
      }

    } catch (error) {
      console.error(error);
      const errAlert = "Chyba: Nepodařilo se dokončit analýzu s AI.";
      if (!user) {
        setLocalMessages(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: errAlert,
            createdAt: new Date().toISOString(),
            ownerId: "local"
          }
        ]);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    sendMessage(preset);
  };

  const currentTopicDisplay = selectedTopic || "Obecná konverzace a strategie";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-850 p-6 flex flex-col gap-5 h-[620px] select-none shadow-xl">
      
      {/* 1. Chat Header */}
      <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-white">Chytrý AI Agent</h2>
          <span className="text-[10px] font-mono text-zinc-500">Kontext: {currentTopicDisplay}</span>
        </div>
        {user ? (
          <div className="flex items-center gap-1.5 rounded-full bg-indigo-600/10 border border-indigo-600/20 px-2.5 py-1 text-[10px] text-indigo-400 font-bold font-mono">
            <ShieldCheck className="h-3.5 w-3.5" /> Uloženo v Cloudu
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] text-amber-500 font-bold font-mono">
            <AlertTriangle className="h-3.5 w-3.5" /> Demo režim
          </div>
        )}
      </div>

      {/* 2. Messages area */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
        {activeMessages.map((msg, index) => {
          const isBot = msg.role === "assistant";
          return (
            <div
              key={msg.id || index}
              className={`flex gap-3 max-w-[85%] ${isBot ? "self-start" : "self-end flex-row-reverse"}`}
            >
              <div className={`h-8 w-8 rounded flex items-center justify-center border shrink-0 ${
                isBot 
                  ? "bg-indigo-600/10 border-indigo-600/30 text-indigo-400" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-300"
              }`}>
                {isBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`rounded-xl p-4 text-xs leading-relaxed border ${
                isBot 
                  ? "bg-zinc-900 border-zinc-800 text-zinc-300" 
                  : "bg-indigo-600 text-white border-indigo-600/40"
              }`}>
                <div className="markdown-body prose prose-invert prose-xs leading-relaxed max-w-none
                  [&>p]:mb-2 [&>p:last-child]:mb-0
                  [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2
                  [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2
                  [&>strong]:text-white [&>strong]:font-bold
                  [&>code]:font-mono [&>code]:text-[10px] [&>code]:bg-zinc-950 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-indigo-300
                  [&>pre]:bg-zinc-950 [&>pre]:p-3 [&>pre]:rounded-lg [&>pre]:border [&>pre]:border-zinc-800 [&>pre]:my-2 [&>pre_code]:text-zinc-200 [&>pre_code]:text-[11px]
                ">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          );
        })}
        {isSending && (
          <div className="flex gap-3 self-start max-w-[85%]">
            <div className="h-8 w-8 rounded flex items-center justify-center border bg-indigo-600/10 border-indigo-600/30 text-indigo-400 shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-xl p-4 text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              Gemini formuluje odpověď...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 3. Suggestions */}
      {activeMessages.length <= 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">Vyberte téma dotazu:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESETS.map((p, idx) => (
              <button
                onClick={() => handlePresetClick(p)}
                key={idx}
                className="text-left text-[11px] p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(inputText);
        }}
        className="flex items-center gap-2 border-t border-zinc-800 pt-4"
      >
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Napište zprávu pro AI Agenta..."
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border border-transparent hover:scale-105 active:scale-95 text-white p-3 transition cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

    </div>
  );
}
