/**
 * ProjectDashboard — Project results view with interactive dashboard link,
 * per-section save buttons, and full Word/Excel export.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DB, type Project } from '../services/projectDB';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as XLSX from 'xlsx';

interface ProjectDashboardProps {
  project: Project;
  onBack: () => void;
  onOpenInChat: (project: Project) => void;
}

interface ProjectFile {
  name: string;
  path: string;
  url: string;
  folder?: string;
  size?: number;
  modified?: string;
}

// Helper: parse JSON string or return array as-is
function parseArrayField(field: unknown): any[] | null {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') { try { const p = JSON.parse(field); return Array.isArray(p) ? p : null; } catch { return null; } }
  return null;
}

// Helper: save one section as Word
async function saveSectionAsWord(title: string, content: string, filename: string, projectId: string, slug: string) {
  const children: any[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: `Exported: ${new Date().toLocaleDateString('en-GB')}`, italics: true, size: 18, color: '888888' })], spacing: { after: 300 } }),
  ];
  for (const line of content.split('\n')) {
    children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }));
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}_${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
  // Also save to project dir + register as asset
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = (reader.result as string).split(',')[1];
    const savedFile = await DB.saveProjectFile(projectId, `${slug}_${filename}.docx`, base64, 'concepts').catch(() => null);
    await DB.saveToAssets(projectId, {
      type: 'concept',
      name: `${title} (Word)`,
      description: content.slice(0, 300),
      filePath: savedFile?.path || `${slug}_${filename}.docx`,
      tags: ['export', 'word', filename.toLowerCase()],
      metadata: { source: 'project-dashboard', format: 'docx' },
    }).catch(() => {});
  };
  reader.readAsDataURL(blob);
}

// Helper: save one section as Excel
async function saveSectionAsExcel(sheetName: string, data: any[], filename: string, projectId: string, slug: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const blob = new Blob(
    [XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}_${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = (reader.result as string).split(',')[1];
    const savedFile = await DB.saveProjectFile(projectId, `${slug}_${filename}.xlsx`, base64, 'concepts').catch(() => null);
    await DB.saveToAssets(projectId, {
      type: 'concept',
      name: `${sheetName} (Excel)`,
      description: `${data.length} rows of ${sheetName} data`,
      filePath: savedFile?.path || `${slug}_${filename}.xlsx`,
      tags: ['export', 'excel', filename.toLowerCase()],
      metadata: { source: 'project-dashboard', format: 'xlsx', rows: String(data.length) },
    }).catch(() => {});
  };
  reader.readAsDataURL(blob);
}

// ─── Section Card with save button ─────────────────────────────────────────

const SectionCard: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  onSaveWord?: () => void;
  onSaveExcel?: () => void;
}> = ({ title, icon, children, onSaveWord, onSaveExcel }) => {
  const [saving, setSaving] = useState<string | null>(null);
  return (
    <div className="bg-white rounded-xl border border-[#e0d6e3] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0e6f4] bg-[#faf7fb]">
        <div className="flex items-center gap-2">
          <i className={`fa-solid ${icon} text-[#91569c] text-xs`} />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#5c3a62]">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onSaveWord && (
            <button
              onClick={async () => { setSaving('word'); await onSaveWord(); setSaving(null); }}
              disabled={saving !== null}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all"
              title="Save this section as Word"
            >
              <i className={`fa-solid ${saving === 'word' ? 'fa-spinner fa-spin' : 'fa-file-word'}`} />
              Word
            </button>
          )}
          {onSaveExcel && (
            <button
              onClick={async () => { setSaving('excel'); await onSaveExcel(); setSaving(null); }}
              disabled={saving !== null}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
              title="Save this section as Excel"
            >
              <i className={`fa-solid ${saving === 'excel' ? 'fa-spinner fa-spin' : 'fa-file-excel'}`} />
              Excel
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, onBack, onOpenInChat }) => {
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [allFiles, setAllFiles] = useState<ProjectFile[]>([]);
  const [projectDir, setProjectDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'word' | 'excel' | null>(null);
  const [instructions, setInstructions] = useState('');
  const [instructionsSaved, setInstructionsSaved] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ filesScanned: number; assetsCreated: number } | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Actions config
  const [actions, setActions] = useState<{
    saveFormat: 'excel' | 'word' | 'pdf' | 'none';
    scheduleEnabled: boolean;
    scheduleFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    scheduleDay: string;
    scheduleTime: string;
    schedulePeriodStart: string;
    schedulePeriodEnd: string;
    notifyTrigger: 'schedule' | 'when-ready' | 'both';
    notifyRecipients: string;
    notifyInclude: 'link' | 'link-summary' | 'link-attachment';
  }>({
    saveFormat: 'excel',
    scheduleEnabled: false,
    scheduleFrequency: 'weekly',
    scheduleDay: 'Monday',
    scheduleTime: '09:00',
    schedulePeriodStart: '',
    schedulePeriodEnd: '',
    notifyTrigger: 'both',
    notifyRecipients: '',
    notifyInclude: 'link-summary',
  });
  const [actionsSaved, setActionsSaved] = useState(true);

  const slug = project.slug || project.name.replace(/\s+/g, '_');

  useEffect(() => { loadProjectData(); }, [project.id]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      const [meta, dirInfo, outputsInfo, allFilesInfo] = await Promise.all([
        DB.getMetadata(project.id).catch(() => ({})),
        fetch(`/api/db/projects/${project.id}/directory`).then(r => r.json()).catch(() => ({ path: '' })),
        fetch(`/api/db/projects/${project.id}/outputs`).then(r => r.json()).catch(() => ({ files: [] })),
        fetch(`/api/db/projects/${project.id}/all-files`).then(r => r.json()).catch(() => ({ files: [] })),
      ]);
      setMetadata(meta);
      setProjectDir(dirInfo.path || '');
      setFiles(outputsInfo.files || []);
      setAllFiles(allFilesInfo.files || []);
      setInstructions(typeof meta.instructions === 'string' ? meta.instructions : '');
      if (meta.actions && typeof meta.actions === 'object') {
        setActions(prev => ({ ...prev, ...(meta.actions as any) }));
      }
      if (!meta.actions?.notifyRecipients) {
        const globalEmail = localStorage.getItem('tensorax_notify_email') || '';
        if (globalEmail) setActions(prev => ({ ...prev, notifyRecipients: globalEmail }));
      }
    } catch (err) {
      console.error('[ProjectDashboard] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Instructions auto-save (debounced) ────────────────────────────────

  const handleInstructionsChange = useCallback((text: string) => {
    setInstructions(text);
    setInstructionsSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await DB.saveMetadata(project.id, { instructions: text }).catch(() => {});
      setInstructionsSaved(true);
    }, 1000);
  }, [project.id]);

  // ─── Actions auto-save ──────────────────────────────────────────────────

  const updateAction = useCallback((patch: Partial<typeof actions>) => {
    setActions(prev => {
      const updated = { ...prev, ...patch };
      setActionsSaved(false);
      setTimeout(async () => {
        await DB.saveMetadata(project.id, { actions: updated }).catch(() => {});
        setActionsSaved(true);
      }, 800);
      return updated;
    });
  }, [project.id]);

  // ─── File Upload ───────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('subfolder', 'uploads');
      for (const f of files) {
        formData.append('files', f);
      }
      const res = await fetch(`/api/db/projects/${project.id}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      // Reload file list
      const allFilesInfo = await fetch(`/api/db/projects/${project.id}/all-files`).then(r => r.json()).catch(() => ({ files: [] }));
      setAllFiles(allFilesInfo.files || []);
    } catch (err: any) {
      console.error('[Upload] Failed:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      setIsDragging(false);
    }
  }, [project.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const m = metadata as any;

  // ─── Detect if this project has an interactive dashboard ─────────────────
  // The Za Horata TikTok project has tt-results.html in public/
  const hasDashboard = project.name.toLowerCase().includes('za horata')
    || project.name.toLowerCase().includes('tiktok')
    || m.dashboardUrl;

  const dashboardUrl = m.dashboardUrl || '/tt-results.html';

  // ─── Full export ──────────────────────────────────────────────────────────

  const exportAllWord = useCallback(async () => {
    setExporting('word');
    try {
      const children: any[] = [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: project.name, bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun({ text: `Full export: ${new Date().toLocaleDateString('en-GB')}`, italics: true, size: 18, color: '888888' })], spacing: { after: 300 } }),
      ];
      const sections = [
        { label: 'Description', value: project.description },
        { label: 'Research Summary', value: m.researchSummary },
        { label: 'Key Findings', value: m.findings },
        { label: 'Recommendations', value: m.recommendations },
        { label: 'Competitors', value: m.competitors },
        { label: 'Hashtag Strategy', value: m.hashtags },
        { label: 'Full Report', value: m.fullReport },
      ].filter(s => s.value);

      for (const s of sections) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: s.label, bold: true, size: 24 })], spacing: { before: 200 } }));
        for (const line of String(s.value).split('\n')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }));
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}_Full_Report.docx`;
      a.click();
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const savedFile = await DB.saveProjectFile(project.id, `${slug}_Full_Report.docx`, base64, 'concepts').catch(() => null);
        await DB.saveToAssets(project.id, {
          type: 'concept',
          name: `${project.name} — Full Report (Word)`,
          description: `Full research report with ${sections.length} sections`,
          filePath: savedFile?.path || `${slug}_Full_Report.docx`,
          tags: ['export', 'word', 'full-report'],
          metadata: { source: 'project-dashboard', format: 'docx' },
        }).catch(() => {});
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('[Export] Word failed:', err);
    } finally {
      setExporting(null);
    }
  }, [project, metadata]);

  const exportAllExcel = useCallback(async () => {
    setExporting('excel');
    try {
      const wb = XLSX.utils.book_new();
      // Summary
      const summaryRows = [
        { Field: 'Project', Value: project.name },
        { Field: 'Description', Value: project.description || '' },
        { Field: 'Status', Value: project.status },
        { Field: 'Created', Value: project.createdAt },
        { Field: 'Research Summary', Value: m.researchSummary || '' },
        { Field: 'Findings', Value: m.findings || '' },
        { Field: 'Recommendations', Value: m.recommendations || '' },
        { Field: 'Competitors Summary', Value: m.competitors || '' },
        { Field: 'Hashtags', Value: m.hashtags || '' },
      ];
      const ws = XLSX.utils.json_to_sheet(summaryRows);
      ws['!cols'] = [{ wch: 25 }, { wch: 100 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');

      const compArr = parseArrayField(m.competitorData);
      if (compArr) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compArr), 'Competitors');
      const vidArr = parseArrayField(m.videoData);
      if (vidArr) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vidArr), 'Channel Stats');
      const htArr = parseArrayField(m.hashtagData);
      if (htArr) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(htArr), 'Hashtags');

      const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}_Full_Report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const savedFile = await DB.saveProjectFile(project.id, `${slug}_Full_Report.xlsx`, base64, 'concepts').catch(() => null);
        await DB.saveToAssets(project.id, {
          type: 'concept',
          name: `${project.name} — Full Report (Excel)`,
          description: 'Full research report with all data sheets',
          filePath: savedFile?.path || `${slug}_Full_Report.xlsx`,
          tags: ['export', 'excel', 'full-report'],
          metadata: { source: 'project-dashboard', format: 'xlsx' },
        }).catch(() => {});
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('[Export] Excel failed:', err);
    } finally {
      setExporting(null);
    }
  }, [project, metadata]);

  const openFolder = async () => {
    await fetch(`/api/db/projects/${project.id}/open-folder`, { method: 'POST' }).catch(() => {});
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec]">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-[#91569c]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#edecec] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#e0d6e3]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-[#91569c] hover:text-[#5c3a62] transition-colors">
              <i className="fa-solid fa-arrow-left" />
            </button>
            <div>
              <h1 className="text-lg font-heading font-bold text-[#5c3a62]">{project.name}</h1>
              <p className="text-[10px] text-[#888] uppercase tracking-wider">
                {project.status} · Created {new Date(project.createdAt).toLocaleDateString('en-GB')}
                {projectDir && <> · <span className="text-[#91569c]">{projectDir}</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onOpenInChat(project)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e0d6e3] bg-white text-[10px] font-bold text-[#5c3a62] hover:border-[#91569c] hover:text-[#91569c] transition-all">
              <i className="fa-solid fa-comment" /> Continue in Chat
            </button>
            <button onClick={openFolder} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e0d6e3] bg-white text-[10px] font-bold text-[#5c3a62] hover:border-[#91569c] hover:text-[#91569c] transition-all" title="Open project folder">
              <i className="fa-solid fa-folder-open" /> Open Folder
            </button>
            <button onClick={exportAllWord} disabled={exporting === 'word'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-[10px] font-bold hover:bg-blue-600 disabled:opacity-50 transition-all">
              <i className={`fa-solid ${exporting === 'word' ? 'fa-spinner fa-spin' : 'fa-file-word'}`} /> Save All as Word
            </button>
            <button onClick={exportAllExcel} disabled={exporting === 'excel'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-700 disabled:opacity-50 transition-all">
              <i className={`fa-solid ${exporting === 'excel' ? 'fa-spinner fa-spin' : 'fa-file-excel'}`} /> Save All as Excel
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Interactive Dashboard Link — the main deliverable */}
          {hasDashboard && (
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gradient-to-r from-[#5c3a62] to-[#91569c] rounded-xl p-5 text-white hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-chart-line text-2xl" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-heading font-bold">Interactive Research Dashboard</h2>
                  <p className="text-xs text-white/80 mt-0.5">Full analytics with competitor tables, video data, hashtag analysis, thumbnails, and export tools</p>
                </div>
                <i className="fa-solid fa-arrow-up-right-from-square text-white/60 text-lg" />
              </div>
            </a>
          )}

          {/* Project Instructions */}
          <div className="bg-white rounded-xl border border-[#e0d6e3] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0e6f4] bg-[#faf7fb]">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-clipboard-list text-[#91569c] text-xs" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#5c3a62]">Project Instructions</h3>
              </div>
              <span className="text-[9px] text-[#aaa]">
                {instructionsSaved ? <><i className="fa-solid fa-check text-green-500" /> Saved</> : <><i className="fa-solid fa-spinner fa-spin text-[#91569c]" /> Saving...</>}
              </span>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={instructions}
                onChange={e => handleInstructionsChange(e.target.value)}
                placeholder="Write instructions for MO when working on this project... (e.g. target audience, objectives, constraints, platform-specific notes)"
                rows={4}
                className="w-full text-sm px-3 py-2.5 border border-[#e0d6e3] rounded-lg focus:outline-none focus:border-[#91569c] focus:ring-1 focus:ring-[#91569c]/20 resize-y min-h-[80px] placeholder:text-[#bbb]"
              />
              <p className="text-[9px] text-[#aaa] mt-1.5">These instructions persist across sessions and are used by MO when working on this project.</p>
            </div>
          </div>

          {/* Project Files — Upload Zone */}
          <div className="bg-white rounded-xl border border-[#e0d6e3] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0e6f4] bg-[#faf7fb]">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-file-arrow-up text-[#91569c] text-xs" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#5c3a62]">Project Files</h3>
              </div>
              <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#91569c] text-white text-[9px] font-bold cursor-pointer hover:bg-[#7a4785] transition-colors">
                <i className="fa-solid fa-plus" />
                Upload
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
                />
              </label>
            </div>
            <div className="px-5 py-4">
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                  isDragging ? 'border-[#91569c] bg-[#f6f0f8]' : 'border-[#e0d6e3] hover:border-[#ceadd4]'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading ? (
                  <p className="text-xs text-[#91569c] font-bold"><i className="fa-solid fa-spinner fa-spin mr-1" /> Uploading...</p>
                ) : isDragging ? (
                  <p className="text-xs text-[#91569c] font-bold"><i className="fa-solid fa-cloud-arrow-up mr-1" /> Drop files here</p>
                ) : (
                  <p className="text-[10px] text-[#aaa]"><i className="fa-solid fa-cloud-arrow-up mr-1" /> Drag & drop files here, or click Upload above</p>
                )}
              </div>

              {/* File list */}
              {allFiles.length > 0 && (
                <div className="mt-3 space-y-1">
                  {allFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#faf7fb] transition-colors">
                      <i className={`fa-solid ${
                        /\.(json)$/i.test(f.name) ? 'fa-file-code text-yellow-600' :
                        /\.(mp4|webm|mov)$/i.test(f.name) ? 'fa-video text-[#91569c]' :
                        /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name) ? 'fa-image text-blue-500' :
                        /\.(docx?)$/i.test(f.name) ? 'fa-file-word text-blue-600' :
                        /\.(xlsx?)$/i.test(f.name) ? 'fa-file-excel text-green-600' :
                        /\.(pdf)$/i.test(f.name) ? 'fa-file-pdf text-red-500' :
                        /\.(zip|gz|tar)$/i.test(f.name) ? 'fa-file-zipper text-amber-600' :
                        /\.(txt|md|csv)$/i.test(f.name) ? 'fa-file-lines text-[#888]' :
                        'fa-file text-[#888]'
                      } text-xs w-4 text-center`} />
                      <span className="text-xs text-[#5c3a62] font-bold truncate flex-1">{f.name}</span>
                      {f.folder && <span className="text-[9px] text-[#aaa]">{f.folder}/</span>}
                      {f.size ? <span className="text-[9px] text-[#aaa]">{f.size > 1048576 ? (f.size/1048576).toFixed(1) + ' MB' : f.size > 1024 ? (f.size/1024).toFixed(0) + ' KB' : f.size + ' B'}</span> : null}
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#91569c] hover:underline">
                        <i className="fa-solid fa-download" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {allFiles.length === 0 && !uploading && (
                <p className="text-[9px] text-[#aaa] mt-2 text-center">No files uploaded yet.</p>
              )}
            </div>
          </div>

          {/* Actions — save, schedule, notify */}
          <div className="bg-white rounded-xl border border-[#e0d6e3] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0e6f4] bg-[#faf7fb]">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-bolt text-[#91569c] text-xs" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#5c3a62]">Actions</h3>
              </div>
              <span className="text-[9px] text-[#aaa]">
                {actionsSaved ? <><i className="fa-solid fa-check text-green-500" /> Saved</> : <><i className="fa-solid fa-spinner fa-spin text-[#91569c]" /> Saving...</>}
              </span>
            </div>
            <div className="px-5 py-4 space-y-4">

              {/* Save format */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#888] mb-1">Save output as</label>
                <div className="flex gap-2">
                  {(['excel', 'word', 'pdf', 'none'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => updateAction({ saveFormat: fmt })}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        actions.saveFormat === fmt
                          ? 'bg-[#91569c] text-white border-[#91569c]'
                          : 'bg-white text-[#5c3a62] border-[#e0d6e3] hover:border-[#91569c]'
                      }`}
                    >
                      {fmt === 'none' ? 'No auto-save' : fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-[#888]">Schedule</label>
                  <button
                    onClick={() => updateAction({ scheduleEnabled: !actions.scheduleEnabled })}
                    className={`w-8 h-4 rounded-full transition-colors relative ${actions.scheduleEnabled ? 'bg-[#91569c]' : 'bg-[#ddd]'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${actions.scheduleEnabled ? 'left-[17px]' : 'left-0.5'}`} />
                  </button>
                  <span className="text-[9px] text-[#aaa]">{actions.scheduleEnabled ? 'Active' : 'Off'}</span>
                </div>

                {actions.scheduleEnabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#faf7fb] rounded-lg p-3 border border-[#f0e6f4]">
                    <div>
                      <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Frequency</label>
                      <select value={actions.scheduleFrequency} onChange={e => updateAction({ scheduleFrequency: e.target.value as any })}
                        className="w-full text-xs px-2 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {actions.scheduleFrequency !== 'daily' && (
                      <div>
                        <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Day</label>
                        <select value={actions.scheduleDay} onChange={e => updateAction({ scheduleDay: e.target.value })}
                          className="w-full text-xs px-2 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]">
                          {actions.scheduleFrequency === 'monthly'
                            ? Array.from({length:28}, (_,i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)
                            : ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)
                          }
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Time</label>
                      <input type="time" value={actions.scheduleTime} onChange={e => updateAction({ scheduleTime: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]" />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Period</label>
                      <div className="flex gap-1 items-center">
                        <input type="date" value={actions.schedulePeriodStart} onChange={e => updateAction({ schedulePeriodStart: e.target.value })}
                          className="w-full text-[10px] px-1 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]" />
                        <span className="text-[9px] text-[#aaa]">→</span>
                        <input type="date" value={actions.schedulePeriodEnd} onChange={e => updateAction({ schedulePeriodEnd: e.target.value })}
                          className="w-full text-[10px] px-1 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#888] mb-1">Notification</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Trigger</label>
                    <select value={actions.notifyTrigger} onChange={e => updateAction({ notifyTrigger: e.target.value as any })}
                      className="w-full text-xs px-2 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]">
                      <option value="schedule">On schedule</option>
                      <option value="when-ready">When ready (task completes)</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Include</label>
                    <select value={actions.notifyInclude} onChange={e => updateAction({ notifyInclude: e.target.value as any })}
                      className="w-full text-xs px-2 py-1.5 border border-[#e0d6e3] rounded bg-white focus:outline-none focus:border-[#91569c]">
                      <option value="link">Link only</option>
                      <option value="link-summary">Link + summary</option>
                      <option value="link-attachment">Link + full report attached</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase text-[#aaa] mb-0.5">Recipients</label>
                    <input type="text" value={actions.notifyRecipients} onChange={e => updateAction({ notifyRecipients: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full text-xs px-2 py-1.5 border border-[#e0d6e3] rounded bg-white placeholder:text-[#bbb] focus:outline-none focus:border-[#91569c]" />
                  </div>
                </div>
              </div>

              <p className="text-[9px] text-[#aaa]">
                {actions.scheduleEnabled
                  ? `Scheduled: save ${actions.saveFormat.toUpperCase()} ${actions.scheduleFrequency}${actions.scheduleFrequency !== 'daily' ? ' on ' + actions.scheduleDay : ''} at ${actions.scheduleTime}. Notify: ${actions.notifyTrigger}.`
                  : 'Schedule is off. Results will be saved and notifications sent when tasks complete (if "when ready" trigger is selected).'}
              </p>
            </div>
          </div>

          {/* Empty state — only if no dashboard and no files */}
          {!hasDashboard && allFiles.length === 0 && (
            <div className="text-center py-12">
              <i className="fa-solid fa-folder-open text-4xl text-[#ceadd4] mb-3" />
              <p className="text-sm text-[#888]">No results yet. Start working on this project in the chat.</p>
              <button onClick={() => onOpenInChat(project)}
                className="mt-3 px-4 py-2 rounded-lg bg-[#91569c] text-white text-xs font-bold hover:bg-[#7a4785] transition-colors">
                Open in Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
