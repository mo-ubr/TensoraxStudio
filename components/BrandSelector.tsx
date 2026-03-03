import React, { useState, useRef, useEffect } from 'react';
import { BrandProfile } from '../types';
import { parseBrandDocument } from '../services/brandData';

interface BrandSelectorProps {
  brands: BrandProfile[];
  activeBrandId: string;
  onSelectBrand: (id: string) => void;
  onAddBrand: (brand: BrandProfile) => void;
  onDeleteBrand: (id: string) => void;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  brands,
  activeBrandId,
  onSelectBrand,
  onAddBrand,
  onDeleteBrand,
}) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeBrand = brands.find(b => b.id === activeBrandId) || brands[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      let text = '';

      if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        text = await file.text();
      } else if (file.name.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }

      if (text.trim()) {
        const brand = parseBrandDocument(text, file.name);
        onAddBrand(brand);
        onSelectBrand(brand.id);
        setOpen(false);
      }
    } catch (err) {
      console.error('Failed to parse brand document:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-[#3A3A3A] hover:bg-[#4A4A4A] border border-[#4a3a52] rounded-lg px-3.5 py-2 transition-all group shadow-md"
      >
        <i className="fa-solid fa-tag text-[#91569c] text-xs"></i>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4cdd7]">Brand:</span>
        <span className="text-xs font-black uppercase tracking-widest text-white">
          {activeBrand.name}
        </span>
        <i className={`fa-solid fa-chevron-down text-[9px] text-[#91569c] transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#4A4A4A] border border-[#5c4a63] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-[#4a3a52]">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#d4cdd7]/60">Brand Identity</span>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {brands.map(brand => (
              <div
                key={brand.id}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors group ${
                  brand.id === activeBrandId
                    ? 'bg-[#91569c]/10 border-l-2 border-[#91569c]'
                    : 'hover:bg-[#2d2633] border-l-2 border-transparent'
                }`}
                onClick={() => { onSelectBrand(brand.id); setOpen(false); }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <i className={`fa-solid ${brand.id === activeBrandId ? 'fa-circle-check text-[#91569c]' : 'fa-circle text-[#5c4a63]'} text-[10px]`}></i>
                  <span className="text-[11px] font-bold text-white truncate">{brand.name}</span>
                  {brand.isDefault && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c]/60 bg-[#91569c]/10 px-1.5 py-0.5 rounded">default</span>
                  )}
                </div>
                {!brand.isDefault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteBrand(brand.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 transition-all p-1"
                    title="Remove brand"
                  >
                    <i className="fa-solid fa-trash-can text-[9px]"></i>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-[#4a3a52]">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#d4cdd7] hover:bg-[#2d2633] hover:text-[#91569c] transition-colors disabled:opacity-50"
            >
              <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-plus'} text-[10px]`}></i>
              {uploading ? 'Parsing...' : 'Upload Brand Guidelines'}
              <span className="ml-auto text-[8px] text-[#5c4a63]">.txt .md .docx</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
