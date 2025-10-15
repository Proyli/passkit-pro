import { useEffect, useMemo, useRef } from "react";
import type { ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HtmlEditorProps = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  placeholders?: string[];
};

type CommandButton = {
  label: string;
  command?: string;
  value?: string;
  action?: () => void;
  title?: string;
};

const INLINE_COMMANDS: CommandButton[] = [
  { label: "B", command: "bold", title: "Negrita" },
  { label: "I", command: "italic", title: "Cursiva" },
  { label: "U", command: "underline", title: "Subrayado" },
  { label: "S", command: "strikeThrough", title: "Tachado" },
];

const LIST_COMMANDS: CommandButton[] = [
  { label: "UL", command: "insertUnorderedList", title: "Lista con vinetas" },
  { label: "OL", command: "insertOrderedList", title: "Lista numerada" },
  { label: "Out", command: "outdent", title: "Disminuir sangria" },
  { label: "In", command: "indent", title: "Aumentar sangria" },
];

const BLOCK_OPTIONS = [
  { label: "Normal", value: "P" },
  { label: "Titulo", value: "H2" },
  { label: "Subtitulo", value: "H3" },
  { label: "Nota", value: "BLOCKQUOTE" },
];

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export function HtmlEditor({
  value,
  onChange,
  className,
  placeholder,
  placeholders = [],
}: HtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    const current = editorRef.current.innerHTML;
    if (value !== current) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (command: string, commandValue?: string) => {
    if (!isBrowser) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue ?? undefined);
    emitChange();
  };

  const emitChange = () => {
    const html = editorRef.current?.innerHTML ?? "";
    onChange(html);
  };

  const handleInput = () => emitChange();

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!isBrowser) return;
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleLink = () => {
    if (!isBrowser) return;
    const input = window.prompt("URL del enlace:");
    if (!input) return;
    let href = input.trim();
    if (!href) return;
    if (!/^https?:/i.test(href)) {
      href = `https://${href}`;
    }
    exec("createLink", href);
  };

  const handlePlaceholder = (token: string) => {
    if (!isBrowser) return;
    exec("insertHTML", token);
  };

  const handleClear = () => exec("removeFormat");

  const isEmpty = useMemo(() => stripHtml(value || "").length === 0, [value]);

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-2">
        {INLINE_COMMANDS.map((cmd) => (
          <Button
            key={cmd.label}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-xs"
            title={cmd.title}
            onClick={() => cmd.command && exec(cmd.command)}
          >
            {cmd.label}
          </Button>
        ))}

        <span className="mx-2 h-6 w-px bg-border" />

        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue="P"
          onChange={(event) =>
            exec("formatBlock", `<${event.target.value}>`)
          }
        >
          {BLOCK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="mx-2 h-6 w-px bg-border" />

        {LIST_COMMANDS.map((cmd) => (
          <Button
            key={cmd.label}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-xs"
            title={cmd.title}
            onClick={() => cmd.command && exec(cmd.command)}
          >
            {cmd.label}
          </Button>
        ))}

        <span className="mx-2 h-6 w-px bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={handleLink}
        >
          Enlace
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={handleClear}
        >
          Limpiar
        </Button>
      </div>

      <div className="relative">
        {placeholder && isEmpty && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          className="min-h-[240px] px-3 py-2 text-sm focus:outline-none"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleInput}
          onPaste={handlePaste}
        />
      </div>

      {placeholders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium">Insertar placeholder:</span>
          {placeholders.map((token) => (
            <Button
              key={token}
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => handlePlaceholder(token)}
            >
              {token}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HtmlEditor;




