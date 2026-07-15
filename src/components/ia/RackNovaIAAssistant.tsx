import { canUseIA } from "@/lib/roles";
import React, { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Send,
  X,
  Sparkles,
  Loader2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: string | null;
  warning?: string | null;
};

const quickQuestions = [
  "¿Qué productos me recomiendas vender con descuento y por qué?",
  "¿Qué productos están próximos a caducar?",
  "¿Qué productos tienen baja rotación?",
  "¿Qué productos me conviene mover de ubicación?",
  "¿Qué productos son más rentables?",
];

export function RackNovaIAAssistant() {
  if (!canUseIA()) {
  return null;
}
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola, soy RACKNOVA IA. Puedo ayudarte a analizar inventario, caducidad, descuentos, rotación, rentabilidad y ubicación de productos dentro del rack.",
      source: "racknova",
    },
  ]);

  const askIA = async (customQuestion?: string) => {
    const preguntaFinal = (customQuestion ?? question).trim();

    if (!preguntaFinal || loading) return;

    const userMessage: Message = {
      role: "user",
      content: preguntaFinal,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await apiFetch("/ia/inventario", {
  method: "POST",
  body: JSON.stringify({
    pregunta: preguntaFinal,
  }),
});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "No se pudo obtener respuesta de RACKNOVA IA."
        );
      }

      const assistantMessage: Message = {
        role: "assistant",
        content:
          data?.respuesta ||
          "RACKNOVA IA no generó una respuesta. Intenta con otra pregunta.",
        source: data?.fuente ?? data?.modelo ?? "racknova",
        warning: data?.advertencia ?? null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error?.message ||
            "Ocurrió un error conectando con RACKNOVA IA. Revisa el backend.",
          source: "error",
          warning: "No se pudo completar la consulta.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Chat reiniciado. Pregúntame sobre inventario, descuentos, caducidad, ubicación, ventas o rentabilidad.",
        source: "racknova",
      },
    ]);
  };

  return (
    <>
      {!isOpen && (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-blue-600 to-cyan-500 hover:scale-105 transition-transform"
          title="Abrir RACKNOVA IA"
        >
          <Bot className="h-7 w-7" />
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl pointer-events-auto flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-blue-700 to-cyan-600 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center">
                      <Sparkles className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="font-black text-lg leading-tight">
                        RACKNOVA IA
                      </h2>
                      <p className="text-xs text-white/80">
                        Asistente inteligente de inventario
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-3 border-b bg-muted/40">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Preguntas rápidas
              </p>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => askIA(item)}
                    disabled={loading}
                    className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3 text-sm shadow-sm ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border"
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground">
                          <Bot className="h-4 w-4" />
                          RACKNOVA IA
                        </div>
                      )}

                      {message.warning && (
                        <div className="mb-2 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900 flex gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{message.warning}</span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>

                      {!isUser && message.source && (
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          Fuente:{" "}
                          {message.source === "deepseek"
                            ? "IA externa"
                            : message.source === "motor_interno_fallback"
                            ? "Motor interno RackNova"
                            : message.source}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl p-3 text-sm shadow-sm bg-muted border">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analizando inventario...
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-3 bg-background">
              <div className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      askIA();
                    }
                  }}
                  placeholder="Pregúntale a RACKNOVA IA..."
                  className="min-h-[44px] max-h-32 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />

                <Button
                  type="button"
                  size="icon"
                  onClick={() => askIA()}
                  disabled={loading || !question.trim()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  Enter para enviar, Shift + Enter para salto de línea.
                </div>

                <button
                  type="button"
                  onClick={clearChat}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  Limpiar chat
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
