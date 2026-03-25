import React, { useState } from 'react';

export type SidebarScreen = 'landing' | 'templates' | 'assets' | 'project-settings' | string;

interface SidebarProps {
  currentScreen: SidebarScreen;
  onNavigate: (screen: string) => void;
  /** Called specifically when user clicks Templates (may need special handling) */
  onTemplates?: () => void;
}

const LOGO_SOURCES = ['/logo-secondary.png', '/logo-main.png', '/logo.png'];

const SidebarLogo: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const tryNext = () => {
    if (srcIndex + 1 < LOGO_SOURCES.length) setSrcIndex(i => i + 1);
    else setImgFailed(true);
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center py-4 mb-2 hover:bg-[#f6f0f8] transition-colors"
      title="TensorAx Studio"
    >
      {imgFailed ? (
        <div className="w-8 h-8 rounded-lg bg-[#91569c] flex items-center justify-center">
          <span className="text-white font-black text-xs">TX</span>
        </div>
      ) : (
        <img
          src={LOGO_SOURCES[srcIndex]}
          alt="TensorAx"
          className="h-8 w-8 object-contain"
          onError={tryNext}
        />
      )}
    </button>
  );
};

/** Studio icon — geometric hexagonal arrow matching the TensorAx brand mark */
const StudioIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 390 440" fill="currentColor" className={className}>
    {/* Top chevron */}
    <polygon points="195,0 390,110 330,110 195,35 60,110 0,110" />
    {/* Left pillar */}
    <polygon points="60,140 140,140 140,380 105,400 60,380" />
    {/* Center pillar */}
    <polygon points="165,170 225,170 225,420 195,440 165,420" />
    {/* Right pillar */}
    <polygon points="250,140 330,140 330,380 285,400 250,380" />
  </svg>
);

interface NavItem {
  id: string;
  label: string;
  icon: string;
  screen: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'studio',    label: 'Studio',    icon: 'fa-terminal', screen: 'studio' },
  { id: 'projects',  label: 'Projects',  icon: 'fa-folder-open', screen: 'projects' },
  { id: 'templates', label: 'Templates', icon: 'fa-shapes',   screen: 'templates' },
  { id: 'assets',    label: 'Assets',    icon: 'fa-images',   screen: 'assets' },
  { id: 'settings',  label: 'Settings',  icon: 'fa-gear',     screen: 'settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, onTemplates }) => {
  const isActive = (item: NavItem) => {
    if (item.screen === 'landing' && currentScreen === 'landing') return true;
    if (item.screen === 'templates' && currentScreen === 'templates') return true;
    if (item.screen === currentScreen) return true;
    return false;
  };

  return (
    <aside className="w-[72px] flex-shrink-0 h-full bg-white border-r border-[#e0d6e3] flex flex-col items-center select-none">
      {/* Nav items */}
      <nav className="flex-1 w-full flex flex-col items-center gap-1 px-1.5 pt-3">
        {NAV_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id === 'templates' ? 'templates' : item.screen);
              }}
              className={`w-full flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl transition-all
                ${active
                  ? 'bg-[#f6f0f8] text-[#91569c]'
                  : 'text-[#888] hover:bg-[#f6f0f8]/60 hover:text-[#5c3a62]'
                }`}
              title={item.label}
            >
              {item.id === 'studio' ? (
                <StudioIcon className="w-4 h-4" />
              ) : (
                <i className={`fa-solid ${item.icon} text-base`} />
              )}
              <span className={`text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5
                ${active ? 'text-[#91569c]' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom: User avatar */}
      <div className="w-full flex flex-col items-center gap-2 pb-4 pt-2">
        <button
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c084fc] to-[#91569c] flex items-center justify-center text-white text-[10px] font-black tracking-wide hover:shadow-md transition-shadow"
          title="User profile"
        >
          MO
        </button>
      </div>
    </aside>
  );
};
