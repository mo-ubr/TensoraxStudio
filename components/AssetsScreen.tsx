/**
 * AssetsScreen — Displays all assets saved across projects.
 * Shows asset type, name, linked project, and creation date.
 */

import React, { useState, useEffect } from 'react';
import { DB, type AssetRef, type Project } from '../services/projectDB';

interface AssetsScreenProps {
  onBack: () => void;
  projects: Project[];
}

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  character: { icon: 'fa-user', color: 'text-purple-500', label: 'Character' },
  image: { icon: 'fa-image', color: 'text-blue-500', label: 'Image' },
  video: { icon: 'fa-video', color: 'text-red-500', label: 'Video' },
  concept: { icon: 'fa-file-lines', color: 'text-amber-600', label: 'Concept' },
  scenery: { icon: 'fa-mountain-sun', color: 'text-green-500', label: 'Scenery' },
  clothing: { icon: 'fa-shirt', color: 'text-pink-500', label: 'Clothing' },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] || { icon: 'fa-file', color: 'text-[#888]', label: type };
}

export const AssetsScreen: React.FC<AssetsScreenProps> = ({ onBack, projects }) => {
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [projectLinks, setProjectLinks] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const allAssets = await DB.listAssets();
      setAssets(allAssets);

      // Build project-asset links by checking each project
      const links: Record<string, string[]> = {};
      for (const p of projects) {
        try {
          const full = await DB.getProject(p.id);
          const linked = [
            ...(full.characterIds || []),
            ...(full.sceneryIds || []),
            ...(full.clothingIds || []),
            ...(full.conceptIds || []),
            ...(full.imageIds || []),
            ...(full.videoIds || []),
          ];
          for (const assetId of linked) {
            if (!links[assetId]) links[assetId] = [];
            links[assetId].push(p.name);
          }
        } catch { /* skip */ }
      }
      setProjectLinks(links);
    } catch (err) {
      console.error('[Assets] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('Delete this asset?')) return;
    try {
      await DB.deleteAsset(id);
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message || err}`);
    }
  };

  const types = ['all', ...new Set(assets.map(a => a.type))];
  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter);

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
              <h1 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Assets</h1>
              <p className="text-[10px] text-[#888] uppercase tracking-wider">{assets.length} assets across {projects.length} projects</p>
            </div>
          </div>
          <button onClick={loadAssets} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e0d6e3] bg-white text-[10px] font-bold text-[#5c3a62] hover:border-[#91569c] transition-all">
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex-shrink-0 px-6 py-2 bg-[#faf7fb] border-b border-[#e0d6e3] flex items-center gap-1.5 overflow-x-auto">
        {types.map(t => {
          const meta = t === 'all' ? { icon: 'fa-layer-group', color: 'text-[#91569c]', label: 'All' } : getTypeMeta(t);
          const count = t === 'all' ? assets.length : assets.filter(a => a.type === t).length;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                filter === t
                  ? 'bg-[#91569c] text-white'
                  : 'bg-white border border-[#e0d6e3] text-[#5c3a62] hover:border-[#91569c]'
              }`}
            >
              <i className={`fa-solid ${meta.icon} text-[9px]`} />
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <i className="fa-solid fa-box-open text-4xl text-[#ceadd4] mb-4" />
            <p className="text-sm font-bold text-[#888] uppercase tracking-widest mb-2">No assets yet</p>
            <p className="text-xs text-[#aaa] max-w-md">
              Assets are saved when you export reports, generate images, or create videos in your projects.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-2">
            {filtered.map(asset => {
              const meta = getTypeMeta(asset.type);
              const linkedProjects = projectLinks[asset.id] || [];
              return (
                <div key={asset.id} className="bg-white rounded-xl border border-[#e0d6e3] px-5 py-3 flex items-center gap-4 hover:border-[#ceadd4] transition-colors">
                  {/* Thumbnail or type icon */}
                  <div className="w-12 h-12 rounded-lg bg-[#faf7fb] border border-[#e0d6e3] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {asset.thumbnail && (asset.thumbnail.startsWith('data:image') || asset.thumbnail.startsWith('http')) ? (
                      <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <i className={`fa-solid ${meta.icon} ${meta.color} text-lg`} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#5c3a62] truncate">{asset.name}</p>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.color} bg-[#faf7fb] border border-[#e0d6e3]`}>
                        {meta.label}
                      </span>
                    </div>
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {asset.tags.map((tag, i) => (
                          <span key={i} className="text-[8px] font-bold text-[#aaa] bg-[#f5f5f5] px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] text-[#aaa]">
                        {new Date(asset.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {linkedProjects.length > 0 && (
                        <span className="text-[9px] text-[#91569c]">
                          <i className="fa-solid fa-link text-[7px] mr-0.5" /> {linkedProjects.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {asset.filePath && (
                      <a
                        href={asset.filePath.startsWith('http') ? asset.filePath : `/api/db/assets/${asset.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#888] hover:text-[#91569c] hover:bg-[#faf7fb] transition-colors"
                        title="Open file"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                      </a>
                    )}
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#ccc] hover:text-red-400 hover:bg-red-50 transition-colors"
                      title="Delete asset"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
