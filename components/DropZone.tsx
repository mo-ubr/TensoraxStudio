import React, { useState, useCallback } from 'react';

interface DropZoneProps {
  /** Called with the dropped files */
  onFiles: (files: File[]) => void;
  /** Comma-separated accept types, e.g. "image/*" or ".docx,.pdf" */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Child elements — the existing upload UI */
  children: React.ReactNode;
  /** Extra className on the wrapper */
  className?: string;
  /** Whether drop zone is disabled */
  disabled?: boolean;
}

/** Checks whether a dropped file matches the accept string */
function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const parts = accept.split(',').map(s => s.trim().toLowerCase());
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const mime = file.type.toLowerCase();
  return parts.some(p => {
    if (p.endsWith('/*')) return mime.startsWith(p.replace('/*', '/'));
    if (p.startsWith('.')) return ext === p;
    return mime === p;
  });
}

/**
 * Wraps any upload UI and adds drag-and-drop support.
 * Shows a purple highlight overlay when files are dragged over.
 */
export default function DropZone({ onFiles, accept, multiple = false, children, className = '', disabled = false }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;

    const droppedFiles: File[] = Array.from(e.dataTransfer.files);
    const filtered: File[] = droppedFiles.filter(f => fileMatchesAccept(f, accept));
    if (filtered.length === 0) return;

    onFiles(multiple ? filtered : [filtered[0]]);
  }, [accept, multiple, onFiles, disabled]);

  return (
    <div
      className={`relative ${className}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {dragOver && (
        <div className="absolute inset-0 bg-[#91569c]/15 border-2 border-dashed border-[#91569c] rounded-xl z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <i className="fa-solid fa-cloud-arrow-down text-[#91569c] text-lg"></i>
            <span className="text-xs font-black uppercase tracking-wider text-[#5c3a62]">Drop here</span>
          </div>
        </div>
      )}
    </div>
  );
}
