
import React from 'react';

export type TabType = 'editor' | 'board' | 'files' | 'notes' | 'people';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <>
      {/* Desktop Vertical Sidebar */}
      <div className={`hidden md:flex flex-col border-r border-white/10 bg-[#0a0a0a] w-16 shrink-0`}>
        <div className="flex-1 flex flex-col items-center py-6 gap-6">
          <SidebarItem 
            icon="fa-users" 
            active={activeTab === 'people'} 
            onClick={() => setActiveTab('people')} 
            tooltip="Participants"
          />
          <SidebarItem 
            icon="fa-code" 
            active={activeTab === 'editor'} 
            onClick={() => setActiveTab('editor')} 
            tooltip="IDE"
          />
          <SidebarItem 
            icon="fa-chalkboard" 
            active={activeTab === 'board'} 
            onClick={() => setActiveTab('board')} 
            tooltip="Whiteboard"
          />
          <SidebarItem 
            icon="fa-folder-open" 
            active={activeTab === 'files'} 
            onClick={() => setActiveTab('files')} 
            tooltip="Files"
          />
          <SidebarItem 
            icon="fa-sticky-note" 
            active={activeTab === 'notes'} 
            onClick={() => setActiveTab('notes')} 
            tooltip="Notes"
          />
        </div>
        <div className="p-4 flex flex-col items-center gap-4">
          <SidebarItem icon="fa-cog" tooltip="Settings" />
        </div>
      </div>

      {/* Mobile Bottom Sidebar/Nav */}
      <div className="md:hidden flex h-14 border-t border-white/10 bg-[#0a0a0a] w-full shrink-0 z-50 fixed bottom-0 left-0 justify-around items-center px-4">
        <SidebarItem 
          icon="fa-users" 
          active={activeTab === 'people'} 
          onClick={() => setActiveTab('people')} 
        />
        <SidebarItem 
          icon="fa-code" 
          active={activeTab === 'editor'} 
          onClick={() => setActiveTab('editor')} 
        />
        <SidebarItem 
          icon="fa-chalkboard" 
          active={activeTab === 'board'} 
          onClick={() => setActiveTab('board')} 
        />
        <SidebarItem 
          icon="fa-folder-open" 
          active={activeTab === 'files'} 
          onClick={() => setActiveTab('files')} 
        />
        <SidebarItem 
          icon="fa-sticky-note" 
          active={activeTab === 'notes'} 
          onClick={() => setActiveTab('notes')} 
        />
      </div>
    </>
  );
};

const SidebarItem = ({ icon, active, onClick, tooltip }: { icon: string; active?: boolean; onClick?: () => void; tooltip?: string }) => (
  <button 
    onClick={onClick}
    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative shrink-0 ${
      active ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-white hover:bg-white/5'
    }`}
  >
    <i className={`fas ${icon} text-sm md:text-base`}></i>
    {tooltip && (
      <div className="absolute left-full ml-4 hidden md:group-hover:block z-50 whitespace-nowrap bg-indigo-600 text-white text-[9px] font-bold px-2 py-1 rounded shadow-xl uppercase tracking-widest">
        {tooltip}
      </div>
    )}
  </button>
);

export default Sidebar;
