import { canUseIA } from "@/lib/roles";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Navigation2,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type AssistantAction = {
  tipo: "navegar";
  etiqueta: string;
  ruta: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: string | null;
  warning?: string | null;
  complete?: boolean;
  finishReason?: string | null;
  tokenUsage?: TokenUsage | null;
  action?: AssistantAction | null;
};

const PAGE_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/add": "Agregar",
  "/add-product": "Agregar",
  "/products": "Productos",
  "/tracking": "Trackeo",
  "/reportes": "Reportes",
  "/finanzas": "Finanzas",
  "/catalogo": "Catálogo",
  "/racknova-ia": "RackNova IA",
  "/usuarios": "Usuarios",
  "/rackview": "Vista del rack",
};

const QUICK_QUESTIONS = [
  "¿Cómo agrego un producto?",
  "¿Dónde registro una salida?",
  "¿Qué productos tienen stock bajo?",
  "¿Qué productos están próximos a caducar?",
  "Dame un resumen de mi inventario.",
];

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hola, soy RackNova IA. Puedo guiarte dentro de la plataforma y consultar inventario, ventas, caducidades y ubicaciones.",
  source: "racknova",
  complete: true,
};

function pageName(pathname: string) {
  return PAGE_NAMES[pathname] ?? "Página de RackNova";
}

function sourceLabel(source?: string | null) {
  if (source === "deepseek") return "RackNova IA";
  if (source === "racknova_directo") return "Datos de RackNova";
  if (source === "motor_interno_fallback") return "Motor interno";
  if (source === "racknova") return "RackNova";
  if (source === "error") return "Error";
  return source ?? "RackNova";
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.setAttribute("readonly", "true");
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function RackNovaIAAssistant() {
  const allowed = canUseIA();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    INITIAL_MESSAGE,
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const currentPage = useMemo(
    () => pageName(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [messages, loading, isOpen]);

  if (!allowed) return null;

  const askIA = async (customQuestion?: string) => {
  const preguntaFinal = (customQuestion ?? question).trim();

  if (!preguntaFinal || loading) return;

  /*
   * Toma los últimos 3 mensajes anteriores.
   *
   * No incluye:
   * - El saludo inicial de RackNova IA.
   * - Mensajes de error.
   * - La pregunta nueva que todavía no se ha enviado.
   */
  const historial = messages
    .filter(
      (message, index) =>
        index !== 0 &&
        message.source !== "error" &&
        message.content.trim() !== ""
    )
    .slice(-3)
    .map((message) => ({
      rol:
        message.role === "user"
          ? "usuario"
          : "asistente",
      contenido: message.content.trim(),
    }));

  // Después de obtener el historial, mostramos la nueva pregunta.
  setMessages((previous) => [
    ...previous,
    {
      role: "user",
      content: preguntaFinal,
    },
  ]);

  setQuestion("");
  setLoading(true);

  try {
    const response = await apiFetch("/ia/inventario", {
      method: "POST",
      body: JSON.stringify({
        pregunta: preguntaFinal,
        ruta_actual: location.pathname,
        pagina_actual: currentPage,

        // Nuevo campo enviado a FastAPI.
        historial,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          "No se pudo obtener respuesta de RackNova IA."
      );
    }

    const assistantMessage: Message = {
      role: "assistant",
      content:
        data?.respuesta ||
        "RackNova IA no generó una respuesta.",
      source:
        data?.fuente ??
        data?.modelo ??
        "racknova",
      warning: data?.advertencia ?? null,
      complete:
        typeof data?.completa === "boolean"
          ? data.completa
          : true,
      finishReason: data?.finish_reason ?? null,
      tokenUsage: data?.uso_tokens ?? null,
      action:
        data?.accion?.tipo === "navegar"
          ? data.accion
          : null,
    };

    setMessages((previous) => [
      ...previous,
      assistantMessage,
    ]);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Ocurrió un error conectando con RackNova IA.";

    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: message,
        source: "error",
        warning:
          "No se pudo completar la consulta.",
        complete: false,
        finishReason: "error",
      },
    ]);
  } finally {
    setLoading(false);
  }
};

     

  const handleCopy = async (content: string, index: number) => {
    try {
      await copyToClipboard(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch (error) {
      console.error("No se pudo copiar el mensaje:", error);
    }
  };

  const runAction = (action: AssistantAction) => {
    navigate(action.ruta);
    setIsOpen(false);
  };

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setCopiedIndex(null);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void askIA();
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 shadow-2xl transition-transform hover:scale-105"
          title="Abrir RackNova IA"
          aria-label="Abrir RackNova IA"
        >
          <Bot className="h-7 w-7" />
        </Button>
      )}

      {isOpen && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div
            className="pointer-events-auto absolute inset-0 bg-black/20"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <aside className="pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l bg-background shadow-2xl">
            <header className="border-b bg-gradient-to-r from-blue-700 to-cyan-600 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black leading-tight">
                      RackNova IA
                    </h2>
                    <p className="text-xs text-white/80">
                      Página actual: {currentPage}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/15 hover:text-white"
                  aria-label="Cerrar RackNova IA"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <div className="border-b p-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {QUICK_QUESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={loading}
                    onClick={() => void askIA(item)}
                    className="shrink-0 rounded-full border bg-muted/50 px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  const totalTokens =
                    message.tokenUsage?.total_tokens ?? 0;
                  const copied = copiedIndex === index;

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : "border bg-muted/60"
                        }`}
                      >
                        {!isUser && (
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <Bot className="h-4 w-4" />
                              RackNova IA
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopy(
                                  message.content,
                                  index
                                )
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                              aria-label="Copiar respuesta"
                            >
                              {copied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}

                        {message.warning && (
                          <div className="mb-3 flex gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{message.warning}</span>
                          </div>
                        )}

                        <div className="whitespace-pre-wrap break-words leading-6">
                          {message.content}
                        </div>

                        {!isUser && message.action && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              runAction(message.action!)
                            }
                            className="mt-3 w-full justify-center gap-2"
                          >
                            <Navigation2 className="h-4 w-4" />
                            {message.action.etiqueta}
                          </Button>
                        )}

                        {!isUser && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                            <span className="rounded-full border bg-background/70 px-2 py-0.5">
                              {sourceLabel(message.source)}
                            </span>
                            {totalTokens > 0 && (
                              <span className="rounded-full border bg-background/70 px-2 py-0.5">
                                {totalTokens.toLocaleString("es-MX")} tokens
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Consultando RackNova…
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>

            <footer className="border-t bg-background p-4">
              <div className="rounded-xl border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring">
                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  rows={3}
                  placeholder="Pregunta sobre RackNova o tu inventario…"
                  className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
                />

                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Sin memoria: solo usa esta pregunta.
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={!question.trim() || loading}
                    onClick={() => void askIA()}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </Button>
                </div>
              </div>

              <button
                type="button"
                onClick={clearChat}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                <Trash2 className="h-3 w-3" />
                Limpiar chat
              </button>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
