import React, { useState } from 'react';
import { ConceptIdea, ProjectBrief } from '../types';

interface IdeaFactoryProps {
  brief: ProjectBrief;
  ideas: ConceptIdea[];
  isGenerating: boolean;
  onGenerateIdeas: () => void;
  onAcceptIdea: (idea: ConceptIdea) => void;
  onRejectIdea: (id: string) => void;
  onBack: () => void;
}

const IdeaCard: React.FC<{
  idea: ConceptIdea;
  onAccept: () => void;
  onReject: () => void;
}> = ({ idea, onAccept, onReject }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-[#B0B0B0] border rounded-xl overflow-hidden transition-all duration-300 ${
        idea.status === 'rejected'
          ? 'border-red-500/30 opacity-40'
          : idea.status === 'accepted'
          ? 'border-[#E6C01F] shadow-[0_0_20px_rgba(230,192,31,0.15)]'
          : 'border-gray-600/80 hover:border-[#E6C01F]/30'
      }`}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wide leading-tight flex-1">
            {idea.title}
          </h4>
          {idea.status === 'accepted' && (
            <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider bg-[#E6C01F] text-black px-2 py-0.5 rounded-full">
              Selected
            </span>
          )}
          {idea.status === 'rejected' && (
            <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              Rejected
            </span>
          )}
        </div>

        <p className="text-[11px] text-[#0d0d0d] leading-relaxed">{idea.summary}</p>

        {expanded && (
          <div className="space-y-2 pt-2 border-t border-[#8A8A8A]/50 animate-fade-in">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[#0d0d0d]/60">Key Scenes</span>
              <p className="text-[11px] text-[#0d0d0d] leading-relaxed mt-0.5">{idea.keyScenes}</p>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[#0d0d0d]/60">Visual Style</span>
              <p className="text-[11px] text-[#0d0d0d] leading-relaxed mt-0.5">{idea.visualStyle}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] font-black uppercase tracking-wider text-[#E6C01F]/80 hover:text-[#E6C01F] transition-colors"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
          <div className="flex-1" />
          {idea.status === 'pending' && (
            <>
              <button
                onClick={onReject}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#5A5A5A] text-[#D7D7D7] border border-[#6A6A6A] hover:border-red-500/50 hover:text-red-400 transition-colors"
              >
                <i className="fa-solid fa-xmark mr-1"></i> Reject
              </button>
              <button
                onClick={onAccept}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#E6C01F] text-black hover:bg-[#E6C01F]/90 transition-colors active:scale-95"
              >
                <i className="fa-solid fa-check mr-1"></i> Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const IdeaFactory: React.FC<IdeaFactoryProps> = ({
  brief,
  ideas,
  isGenerating,
  onGenerateIdeas,
  onAcceptIdea,
  onRejectIdea,
  onBack,
}) => {
  const hasAccepted = ideas.some((i) => i.status === 'accepted');
  const allRejected = ideas.length > 0 && ideas.every((i) => i.status === 'rejected');
  const pendingCount = ideas.filter((i) => i.status === 'pending').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Brief Summary */}
        <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-file-lines text-[#E6C01F]"></i>
              Brief Summary
            </h3>
            <button
              onClick={onBack}
              className="text-[9px] font-black uppercase tracking-wider text-[#E6C01F]/80 hover:text-[#E6C01F] transition-colors"
            >
              <i className="fa-solid fa-pen mr-1"></i> Edit Brief
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[#0d0d0d]">
            <div><span className="font-bold uppercase text-[#0d0d0d]/60">Type:</span> {brief.videoType}</div>
            <div><span className="font-bold uppercase text-[#0d0d0d]/60">Format:</span> {brief.format}</div>
            <div><span className="font-bold uppercase text-[#0d0d0d]/60">Duration:</span> {brief.duration}</div>
            <div><span className="font-bold uppercase text-[#0d0d0d]/60">Tone:</span> {brief.tone}</div>
          </div>
          <p className="text-[10px] text-[#0d0d0d]/80 mt-2 line-clamp-2">{brief.videoConcept}</p>
        </div>

        {/* Status */}
        {ideas.length === 0 && !isGenerating && (
          <div className="text-center py-12 space-y-4 opacity-40">
            <i className="fa-solid fa-lightbulb text-6xl text-[#D7D7D7]"></i>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#D7D7D7]">
              Ready to generate ideas
            </p>
            <p className="text-[10px] text-[#D7D7D7] max-w-xs mx-auto">
              AI will create 5 unique video concepts based on your brief. Accept the one you like or generate more.
            </p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-12 space-y-4 animate-pulse">
            <i className="fa-solid fa-gears fa-spin text-5xl text-[#E6C01F]"></i>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#D7D7D7]">
              Generating concepts...
            </p>
            <p className="text-[10px] text-[#D7D7D7]">Multiple AI models are brainstorming ideas</p>
          </div>
        )}

        {/* Idea Cards */}
        {ideas.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wide">
                <i className="fa-solid fa-lightbulb text-[#E6C01F] mr-2"></i>
                Concepts ({ideas.length})
              </h3>
              {pendingCount > 0 && (
                <span className="text-[9px] font-bold text-[#0d0d0d]/60 uppercase">
                  {pendingCount} pending
                </span>
              )}
            </div>
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onAccept={() => onAcceptIdea(idea)}
                onReject={() => onRejectIdea(idea.id)}
              />
            ))}
          </div>
        )}

        {allRejected && !isGenerating && (
          <div className="text-center py-6 space-y-2">
            <p className="text-[11px] text-[#D7D7D7]">All ideas rejected. Generate 5 more?</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-600/60 bg-[#5A5A5A] flex-shrink-0 space-y-2">
        {!hasAccepted && (
          <button
            onClick={onGenerateIdeas}
            disabled={isGenerating}
            className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
              isGenerating
                ? 'bg-[#B0B0B0]/50 text-[#0d0d0d]/40 cursor-not-allowed'
                : 'bg-[#E6C01F] hover:bg-[#E6C01F]/90 text-black'
            }`}
          >
            {isGenerating ? (
              <span><i className="fa-solid fa-spinner fa-spin mr-2"></i>Generating...</span>
            ) : ideas.length === 0 ? (
              <span><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Generate 5 Ideas</span>
            ) : (
              <span><i className="fa-solid fa-rotate mr-2"></i>Generate 5 More</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
