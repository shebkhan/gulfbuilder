"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type FileDropzoneProps = {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
};

export function FileDropzone({
  accept,
  multiple = false,
  maxSize,
  disabled = false,
  onFiles,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleIncoming = (incoming: File[]) => {
    setError(null);
    const accepted = accept ? accept.split(",").map((s) => s.trim()) : null;
    const valid: File[] = [];
    for (const f of incoming) {
      if (maxSize && f.size > maxSize) {
        setError("file_too_large");
        continue;
      }
      if (accepted && !accepted.includes(f.type)) {
        setError("unsupported_file_type");
        continue;
      }
      valid.push(f);
    }
    const next = multiple ? [...files, ...valid] : valid.slice(0, 1);
    setFiles(next);
    onFiles(next);
  };

  const remove = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFiles(next);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          handleIncoming(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-hairline bg-surface-container-lowest hover:border-primary/40",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="size-6 text-on-surface-variant" />
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Drag and drop files here, or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={(e) => handleIncoming(Array.from(e.target.files ?? []))}
        />
      </div>

      {error ? (
        <p className="font-body-sm text-body-sm text-error">{error}</p>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-1.5 font-body-sm text-body-sm"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-on-surface-variant hover:text-error"
                aria-label="Remove file"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
