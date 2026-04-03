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
  // Also save to project dir
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = (reader.result as string).split(',')[1];
    await DB.saveProjectFile(projectId, `${slug}_${filename}.docx`, base64, 'concepts').catch(() => {});
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
    await DB.saveProjectFile(projectId, `${slug}_${filename}.xlsx`, base64, 'concepts').catch(() => {});
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
  const [projectDir, setProjectDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'word' | 'excel' | null>(null);

  const slug = project.slug || project.name.replace(/\s+/g, '_');

  useEffect(() => { loadProjectData(); }, [project.id]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      const [meta, dirInfo, outputsInfo] = await Promise.all([
        DB.getMetadata(project.id).catch(() => ({})),
        fetch(`/api/db/projects/${project.id}/directory`).then(r => r.json()).catch(() => ({ path: '' })),
        fetch(`/api/db/projects/${project.id}/outputs`).then(r => r.json()).catch(() => ({ files: [] })),
      ]);
      setMetadata(meta);
      setProjectDir(dirInfo.path || '');
      setFiles(outputsInfo.files || []);
    } catch (err) {
      console.error('[ProjectDashboard] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

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
        await DB.saveProjectFile(project.id, `${slug}_Full_Report.docx`, base64, 'concepts').catch(() => {});
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
        await DB.saveProjectFile(project.id, `${slug}_Full_Report.xlsx`, base64, 'concepts').catch(() => {});
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
              className="block bg-gradient-to-r from-[#91569c] to-[#c084fc] rounded-xl p-5 text-white hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
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

          {/* Description */}
          {project.description && (
            <div className="bg-white rounded-xl border border-[#e0d6e3] p-5">
              <p className="text-sm text-[#333] leading-relaxed">{project.description}</p>
            </div>
          )}

          {/* Research Summary */}
          {m.researchSummary && (
            <SectionCard
              title="Research Summary"
              icon="fa-microscope"
              onSaveWord={() => saveSectionAsWord('Research Summary', m.researchSummary, 'Research_Summary', project.id, slug)}
            >
              <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">{m.researchSummary}</p>
            </SectionCard>
          )}

          {/* Key Findings */}
          {m.findings && (
            <SectionCard
              title="Key Findings"
              icon="fa-lightbulb"
              onSaveWord={() => saveSectionAsWord('Key Findings', m.findings, 'Key_Findings', project.id, slug)}
            >
              <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">{m.findings}</p>
            </SectionCard>
          )}

          {/* Competitor Data Table */}
          {(() => {
            const compArr = parseArrayField(m.competitorData);
            if (!compArr || compArr.length === 0) return null;
            return (
              <SectionCard
                title="Competitor Analysis"
                icon="fa-users"
                onSaveWord={() => saveSectionAsWord('Competitors', m.competitors || compArr.map((c: any) => `${c.account}: ${c.followers} followers, ${c.avgPlays} avg plays, ${c.style}`).join('\n'), 'Competitors', project.id, slug)}
                onSaveExcel={() => saveSectionAsExcel('Competitors', compArr, 'Competitors', project.id, slug)}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#91569c] text-white">
                        {Object.keys(compArr[0]).map(k => (
                          <th key={k} className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compArr.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-[#f0e6f4] hover:bg-[#faf7fb]">
                          {Object.values(row).map((v: any, j: number) => (
                            <td key={j} className="px-3 py-2 text-[#333]">{typeof v === 'number' ? v.toLocaleString() : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })()}

          {/* Channel Stats / Video Data */}
          {(() => {
            const vidArr = parseArrayField(m.videoData);
            if (!vidArr || vidArr.length === 0) return null;
            return (
              <SectionCard
                title="Channel Performance"
                icon="fa-chart-bar"
                onSaveExcel={() => saveSectionAsExcel('Channel Stats', vidArr, 'Channel_Stats', project.id, slug)}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {vidArr.map((row: any, i: number) => (
                    <div key={i} className="bg-[#faf7fb] rounded-lg p-3 text-center border border-[#f0e6f4]">
                      <div className="text-lg font-bold text-[#91569c]">{typeof row.value === 'number' ? row.value.toLocaleString() : row.value}</div>
                      <div className="text-[9px] text-[#888] uppercase tracking-wider mt-0.5">{row.metric}</div>
                      {row.benchmark && <div className="text-[9px] text-[#aaa] mt-1">Benchmark: {typeof row.benchmark === 'number' ? row.benchmark.toLocaleString() : row.benchmark}</div>}
                      {row.gap && <div className={`text-[9px] font-bold mt-0.5 ${String(row.gap).startsWith('-') ? 'text-red-500' : 'text-green-600'}`}>{row.gap}</div>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          })()}

          {/* Hashtag Data */}
          {(() => {
            const htArr = parseArrayField(m.hashtagData);
            if (!htArr || htArr.length === 0) return null;
            return (
              <SectionCard
                title="Hashtag Strategy"
                icon="fa-hashtag"
                onSaveWord={() => saveSectionAsWord('Hashtag Strategy', m.hashtags || htArr.map((h: any) => `${h.hashtag}: ${h.avgPlays?.toLocaleString()} avg plays (${h.priority})`).join('\n'), 'Hashtags', project.id, slug)}
                onSaveExcel={() => saveSectionAsExcel('Hashtags', htArr, 'Hashtags', project.id, slug)}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#91569c] text-white">
                        {Object.keys(htArr[0]).map(k => (
                          <th key={k} className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {htArr.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-[#f0e6f4] hover:bg-[#faf7fb]">
                          {Object.values(row).map((v: any, j: number) => (
                            <td key={j} className="px-3 py-2 text-[#333]">{typeof v === 'number' ? v.toLocaleString() : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })()}

          {/* Recommendations */}
          {m.recommendations && (
            <SectionCard
              title="Recommendations"
              icon="fa-clipboard-check"
              onSaveWord={() => saveSectionAsWord('Recommendations', m.recommendations, 'Recommendations', project.id, slug)}
            >
              <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">{m.recommendations}</p>
            </SectionCard>
          )}

          {/* Full Report (collapsible) */}
          {m.fullReport && (
            <SectionCard
              title="Full Research Report"
              icon="fa-file-lines"
              onSaveWord={() => saveSectionAsWord('Full Report', m.fullReport, 'Full_Report', project.id, slug)}
            >
              <details>
                <summary className="text-xs font-bold text-[#91569c] cursor-pointer mb-2">Click to expand full report</summary>
                <div className="text-xs text-[#333] leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto border-t border-[#f0e6f4] pt-3 mt-2">
                  {m.fullReport}
                </div>
              </details>
            </SectionCard>
          )}

          {/* Generated Files */}
          {files.length > 0 && (
            <SectionCard title="Generated Files" icon="fa-folder">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-[#e0d6e3] hover:border-[#91569c] hover:bg-[#f6f0f8] transition-all">
                    <i className={`fa-solid ${
                      /\.(mp4|webm|mov)$/i.test(f.name) ? 'fa-video text-[#91569c]' :
                      /\.(png|jpg|jpeg|webp)$/i.test(f.name) ? 'fa-image text-blue-500' :
                      /\.(docx?)$/i.test(f.name) ? 'fa-file-word text-blue-600' :
                      /\.(xlsx?)$/i.test(f.name) ? 'fa-file-excel text-green-600' :
                      /\.(pdf)$/i.test(f.name) ? 'fa-file-pdf text-red-500' :
                      'fa-file text-[#888]'
                    }`} />
                    <span className="text-xs text-[#5c3a62] font-bold truncate">{f.name}</span>
                  </a>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Empty state — only if no research data at all */}
          {!m.researchSummary && !m.findings && !m.recommendations && !m.fullReport && files.length === 0 && !hasDashboard && (
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
