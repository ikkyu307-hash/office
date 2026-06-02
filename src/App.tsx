import { useState, useEffect } from 'react';
import type { EmployeeProfile } from './types';
import { dbService } from './lib/supabaseClient';
import { GameEngine } from './components/GameEngine';
import { AvatarCustomizer } from './components/AvatarCustomizer';
import { AiSecretary } from './components/AiSecretary';
import { OfficeSimulator } from './lib/OfficeSimulator';
import { Settings, User, Key, Check } from 'lucide-react';

function App() {
  const [currentProfile, setCurrentProfile] = useState<EmployeeProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<EmployeeProfile[]>([]);
  const [currentZone, setCurrentZone] = useState<'desk' | 'meeting' | 'break' | 'hallway'>('hallway');
  
  // Customizer modal open state
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings configuration state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Meeting Room transcript buffer
  const [meetingTranscript, setMeetingTranscript] = useState('');

  // Initialize player profile
  useEffect(() => {
    const initPlayer = async () => {
      // Check if profile exists, otherwise load defaults
      const profiles = await dbService.getProfiles();
      let player = profiles.find(p => p.id === 'user-id-123');
      
      if (!player) {
        // Create initial default profile
        const newPlayer: EmployeeProfile = {
          id: 'user-id-123',
          name: 'Johnny Pixel',
          nickname: 'Johnny',
          department: 'Tech',
          position: 'Developer',
          status: 'Available',
          skin_tone_id: 1,
          hair_style_id: 2,
          hair_color_hex: '#dfa62a',
          outfit_id: 2,
          accessory_id: 1,
          x: 120,
          y: 160
        };
        player = await dbService.insertProfile(newPlayer);
      }
      setCurrentProfile(player);
      
      // Load other profiles
      const list = await dbService.getProfiles();
      setAllProfiles(list);
    };

    initPlayer();

    // Subscribe to profile coordinate/avatar changes
    const subscription = dbService.subscribeToProfiles((updatedList) => {
      setAllProfiles(prev => {
        // Keep bot profiles unchanged if they are simulated locally
        const bots = prev.filter(p => p.id.startsWith('bot-'));
        const players = updatedList.filter(p => !p.id.startsWith('bot-'));
        
        // Update player
        const player = players.find(p => p.id === 'user-id-123');
        if (player) {
          setCurrentProfile(player);
        }

        return [...players, ...bots];
      });
    });

    // Load saved API Key in input field
    setApiKeyInput(dbService.getGeminiApiKey());

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Simulator bot coordinates updates loop
  useEffect(() => {
    if (!currentProfile) return;

    const simulator = new OfficeSimulator();
    
    // Spawns and starts bots coordination tick (every 300ms)
    const interval = setInterval(() => {
      setAllProfiles(prev => {
        const updatedBots = simulator.tick((line) => {
          // Meeting Room transcript buffer accumulator
          setMeetingTranscript(prevTrans => prevTrans + '\n' + line);
        });

        const player = prev.find(p => p.id === 'user-id-123') || currentProfile;
        if (!player) return updatedBots;

        return [player, ...updatedBots];
      });
    }, 300);

    return () => clearInterval(interval);
  }, [currentProfile?.id]);

  // Handler for direct manual status change dropdown
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!currentProfile) return;
    const nextStatus = e.target.value as EmployeeProfile['status'];
    const updated = await dbService.updateProfile({
      id: currentProfile.id,
      status: nextStatus
    });
    setCurrentProfile(updated);
  };

  // Settings Save Handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.setGeminiApiKey(apiKeyInput); // save key to localStorage
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSettings(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-mono bg-[#06070a] animate-grid-scan">
      
      {/* Top Floating HUD Control Panel */}
      <header className="hud-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[rgba(0,240,255,0.15)] border border-[var(--accent-cyan)] flex items-center justify-center font-bold text-[var(--accent-cyan)] text-sm tracking-widest shadow-[0_0_12px_rgba(0,240,255,0.4)]">
            VO
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[var(--accent-cyan)] tracking-wider font-hud">VIRTUAL OFFICE RPG</h1>
            <span className="text-[9px] text-zinc-500 uppercase leading-none block mt-0.5">Living Workspace Integration</span>
          </div>
        </div>

        {/* Database Connection Toggles & API state info */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-ping"></span>
            <span className="text-zinc-500 text-[10px]">Database:</span>
            <span className="bg-[rgba(57,255,20,0.1)] text-[var(--accent-green)] border border-[rgba(57,255,20,0.25)] px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
              {dbService.isSupabaseEnabled() ? 'Live Supabase' : 'Local Sandbox Mode'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[10px]">AI Secretary:</span>
            <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold border tracking-wider ${
              apiKeyInput || dbService.getGeminiApiKey()
                ? 'bg-[rgba(0,240,255,0.1)] text-[var(--accent-cyan)] border-[rgba(0,240,255,0.25)] shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'bg-red-950 text-red-400 border-red-800'
            }`}>
              {apiKeyInput || dbService.getGeminiApiKey() ? 'OpenAI Online' : 'Key Missing'}
            </span>
          </div>

          <button onClick={() => setShowSettings(true)} className="btn-retro flex gap-1.5 py-1">
            <Settings size={13} /> <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Screen Grid */}
      <main className="flex-1 dashboard-grid">
        
        {/* Game Map Column (Left Panel) */}
        <section className="flex flex-col gap-4">
          
          {/* Main Top Header Area with Vitals */}
          <div className="hud-panel p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-[rgba(25,27,44,0.2)] border border-[var(--border-color)]">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-[var(--accent-cyan)] bg-[#121323] flex items-center justify-center text-lg overflow-hidden shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                  👤
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                    <span className="font-hud tracking-wide">{currentProfile?.nickname || currentProfile?.name}</span>
                    <span className={`status-badge ${
                      currentProfile?.status === 'Focus Mode' ? 'status-focus' :
                      currentProfile?.status === 'In a Meeting' ? 'status-meeting' :
                      currentProfile?.status === 'Away From Keyboard' ? 'status-away' :
                      currentProfile?.status === 'Resting' ? 'status-resting' :
                      'status-available'
                    } capitalize py-0.5 text-[8px] font-hud`}>
                      {currentProfile?.position}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wider">
                    {currentProfile?.department} Department
                  </div>
                </div>
              </div>

              {/* Dynamic Vitals Meters */}
              <div className="hidden sm:flex items-center gap-5 border-t xl:border-t-0 xl:border-l border-[var(--border-color)] pt-3 xl:pt-0 xl:pl-5">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-hud text-zinc-400 font-bold uppercase tracking-wider gap-3">
                    <span>Cognitive Load</span>
                    <span className="text-[var(--accent-cyan)]">65%</span>
                  </div>
                  <div className="vital-bar-container">
                    <div className="vital-bar-fill-cyan" style={{ width: '65%' }}></div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-hud text-zinc-400 font-bold uppercase tracking-wider gap-3">
                    <span>Energy Level</span>
                    <span className="text-[var(--accent-magenta)]">82%</span>
                  </div>
                  <div className="vital-bar-container">
                    <div className="vital-bar-fill-magenta" style={{ width: '82%' }}></div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-hud text-zinc-400 font-bold uppercase tracking-wider gap-3">
                    <span>Focus Battery</span>
                    <span className="text-[var(--accent-yellow)]">90%</span>
                  </div>
                  <div className="vital-bar-container">
                    <div className="vital-bar-fill-yellow" style={{ width: '90%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dropdown status update & customization controls */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono">My Status:</span>
                <select
                  value={currentProfile?.status || 'Available'}
                  onChange={handleStatusChange}
                  className="input-retro text-xs cursor-pointer py-1.5 px-3 bg-[#10121e] border-[var(--border-color)] hover:border-[var(--accent-cyan)] transition-colors rounded-lg"
                >
                  <option value="Available">Available</option>
                  <option value="Focus Mode">Focus Mode</option>
                  <option value="In a Meeting">In a Meeting</option>
                  <option value="Away From Keyboard">Away From Keyboard</option>
                  <option value="Resting">Resting</option>
                </select>
              </div>

              <button onClick={() => setShowCustomizer(true)} className="btn-retro border-[var(--accent-magenta)] text-[var(--accent-magenta)] flex gap-1.5 py-1.5">
                <User size={12} /> <span className="text-[9px]">Customize Avatar</span>
              </button>
            </div>
          </div>

          {/* Interactive HTML5 Game Canvas container */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <GameEngine
              currentProfile={currentProfile}
              onProfileUpdate={setCurrentProfile}
              onZoneChange={setCurrentZone}
              allProfiles={allProfiles}
            />
          </div>

          {/* Simulated WebRTC Call screen if inside Meeting Room zone */}
          {currentZone === 'meeting' && (
            <div className="hud-panel p-4 border border-[rgba(0,240,255,0.3)] bg-[rgba(0,240,255,0.02)] rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-center text-[10px] text-[var(--accent-cyan)] font-hud font-bold tracking-wider">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] animate-ping"></span>
                  🔊 WEBRTC CALL ACTIVE (ROOM SYNC)
                </span>
                
                {/* Speaking visualizer bars */}
                <div className="soundwave">
                  <div className="soundwave-bar"></div>
                  <div className="soundwave-bar"></div>
                  <div className="soundwave-bar"></div>
                  <div className="soundwave-bar"></div>
                  <div className="soundwave-bar"></div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {allProfiles.map(p => (
                    <div 
                      key={p.id} 
                      title={p.nickname}
                      className="w-6 h-6 rounded-full border border-[var(--border-color)] bg-[#121323] flex items-center justify-center text-[10px]"
                      style={{
                        borderColor: p.id === 'user-id-123' ? 'var(--accent-cyan)' : 'var(--border-color)'
                      }}
                    >
                      {p.nickname.substring(0, 1)}
                    </div>
                  ))}
                </div>
                <span className="text-[9px] text-zinc-500 font-mono">
                  Attendees connected: {allProfiles.map(p => p.nickname).join(', ')}
                </span>
              </div>
              
              <div className="text-[11px] text-zinc-300 font-mono bg-black/60 p-2.5 rounded border border-zinc-800 leading-normal">
                {meetingTranscript ? (
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-[9px] uppercase tracking-wider block">Real-time Translation:</span>
                    <p className="text-[var(--accent-cyan)] italic">
                      {meetingTranscript.split('\n').filter(Boolean).slice(-1)[0]}
                    </p>
                  </div>
                ) : (
                  <span className="text-zinc-600">Waiting for other employees to enter the Meeting Room to start dialogue...</span>
                )}
              </div>
            </div>
          )}

        </section>

        {/* AI Secretary Column Sidebar (Right Panel) */}
        <aside className="h-full">
          <AiSecretary
            ownerProfile={currentProfile}
            currentZone={currentZone}
            meetingTranscriptSim={meetingTranscript}
            clearMeetingTranscript={() => setMeetingTranscript('')}
          />
        </aside>

      </main>

      {/* Settings Modal Component */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,4,7,0.85)] backdrop-blur-md p-4">
          <div className="hud-panel w-full max-w-md border-2 border-[rgba(0,240,255,0.25)] overflow-hidden radar-brackets radar-bottom-brackets shadow-[0_0_40px_rgba(0,240,255,0.15)] bg-[rgba(9,11,18,0.95)]">
            <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[rgba(25,27,44,0.6)] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[var(--accent-cyan)] flex items-center gap-2 font-hud tracking-widest">
                ⚙️ SYSTEM SETTINGS
              </h2>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase flex items-center gap-1.5">
                  <Key size={11} className="text-[var(--accent-cyan)]" /> OpenAI API Key (Mainframe Link)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="sk-proj-..."
                    className="input-retro text-xs w-full pr-10 border-[var(--border-color)] focus:border-[var(--accent-magenta)] focus:shadow-[0_0_12px_rgba(255,0,127,0.2)]"
                    required
                  />
                  <div className="absolute right-3 top-3 flex items-center">
                    <span className={`w-2 h-2 rounded-full ${apiKeyInput ? 'bg-[var(--accent-cyan)] shadow-[0_0_6px_var(--accent-cyan)]' : 'bg-red-500'}`}></span>
                  </div>
                </div>
                <span className="text-[9px] text-zinc-500 leading-normal font-mono">
                  Your OpenAI token is stored locally in your browser's context. It is used directly to execute agent tool tasks and pgvector embeddings.
                </span>
              </div>

              {saveSuccess && (
                <div className="text-xs text-[var(--accent-green)] font-mono flex items-center gap-1.5 bg-[rgba(57,255,20,0.05)] border border-[rgba(57,255,20,0.15)] p-2 rounded">
                  <Check size={12} /> Key validated and synced to system.
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="btn-retro text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-retro text-xs border-[var(--accent-cyan)] text-[var(--accent-cyan)]"
                >
                  Save Keys
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Customize Modal Component */}
      {showCustomizer && currentProfile && (
        <AvatarCustomizer
          profile={currentProfile}
          onClose={() => setShowCustomizer(false)}
          onSave={(updated) => {
            setCurrentProfile(updated);
            setShowCustomizer(false);
          }}
        />
      )}

    </div>
  );
}

export default App;
