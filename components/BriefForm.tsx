import React, { useState } from 'react';
import { ProjectBrief } from '../types';

export interface VideoSuggestion {
  title: string;
  url: string;
  why: string;
}

interface BriefFormProps {
  brief: ProjectBrief;
  onChange: (brief: ProjectBrief) => void;
  onSubmit: () => void;
  onSearchVideos: (brief: ProjectBrief) => Promise<VideoSuggestion[]>;
}

const VIDEO_TYPES = [
  { value: 'explainer', label: 'Explainer' },
  { value: 'promo', label: 'Promo / Ad' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'brand', label: 'Brand Story' },
  { value: 'product', label: 'Product Showcase' },
];

const FORMATS = [
  { value: '9:16', label: '9:16 (YT Short, TT, IG)' },
  { value: '16:9', label: '16:9 (YT, Website)' },
  { value: '1:1', label: '1:1 (Square)' },
];

const DURATIONS = [
  { value: '1.5min', label: '1.5 min (Short form)' },
  { value: '3min', label: '3 min (Long form)' },
];

const TONES = [
  { value: 'warm', label: 'Warm & Emotional' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'inspirational', label: 'Inspirational' },
];

const Field: React.FC<{
  label: string;
  icon: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, icon, children, hint }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
      <i className={`fa-solid ${icon} text-[#E6C01F] text-xs`}></i>
      {label}
    </label>
    {hint && <p className="text-[9px] text-[#0d0d0d]/60 leading-relaxed">{hint}</p>}
    {children}
  </div>
);

const inputClass =
  'w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#E6C01F]/50 outline-none text-[#0d0d0d] placeholder:text-[#0d0d0d]/50';

const selectClass =
  'w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#E6C01F]/50 outline-none text-[#0d0d0d] appearance-none cursor-pointer';

export const BriefForm: React.FC<BriefFormProps> = ({ brief, onChange, onSubmit, onSearchVideos }) => {
  const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const update = <K extends keyof ProjectBrief>(field: K, value: ProjectBrief[K]) =>
    onChange({ ...brief, [field]: value });

  const handleSearchVideos = async () => {
    if (isSearching) return;
    setIsSearching(true);
    try {
      const results = await onSearchVideos(brief);
      setVideoSuggestions(results);
    } catch (e: any) {
      alert(`Video search failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        update('sampleVideoFile', ev.target.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isValid =
    brief.backgroundInfo.trim().length > 0 &&
    brief.promoDetails.trim().length > 0 &&
    brief.videoConcept.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-4">
          <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-building text-[#E6C01F]"></i>
            Background
          </h3>

          <Field label="Company / Project Info" icon="fa-briefcase" hint="Who you are, what you do, context for the video.">
            <textarea
              value={brief.backgroundInfo}
              onChange={(e) => update('backgroundInfo', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              rows={3}
              className={inputClass + ' resize-y min-h-[4rem]'}
              placeholder="e.g. Our Company operates the NEXT kidswear stores in Bulgaria and Greece..."
            />
          </Field>

          <Field label="Promo Details" icon="fa-bullhorn" hint="Key messages, features, benefits to highlight.">
            <textarea
              value={brief.promoDetails}
              onChange={(e) => update('promoDetails', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              rows={4}
              className={inputClass + ' resize-y min-h-[5rem]'}
              placeholder="1. Main message / purpose of the video&#10;2. Additional features&#10;3. Special offers or benefits..."
            />
          </Field>
        </div>

        <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-4">
          <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-film text-[#E6C01F]"></i>
            Video Concept
          </h3>

          <Field label="Concept / Story" icon="fa-book-open" hint="Describe the story arc, characters, key moments.">
            <textarea
              value={brief.videoConcept}
              onChange={(e) => update('videoConcept', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              rows={4}
              className={inputClass + ' resize-y min-h-[5rem]'}
              placeholder="The video should show the life of a young woman called Anna..."
            />
          </Field>

          <Field label="Proof / Claims" icon="fa-certificate" hint="What makes the claim believable?">
            <textarea
              value={brief.proof}
              onChange={(e) => update('proof', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              rows={2}
              className={inputClass + ' resize-y min-h-[3rem]'}
              placeholder="Best clothes for the child, beautiful designs, premium quality..."
            />
          </Field>
        </div>

        <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-4">
          <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-sliders text-[#E6C01F]"></i>
            Specifications
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Video Type" icon="fa-video">
              <select
                value={brief.videoType}
                onChange={(e) => update('videoType', e.target.value as ProjectBrief['videoType'])}
                className={selectClass}
              >
                {VIDEO_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Format" icon="fa-crop">
              <select
                value={brief.format}
                onChange={(e) => update('format', e.target.value as ProjectBrief['format'])}
                className={selectClass}
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Duration" icon="fa-clock">
              <select
                value={brief.duration}
                onChange={(e) => update('duration', e.target.value as ProjectBrief['duration'])}
                className={selectClass}
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Tone" icon="fa-palette">
              <select
                value={brief.tone}
                onChange={(e) => update('tone', e.target.value as ProjectBrief['tone'])}
                className={selectClass}
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-4">
          <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-bullseye text-[#E6C01F]"></i>
            Audience & Action
          </h3>

          <Field label="Call to Action" icon="fa-hand-pointer" hint="What should the viewer do?">
            <input
              type="text"
              value={brief.cta}
              onChange={(e) => update('cta', e.target.value)}
              className={inputClass}
              placeholder="e.g. Tell your friends and family to buy you gift cards"
            />
          </Field>

          <Field label="Target Audience" icon="fa-users" hint="Who is this video for?">
            <input
              type="text"
              value={brief.targetAudience}
              onChange={(e) => update('targetAudience', e.target.value)}
              className={inputClass}
              placeholder="e.g. Parents of kids 0–10, expecting parents"
            />
          </Field>

          <Field label="Offer / Unique Benefit" icon="fa-gift">
            <input
              type="text"
              value={brief.offer}
              onChange={(e) => update('offer', e.target.value)}
              className={inputClass}
              placeholder="e.g. €10 gift voucher for new mums, €5 birthday voucher"
            />
          </Field>
        </div>

        <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-4">
          <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-link text-[#E6C01F]"></i>
            Reference
          </h3>

          <Field label="Sample Video URL" icon="fa-globe" hint="Link to an existing video for style/tone reference.">
            <input
              type="url"
              value={brief.sampleVideoUrl}
              onChange={(e) => update('sampleVideoUrl', e.target.value)}
              className={inputClass}
              placeholder="https://youtube.com/watch?v=..."
            />
          </Field>

          <Field label="Find Similar Videos" icon="fa-magnifying-glass" hint="AI will suggest YouTube videos similar to your concept.">
            <button
              type="button"
              onClick={handleSearchVideos}
              disabled={isSearching || (!brief.videoConcept.trim() && !brief.promoDetails.trim())}
              className={`w-full py-2.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isSearching || (!brief.videoConcept.trim() && !brief.promoDetails.trim())
                  ? 'bg-[#5A5A5A]/50 text-[#0d0d0d]/30 cursor-not-allowed'
                  : 'bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858]'
              }`}
            >
              {isSearching ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Searching...</>
              ) : (
                <><i className="fa-solid fa-robot"></i> Search for Sample Videos</>
              )}
            </button>

            {videoSuggestions.length > 0 && (
              <div className="space-y-2 mt-2">
                {videoSuggestions.map((v, i) => (
                  <div
                    key={i}
                    className="bg-[#5A5A5A]/30 border border-[#8A8A8A]/50 rounded-lg p-2.5 space-y-1 group hover:border-[#E6C01F]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-[#E6C01F] hover:text-[#E6C01F]/80 leading-tight block truncate"
                        >
                          <i className="fa-brands fa-youtube mr-1 text-red-500"></i>
                          {v.title}
                        </a>
                        <p className="text-[9px] text-[#0d0d0d]/60 leading-relaxed mt-0.5">{v.why}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('sampleVideoUrl', v.url)}
                        className="flex-shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded bg-[#E6C01F]/20 text-[#0d0d0d] hover:bg-[#E6C01F]/40 transition-colors"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field label="Upload Sample Video" icon="fa-upload">
            <div className="relative">
              <input
                type="file"
                id="brief-sample-video"
                className="hidden"
                accept="video/*"
                onChange={handleVideoFileUpload}
              />
              <label
                htmlFor="brief-sample-video"
                className={`flex items-center gap-3 w-full p-3 rounded-lg border border-dashed transition-all cursor-pointer ${
                  brief.sampleVideoFile
                    ? 'border-[#E6C01F]/50 bg-[#E6C01F]/10 text-[#0d0d0d]'
                    : 'border-[#8A8A8A] bg-[#B0B0B0] text-[#0d0d0d]/60 hover:border-[#E6C01F]/40'
                }`}
              >
                <i className={`fa-solid ${brief.sampleVideoFile ? 'fa-check-circle text-[#E6C01F]' : 'fa-cloud-arrow-up'}`}></i>
                <span className="text-[10px] font-bold uppercase">
                  {brief.sampleVideoFile ? 'Video attached' : 'Choose file'}
                </span>
              </label>
            </div>
          </Field>
        </div>
      </div>

      <div className="p-4 border-t border-gray-600/60 bg-[#5A5A5A] flex-shrink-0">
        <button
          onClick={onSubmit}
          disabled={!isValid}
          className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
            isValid
              ? 'bg-[#E6C01F] hover:bg-[#E6C01F]/90 text-black'
              : 'bg-[#B0B0B0]/50 text-[#0d0d0d]/40 cursor-not-allowed'
          }`}
        >
          <i className="fa-solid fa-arrow-right mr-2"></i>
          Submit Brief & Generate Ideas
        </button>
      </div>
    </div>
  );
};
