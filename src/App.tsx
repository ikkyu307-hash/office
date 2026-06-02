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
    <div className="flex flex-col h-screen overflow-hidden font-mono bg-[#06070a]">
      
      {/* Top Banner Control Panel */}
      <header className="h-16 border-b border-[var(--border-color)] bg-[rgba(25,27,44,0.4)] backdrop-blur px-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[rgba(0,240,255,0.15)] border border-[var(--accent-cyan)] flex items-center justify-center font-bold text-[var(--accent-cyan)] text-sm tracking-widest shadow-[0_0_10px_rgba(0,240,255,0.3)]">
            VO
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[var(--accent-cyan)] tracking-wider">VIRTUAL OFFICE RPG</h1>
            <span className="text-[9px] text-zinc-500 uppercase leading-none">Living Workspace Integration</span>
          </div>
        </div>

        {/* Database Connection Toggles & API state info */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-ping"></span>
            <span className="text-zinc-500 text-[10px]">Database:</span>
            <span className="bg-[rgba(57,255,20,0.1)] text-[var(--accent-green)] border border-[rgba(57,255,20,0.2)] px-2 py-0.5 rounded text-[10px] uppercase font-bold">
              {dbService.isSupabaseEnabled() ? 'Live Supabase' : 'Local Sandbox Mode'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[10px]">AI Secretary:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
              apiKeyInput || dbService.getGeminiApiKey()
                ? 'bg-[rgba(0,240,255,0.1)] text-[var(--accent-cyan)] border-[rgba(0,240,255,0.2)]'
                : 'bg-red-950 text-red-400 border-red-800'
            }`}>
              {apiKeyInput || dbService.getGeminiApiKey() ? 'OpenAI Online' : 'Key Missing'}
            </span>
          </div>

          <button onClick={() => setShowSettings(true)} className="btn-retro flex gap-1">
            <Settings size={14} /> <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Screen Grid */}
      <main className="flex-1 dashboard-grid">
        
        {/* Game Map Column (Left Panel) */}
        <section className="flex flex-col gap-4">
          
          {/* Main Top Header Area */}
          <div className="hud-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[rgba(25,27,44,0.2)] border border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-[var(--accent-cyan)] bg-[#121323] flex items-center justify-center text-lg overflow-hidden shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                👤
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                  <span>{currentProfile?.nickname || currentProfile?.name}</span>
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

            {/* Dropdown status update & customization controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono">My Status:</span>
                <select
                  value={currentProfile?.status || 'Available'}
                  onChange={handleStatusChange}
                  className="input-retro text-xs cursor-pointer py-1 bg-[#10121e]"
                >
                  <option value="Available">Available</option>
                  <option value="Focus Mode">Focus Mode</option>
                  <option value="In a Meeting">In a Meeting</option>
                  <option value="Away From Keyboard">Away From Keyboard</option>
                  <option value="Resting">Resting</option>
                </select>
              </div>

              <button onClick={() => setShowCustomizer(true)} className="btn-retro border-[var(--accent-magenta)] text-[var(--accent-magenta)] flex gap-1.5 py-1">
                <User size={12} /> <span>Customize Avatar</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,6,10,0.8)] backdrop-blur-sm p-4">
          <div className="hud-panel w-full max-w-md border-2 border-[var(--border-color)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[rgba(25,27,44,0.5)] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[var(--accent-cyan)] flex items-center gap-1.5">
                ⚙️ SYSTEM SETTINGS
              </h2>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                  <Key size={12} /> OpenAI API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="sk-proj-..."
                  className="input-retro text-xs w-full"
                  required
                />
                <span className="text-[9px] text-zinc-600 leading-normal">
                  Your API key is used directly from your browser client to generate chat completions and vector memory embeddings. It is never stored on external servers.
                </span>
              </div>

              {saveSuccess && (
                <div className="text-xs text-[var(--accent-green)] font-mono flex items-center gap-1.5">
                  <Check size={12} /> Settings saved successfully!
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
