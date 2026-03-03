import React, { useState, useEffect } from 'react';
import { DB, type Project, type CharacterAsset, type SceneryAsset, type ClothingAsset } from '../services/projectDB';

interface ProjectsScreenProps {
  onSelectProject: (project: Project) => void;
  onBack: () => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ onSelectProject, onBack }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [characters, setCharacters] = useState<CharacterAsset[]>([]);
  const [scenery, setScenery] = useState<SceneryAsset[]>([]);
  const [clothing, setClothing] = useState<ClothingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await DB.load();
      setProjects(db.projects || []);
      setCharacters(db.characters || []);
      setScenery(db.scenery || []);
      setClothing(db.clothing || []);
    } catch (e) {
      console.error('[ProjectsScreen] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? Files on disk will remain.')) return;
    await DB.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const getLinkedNames = (ids: string[], list: { id: string; name: string }[]) =>
    ids.map(id => list.find(x => x.id === id)?.name).filter(Boolean);

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-500';
    if (s === 'completed') return 'bg-blue-400';
    return 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#5A5A5A]">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-[#91569c]"></i>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#5A5A5A] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-600/60">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[#91569c]/80 hover:text-[#91569c] transition-colors p-1">
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <h2 className="text-lg font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-folder-open text-[#91569c]"></i>
            Projects
          </h2>
          <span className="text-[10px] text-[#d4cdd7]/60 font-bold uppercase tracking-wider">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="text-center py-20 opacity-40">
            <i className="fa-solid fa-folder-plus text-6xl text-[#d4cdd7] mb-4 block"></i>
            <p className="text-[#d4cdd7] font-bold uppercase tracking-wider text-sm">No projects yet</p>
            <p className="text-[#d4cdd7]/60 text-xs mt-2">Create a project from the dashboard to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {projects.map(p => {
              const isExpanded = expandedId === p.id;
              const charNames = getLinkedNames(p.characterIds || [], characters);
              const sceneryNames = getLinkedNames(p.sceneryIds || [], scenery);
              const clothingNames = getLinkedNames(p.clothingIds || [], clothing);
              const totalAssets = (p.characterIds?.length || 0) + (p.sceneryIds?.length || 0) +
                (p.clothingIds?.length || 0) + (p.conceptIds?.length || 0) +
                (p.imageIds?.length || 0) + (p.videoIds?.length || 0);

              return (
                <div key={p.id} className="bg-[#3d3444] border border-gray-600/80 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#A0A0A0] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor(p.status)}`}></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate">{p.name}</h3>
                      <p className="text-[10px] text-[#edecec]/60 mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString()} · {totalAssets} asset{totalAssets !== 1 ? 's' : ''} linked
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectProject(p); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-[#5A5A5A] text-white border border-[#4a3a52] hover:bg-[#484848] transition-colors"
                      >
                        Open
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        className="p-1.5 rounded-lg text-[#edecec]/40 hover:text-red-500 transition-colors"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                      <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[#edecec]/40 text-xs`}></i>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-600/40 pt-3 space-y-3">
                      {p.description && (
                        <p className="text-[11px] text-[#edecec]/80">{p.description}</p>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <AssetGroup label="Characters" icon="fa-user" items={charNames as string[]} />
                        <AssetGroup label="Scenery" icon="fa-mountain-sun" items={sceneryNames as string[]} />
                        <AssetGroup label="Clothing" icon="fa-shirt" items={clothingNames as string[]} />
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <Stat label="Concepts" count={p.conceptIds?.length || 0} icon="fa-lightbulb" />
                        <Stat label="Images" count={p.imageIds?.length || 0} icon="fa-image" />
                        <Stat label="Videos" count={p.videoIds?.length || 0} icon="fa-video" />
                      </div>
                      {p.notes && (
                        <div className="bg-[#5A5A5A]/30 rounded-lg p-3">
                          <p className="text-[10px] text-[#edecec]/60 font-bold uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-[11px] text-[#edecec]/80 whitespace-pre-wrap">{p.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const AssetGroup: React.FC<{ label: string; icon: string; items: string[] }> = ({ label, icon, items }) => (
  <div className="bg-[#5A5A5A]/20 rounded-lg p-2.5">
    <p className="text-[9px] font-bold text-[#edecec]/50 uppercase tracking-wider flex items-center gap-1 mb-1.5">
      <i className={`fa-solid ${icon} text-[#91569c]/70`}></i> {label}
    </p>
    {items.length === 0 ? (
      <p className="text-[10px] text-[#edecec]/30 italic">None</p>
    ) : (
      <div className="flex flex-wrap gap-1">
        {items.map((name, i) => (
          <span key={i} className="text-[9px] bg-[#5A5A5A]/40 text-white px-1.5 py-0.5 rounded font-medium">{name}</span>
        ))}
      </div>
    )}
  </div>
);

const Stat: React.FC<{ label: string; count: number; icon: string }> = ({ label, count, icon }) => (
  <div className="bg-[#5A5A5A]/20 rounded-lg p-2">
    <i className={`fa-solid ${icon} text-[#91569c]/50 text-sm`}></i>
    <p className="text-lg font-bold text-white mt-1">{count}</p>
    <p className="text-[9px] text-[#edecec]/50 uppercase tracking-wider font-bold">{label}</p>
  </div>
);
