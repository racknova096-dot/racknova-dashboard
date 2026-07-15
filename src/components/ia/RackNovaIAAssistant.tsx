import { canUseIA } from "@/lib/roles";
import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: string | null;
  warning?: string | null;
  complete?: boolean;
  continuations?: number;
  finishReason?: string | null;
  tokenUsage?: TokenUsage | null;
};

const quickQuestions = [
  "¿Qué productos me recomiendas vender con descuento y por qué?",
  "¿Qué productos están próximos a caducar?",
  "¿Qué productos tienen baja rotación?",
  "¿Qué productos me conviene mover de ubicación?",
  "¿Qué productos son más rentables?",
];

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hola, soy RACKNOVA IA. Puedo ayudarte a analizar inventario, caducidad, descuentos, rotación, rentabilidad y ubicación de productos dentro del rack.",
  source: "racknova",
  complete: true,
  continuations: 0,
};

function sourceLabel(source?: string | null) {
  if (source === "deepseek") {
    return "IA externa";
  }

  if (source === "motor_interno_fallback") {
    return "Motor interno RackNova";
  }

  if (source === "racknova") {
    return "RackNova";
  }

  if (source === "error") {
    return "Error";
  }

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
  textarea.style.top = "0";
  textarea.setAttribute("readonly", "true");

  document.body.appendChild(textarea);

  textarea.select();

  const copied = document.execCommand("copy");

  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("No se pudo copiar la respuesta.");
  }
}

export function RackNovaIAAssistant() {
  const allowed = canUseIA();

  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(
    null
  );

  const [messages, setMessages] = useState<Message[]>([
    INITIAL_MESSAGE,
  ]);

  const chatContainerRef = useRef<HTMLDivElement | null>(
    null
  );

  const chatEndRef = useRef<HTMLDivElement | null>(
    null
  );

  const savedScrollTopRef = useRef(0);
  const isNearBottomRef = useRef(true);

  const copyTimerRef = useRef<number | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  /*
   * Cuando el asistente se vuelve a abrir,
   * conserva la posición anterior.
   *
   * Si el usuario estaba al final del chat,
   * vuelve directamente al último mensaje.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const container = chatContainerRef.current;

      if (!container) {
        return;
      }

      if (
        savedScrollTopRef.current > 0 &&
        !isNearBottomRef.current
      ) {
        container.scrollTop =
          savedScrollTopRef.current;
      } else {
        container.scrollTop =
          container.scrollHeight;
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  /*
   * Desplazamiento automático.
   *
   * Solo se desplaza automáticamente si el usuario
   * se encontraba cerca del final del chat.
   *
   * Esto evita que una respuesta larga lo regrese
   * al final cuando está leyendo una parte anterior.
   */
  useEffect(() => {
    if (
      !isOpen ||
      !isNearBottomRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 40);

    return () => {
      window.clearTimeout(timer);
    };
  }, [messages, loading, isOpen]);

  if (!allowed) {
    return null;
  }

  const handleChatScroll = () => {
    const container = chatContainerRef.current;

    if (!container) {
      return;
    }

    savedScrollTopRef.current =
      container.scrollTop;

    const distanceToBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    isNearBottomRef.current =
      distanceToBottom < 90;
  };

  const handleCopy = async (
    content: string,
    index: number
  ) => {
    try {
      await copyToClipboard(content);

      setCopiedIndex(index);

      if (copyTimerRef.current !== null) {
        window.clearTimeout(
          copyTimerRef.current
        );
      }

      copyTimerRef.current =
        window.setTimeout(() => {
          setCopiedIndex(null);
        }, 1800);
    } catch (error) {
      console.error(
        "No se pudo copiar el mensaje:",
        error
      );
    }
  };

  const askIA = async (
    customQuestion?: string
  ) => {
    const preguntaFinal = (
      customQuestion ?? question
    ).trim();

    if (
      !preguntaFinal ||
      loading
    ) {
      return;
    }

    /*
     * Cuando el usuario envía una pregunta,
     * forzamos el desplazamiento al final.
     */
    isNearBottomRef.current = true;

    const userMessage: Message = {
      role: "user",
      content: preguntaFinal,
    };

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const response = await apiFetch(
        "/ia/inventario",
        {
          method: "POST",

          body: JSON.stringify({
            pregunta: preguntaFinal,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "No se pudo obtener respuesta de RACKNOVA IA."
        );
      }

      const assistantMessage: Message = {
        role: "assistant",

        content:
          data?.respuesta ||
          "RACKNOVA IA no generó una respuesta. Intenta con otra pregunta.",

        source:
          data?.fuente ??
          data?.modelo ??
          "racknova",

        warning:
          data?.advertencia ?? null,

        complete:
          typeof data?.completa === "boolean"
            ? data.completa
            : true,

        continuations: Number(
          data?.continuaciones ?? 0
        ),

        finishReason:
          data?.finish_reason ?? null,

        tokenUsage:
          data?.uso_tokens ?? null,
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        assistantMessage,
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocurrió un error conectando con RACKNOVA IA. Revisa el backend.";

      setMessages((previousMessages) => [
        ...previousMessages,

        {
          role: "assistant",
          content: message,
          source: "error",
          warning:
            "No se pudo completar la consulta.",
          complete: false,
          continuations: 0,
          finishReason: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,

        content:
          "Chat reiniciado. Pregúntame sobre inventario, descuentos, caducidad, ubicación, ventas o rentabilidad.",
      },
    ]);

    setCopiedIndex(null);

    savedScrollTopRef.current = 0;
    isNearBottomRef.current = true;
  };

  return (
    <>
      {!isOpen && (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 shadow-2xl transition-transform hover:scale-105"
          title="Abrir RACKNOVA IA"
          aria-label="Abrir RACKNOVA IA"
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
            <div className="border-b bg-gradient-to-r from-blue-700 to-cyan-600 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-black leading-tight">
                      RACKNOVA IA
                    </h2>

                    <p className="text-xs text-white/80">
                      Asistente inteligente de
                      inventario
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 hover:text-white"
                  aria-label="Cerrar RACKNOVA IA"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="border-b bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Preguntas rápidas
              </p>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => askIA(item)}
                    disabled={loading}
                    className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4"
            >
              {messages.map(
                (message, index) => {
                  const isUser =
                    message.role === "user";

                  const totalTokens = Number(
                    message.tokenUsage
                      ?.total_tokens ?? 0
                  );

                  const wasContinued =
                    Number(
                      message.continuations ?? 0
                    ) > 0;

                  const wasCopied =
                    copiedIndex === index;

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex min-w-0 ${
                        isUser
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`min-w-0 max-w-[92%] overflow-hidden rounded-2xl p-3 text-sm shadow-sm sm:max-w-[88%] ${
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : "border bg-muted"
                        }`}
                      >
                        {!isUser && (
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <Bot className="h-4 w-4" />

                              RACKNOVA IA
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  message.content,
                                  index
                                )
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              title={
                                wasCopied
                                  ? "Respuesta copiada"
                                  : "Copiar respuesta"
                              }
                              aria-label={
                                wasCopied
                                  ? "Respuesta copiada"
                                  : "Copiar respuesta"
                              }
                            >
                              {wasCopied ? (
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

                            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                              {message.warning}
                            </span>
                          </div>
                        )}

                        {!isUser &&
                          message.complete ===
                            false && (
                            <div className="mb-3 flex gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                              <AlertTriangle className="h-4 w-4 shrink-0" />

                              <span>
                                La respuesta podría
                                seguir incompleta.
                                Intenta una pregunta
                                más específica o
                                revisa el estado del
                                backend.
                              </span>
                            </div>
                          )}

                        <div className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">
                          {message.content}
                        </div>

                        {!isUser && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                            {message.source && (
                              <span className="rounded-full border bg-background/70 px-2 py-0.5">
                                Fuente:{" "}
                                {sourceLabel(
                                  message.source
                                )}
                              </span>
                            )}

                            {wasContinued && (
                              <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                                Respuesta completada
                                automáticamente
                              </span>
                            )}

                            {totalTokens > 0 && (
                              <span className="rounded-full border bg-background/70 px-2 py-0.5">
                                {totalTokens.toLocaleString(
                                  "es-MX"
                                )}{" "}
                                tokens
                              </span>
                            )}

                            {message.finishReason && (
                              <span className="rounded-full border bg-background/70 px-2 py-0.5">
                                Estado:{" "}
                                {
                                  message.finishReason
                                }
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl border bg-muted p-3 text-sm shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />

                      Analizando inventario...
                    </div>
                  </div>
                </div>
              )}

              <div
                ref={chatEndRef}
                className="h-px"
                aria-hidden="true"
              />
            </div>

            <div className="border-t bg-background p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      askIA();
                    }
                  }}
                  placeholder="Pregúntale a RACKNOVA IA..."
                  className="max-h-36 min-h-[44px] min-w-0 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />

                <Button
                  type="button"
                  size="icon"
                  onClick={() => askIA()}
                  disabled={
                    loading ||
                    !question.trim()
                  }
                  aria-label="Enviar pregunta"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <MessageSquare className="h-3 w-3 shrink-0" />

                  <span className="truncate">
                    Enter para enviar, Shift +
                    Enter para salto de línea.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={clearChat}
                  className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
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
