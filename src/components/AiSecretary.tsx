import React, { useState, useEffect, useRef } from 'react';
import type { EmployeeProfile, Task, RoomBooking, KnowledgeDoc, ChatMessage, ActivityLog } from '../types';
import { dbService } from '../lib/supabaseClient';
import { openaiService } from '../lib/openaiClient';
import { MessageSquare, Calendar, Database, ClipboardList, Terminal, Send, Plus, ChevronRight, BookOpen } from 'lucide-react';

interface AiSecretaryProps {
  ownerProfile: EmployeeProfile | null;
  currentZone: 'desk' | 'meeting' | 'break' | 'hallway';
  meetingTranscriptSim: string; // Feed meeting script in real time
  clearMeetingTranscript: () => void;
}

export const AiSecretary: React.FC<AiSecretaryProps> = ({
  ownerProfile,
  currentZone,
  meetingTranscriptSim,
  clearMeetingTranscript,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'schedule' | 'knowledge' | 'logs'>('chat');
  
  // Secretary Memory logs and chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Db states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);

  // Task creation states
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  
  // Knowledge doc creation states
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');

  // Meeting Room state triggers
  const wasInMeetingRef = useRef(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load and subscribe to database tables
  useEffect(() => {
    if (!ownerProfile) return;

    // Load initial values
    const loadData = async () => {
      const profileTasks = await dbService.getTasks(ownerProfile.id);
      setTasks(profileTasks);
      
      const allBookings = await dbService.getBookings();
      setBookings(allBookings);

      const knowledgeDocs = await dbService.getKnowledge();
      setDocs(knowledgeDocs);
    };

    loadData();

    // Setup subscription listeners
    const taskSub = dbService.subscribeToTasks(async () => {
      const updated = await dbService.getTasks(ownerProfile.id);
      setTasks(updated);
    });

    const bookingSub = dbService.subscribeToBookings(async () => {
      const updated = await dbService.getBookings();
      setBookings(updated);
    });

    return () => {
      taskSub.unsubscribe();
      bookingSub.unsubscribe();
    };
  }, [ownerProfile?.id]);

  // Initial welcome greeting
  useEffect(() => {
    if (!ownerProfile) return;
    setChatMessages([
      {
        id: 'welcome',
        sender: 'secretary',
        senderName: 'Secretary AI',
        text: `Welcome back, ${ownerProfile.nickname || ownerProfile.name}! I am your autonomous office secretary. Currently synced to your virtual coordinates in the **${currentZone}** as a **${ownerProfile.position}**. Ask me to create tasks, schedule meetings, or query the company handbook!`,
        timestamp: new Date()
      }
    ]);
    addLog('AI Secretary active and listening...', 'info');
  }, [ownerProfile?.id]);

  // Handle Meeting Room exit state trigger
  useEffect(() => {
    const isInMeeting = currentZone === 'meeting';
    
    // Just exited meeting zone
    if (wasInMeetingRef.current && !isInMeeting) {
      addLog(`Owner exited Meeting Room Zone. Current transcript buffer size: ${meetingTranscriptSim.length} chars.`, 'status_change');
      if (meetingTranscriptSim) {
        addLog('Meeting exit detected. Autonomous summary workflow started...', 'info');
        summarizeMeeting(meetingTranscriptSim);
      }
    }
    wasInMeetingRef.current = isInMeeting;
  }, [currentZone, meetingTranscriptSim]);

  // Helper to add activity logs
  const addLog = (text: string, type: ActivityLog['type'] = 'info') => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      timestamp: new Date(),
      type
    };
    setLogs(prev => [...prev, newLog]);
  };

  // Scroll utilities
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Summarize meeting simulation
  const summarizeMeeting = async (transcript: string) => {
    setIsTyping(true);
    addLog('Generating AI Meeting transcript analysis report...', 'tool_call');
    
    const systemPrompt = `You are the executive AI secretary for ${ownerProfile?.name}. Provide a brief summary of the conversation and list action points.`;
    
    const userPrompt = `Owner just completed a meeting. Here is the conversation log:\n\n"${transcript}"\n\nSummarize key decisions and create relevant action tasks.`;

    const result = await openaiService.runSecretaryAgent(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      ownerProfile?.id || '',
      (log) => addLog(log.text, log.type)
    );

    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'secretary',
        senderName: 'Secretary AI',
        text: `📝 **Meeting Summary:**\n\n${result.text}`,
        timestamp: new Date()
      }
    ]);
    
    clearMeetingTranscript();
    setIsTyping(false);
  };

  // Chat Submission Handler
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !ownerProfile) return;

    const userText = inputText;
    setInputText('');

    // Append user message
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'owner',
      senderName: ownerProfile.nickname || ownerProfile.name,
      text: userText,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMsg]);

    setIsTyping(true);
    addLog(`Processing query: "${userText.substring(0, 30)}..."`, 'info');

    // Build context-aware prompt
    const systemPrompt = `You are a highly efficient, autonomous retro 16-bit RPG AI Secretary bound to employee ${ownerProfile.name}.
Your job is to manage schedules, tasks, and retrieve documentation.
Current Context:
- Owner Name: ${ownerProfile.name}
- Department: ${ownerProfile.department}
- Position: ${ownerProfile.position}
- Virtual Location: ${currentZone}
- Status: ${ownerProfile.status}

You have active tools:
1. create_task(title, description, due_date, priority)
2. book_meeting_room(room_name, start_time, end_time, attendees)
3. update_employee_status(status)
4. query_company_knowledge(query)

If the owner requests status changes, bookings, or tasks, use the tools.
Be helpful, professional, and slightly conversational. Include a tiny retro pixel vibe!`;

    // Map conversation logs into LLM roles
    const history = chatMessages.slice(-8).map(m => ({
      role: (m.sender === 'secretary' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.text
    }));

    history.push({ role: 'user', content: userText });

    const response = await openaiService.runSecretaryAgent(
      systemPrompt,
      history,
      ownerProfile.id,
      (log) => addLog(log.text, log.type)
    );

    // Append response
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'secretary',
        senderName: 'Secretary AI',
        text: response.text,
        timestamp: new Date()
      }
    ]);
    setIsTyping(false);
  };

  // Inline database actions
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !ownerProfile) return;

    await dbService.insertTask({
      employee_id: ownerProfile.id,
      title: newTitle,
      description: 'Manually added via Tasks tab.',
      due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: newPriority,
      status: 'todo'
    });

    setNewTitle('');
    addLog(`Manually created task: "${newTitle}"`, 'info');
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const nextStatusMap: { [key: string]: Task['status'] } = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo'
    };
    
    const updatedStatus = nextStatusMap[task.status];
    await dbService.updateTask({
      id: task.id,
      status: updatedStatus
    });
    addLog(`Task "${task.title}" updated to status ${updatedStatus}`, 'info');
  };

  const handleUploadKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    addLog(`Computing vector embeddings for "${docTitle}"...`, 'info');
    
    // Compute embeddings using OpenAI text-embedding-3-small
    const embedding = await openaiService.generateEmbedding(docContent);

    const newDoc = await dbService.insertKnowledge({
      title: docTitle,
      content: docContent
    }, embedding);

    setDocs(prev => [...prev, newDoc]);
    setDocTitle('');
    setDocContent('');
    addLog(`Document "${docTitle}" indexed and saved into pgvector knowledge base.`, 'info');
  };

  return (
    <div className="hud-panel h-full flex flex-col border border-[var(--border-color)] overflow-hidden bg-[rgba(9,11,18,0.95)]">
      
      {/* Sidebar Tabs */}
      <div className="grid grid-cols-5 border-b border-[var(--border-color)] bg-[rgba(25,27,44,0.4)]">
        {[
          { id: 'chat', label: 'Chat', icon: MessageSquare },
          { id: 'tasks', label: 'Tasks', icon: ClipboardList },
          { id: 'schedule', label: 'Rooms', icon: Calendar },
          { id: 'knowledge', label: 'Vectors', icon: Database },
          { id: 'logs', label: 'Terminal', icon: Terminal },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 flex flex-col items-center justify-center gap-1 border-r border-[var(--border-color)] transition-all cyber-tab ${
                isActive 
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-cyan)] border-b-2 border-b-[var(--accent-cyan)] cyber-tab-active shadow-[inset_0_0_12px_rgba(0,240,255,0.05)]' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={15} />
              <span className="text-[9px] font-hud font-bold leading-none tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-[rgba(10,11,16,0.15)]">
        
        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col justify-between gap-3">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              
              {/* Secretary System Status Card */}
              <div className="p-2.5 bg-[rgba(10,12,22,0.65)] border border-[var(--border-color)] rounded-lg flex items-center justify-between text-[9px] font-mono shadow-[inset_0_0_10px_rgba(0,240,255,0.02)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse shadow-[0_0_6px_var(--accent-green)]"></span>
                  <span className="text-zinc-500">SYS:</span>
                  <span className="text-[var(--accent-green)] font-bold">ONLINE</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  <span>LATENCY: <strong className="text-zinc-300">24ms</strong></span>
                  <span>CORE: <strong className="text-zinc-300">GPT-4o-Mini</strong></span>
                </div>
              </div>

              {chatMessages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col p-3 rounded-lg holo-card transition-all ${
                    msg.sender === 'secretary' 
                      ? 'bg-[rgba(0,240,255,0.03)] border-[rgba(0,240,255,0.15)] text-zinc-200' 
                      : 'bg-[rgba(255,0,127,0.03)] border-[rgba(255,0,127,0.15)] text-zinc-200 ml-6'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`font-hud text-[9px] font-bold tracking-wider ${
                      msg.sender === 'secretary' ? 'text-[var(--accent-cyan)]' : 'text-[var(--accent-magenta)]'
                    }`}>
                      {msg.sender === 'secretary' ? '🤖 SECRETARY CORE' : `👤 ${msg.senderName.toUpperCase()}`}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-mono whitespace-pre-line leading-relaxed text-[11px]">{msg.text}</p>
                </div>
              ))}
              {isTyping && (
                <div className="text-[10px] text-[var(--accent-cyan)] font-hud font-bold tracking-wide animate-pulse flex items-center gap-1.5 pl-1">
                  <span>🤖 Computing agent pipeline...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2 bg-[rgba(10,12,22,0.4)] p-1.5 border border-[var(--border-color)] rounded-lg">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Ask: 'Assign bugfix to me' or 'Query handbook'"
                className="input-retro text-xs flex-1 border-0 focus:ring-0 bg-transparent py-1 px-2"
                disabled={isTyping}
              />
              <button
                type="submit"
                className="btn-retro p-2 border-[var(--accent-cyan)] text-[var(--accent-cyan)]"
                disabled={isTyping}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}

        {/* KANBAN TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-4 h-full">
            {/* Quick creation form */}
            <form onSubmit={handleCreateTask} className="flex flex-col gap-2 p-3 bg-[rgba(25,27,44,0.5)] border border-[rgba(0,240,255,0.1)] rounded-lg shadow-lg">
              <span className="text-[9px] font-bold text-zinc-400 font-hud tracking-wider uppercase flex items-center gap-1.5">
                <Plus size={11} className="text-[var(--accent-cyan)]" /> UPLINK NEW TASK
              </span>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Task title..."
                  className="input-retro text-[11px] py-1.5 flex-1"
                  required
                />
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as any)}
                  className="input-retro text-[10px] py-1 cursor-pointer w-20 bg-[#10121e]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Med</option>
                  <option value="high">High</option>
                </select>
                <button type="submit" className="btn-retro px-3 py-1.5 border-[var(--accent-cyan)] text-[var(--accent-cyan)]">
                  ADD
                </button>
              </div>
            </form>

            {/* Kanban Columns (Simulated) */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {['todo', 'in_progress', 'done'].map(statusName => {
                const columnTasks = tasks.filter(t => t.status === statusName);
                const titleMap: { [key: string]: string } = {
                  todo: '📋 TODO QUEUE',
                  in_progress: '⚡ IN RUNTIME',
                  done: '✅ COMPLETED'
                };
                const colorMap: { [key: string]: string } = {
                  todo: 'text-[var(--accent-cyan)]',
                  in_progress: 'text-[var(--accent-yellow)]',
                  done: 'text-[var(--accent-green)]'
                };
                const borderMap: { [key: string]: string } = {
                  todo: 'border-l-[var(--accent-cyan)] hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]',
                  in_progress: 'border-l-[var(--accent-yellow)] hover:shadow-[0_0_12px_rgba(255,234,0,0.1)]',
                  done: 'border-l-[var(--accent-green)] hover:shadow-[0_0_12px_rgba(57,255,20,0.1)]'
                };
                return (
                  <div key={statusName} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1">
                      <span className={`text-[9px] font-hud font-bold tracking-widest ${colorMap[statusName]}`}>
                        {titleMap[statusName]}
                      </span>
                      <span className="text-[9px] bg-zinc-800 text-zinc-400 font-bold px-1.5 py-0.5 rounded-full font-mono">{columnTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {columnTasks.length === 0 ? (
                        <div className="text-[9px] text-zinc-600 font-mono py-3 border border-dashed border-[var(--border-color)] rounded-lg text-center">
                          Queue Empty
                        </div>
                      ) : (
                        columnTasks.map(task => (
                          <div 
                            key={task.id} 
                            onClick={() => handleToggleTaskStatus(task)}
                            className={`p-3 bg-[rgba(25,27,44,0.25)] border border-[var(--border-color)] border-l-2 ${borderMap[statusName]} transition-all rounded-lg cursor-pointer flex justify-between items-center text-[11px] font-mono group holo-card`}
                          >
                            <div className="flex flex-col">
                              <span className="text-zinc-200 group-hover:text-white font-bold transition-colors">
                                {task.title}
                              </span>
                              {task.due_date && (
                                <span className="text-[8px] text-zinc-500 mt-1">Due: {task.due_date}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[7px] px-1 py-0.5 rounded uppercase font-bold tracking-wider ${
                                task.priority === 'high' ? 'bg-red-950/60 text-red-400 border border-red-900/50' :
                                task.priority === 'medium' ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/50' :
                                'bg-zinc-800/60 text-zinc-400'
                              }`}>
                                {task.priority}
                              </span>
                              <ChevronRight size={10} className="text-zinc-500 group-hover:text-zinc-300" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ROOM BOOKINGS TAB */}
        {activeTab === 'schedule' && (
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            <span className="text-[9px] font-hud font-bold tracking-widest text-zinc-400 uppercase mb-2 block">
              📅 SYSTEM ROOM RESERVATIONS
            </span>
            {bookings.length === 0 ? (
              <div className="text-xs text-zinc-500 font-mono p-4 text-center">
                No active meeting bookings.
              </div>
            ) : (
              bookings.map(book => (
                <div key={book.id} className="p-3.5 bg-[rgba(0,240,255,0.02)] border border-[rgba(0,240,255,0.12)] rounded-lg flex flex-col gap-2 text-[11px] font-mono holo-card">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--accent-cyan)] font-bold tracking-wider font-hud text-[10px]">{book.room_name}</span>
                    <span className="text-[9px] text-zinc-500">Booked by {book.booked_by_name || 'System'}</span>
                  </div>
                  <div className="text-[9px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                    <span>🕒</span>
                    <span>{new Date(book.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(book.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {book.attendees && book.attendees.length > 0 && (
                    <div className="text-[9px] text-zinc-500 mt-1 flex flex-wrap gap-1.5 items-center">
                      <span>Attendees:</span>
                      {book.attendees.map(a => (
                        <span key={a} className="bg-[rgba(0,240,255,0.1)] text-[var(--accent-cyan)] border border-[rgba(0,240,255,0.2)] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* VECTOR KNOWLEDGE BASE TAB */}
        {activeTab === 'knowledge' && (
          <div className="flex flex-col gap-4 h-full">
            {/* Create new document form */}
            <form onSubmit={handleUploadKnowledge} className="flex flex-col gap-2.5 p-3 bg-[rgba(25,27,44,0.5)] border border-[rgba(157,78,221,0.15)] rounded-lg shadow-lg">
              <span className="text-[9px] font-bold text-zinc-400 font-hud tracking-wider uppercase flex items-center gap-1.5">
                <Database size={11} className="text-[var(--accent-purple)]" /> VECTOR CORE UPLINK
              </span>
              
              <input
                type="text"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                placeholder="Document Title (e.g., HR Rules)"
                className="input-retro text-[11px] py-1.5 mt-1"
                required
              />
              
              <textarea
                value={docContent}
                onChange={e => setDocContent(e.target.value)}
                placeholder="Details, specifications, FAQs, credentials..."
                rows={3}
                className="input-retro text-[10px] py-1.5 resize-none"
                required
              />

              <button type="submit" className="btn-retro text-[10px] py-1.5 border-[var(--accent-purple)] text-[var(--accent-purple)] flex justify-center gap-1.5 hover:shadow-[0_0_12px_rgba(157,78,221,0.3)]">
                <Database size={11} /> INDEX EMBEDDING (COMPILATION)
              </button>
            </form>

            {/* Knowledge Document List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              <span className="text-[9px] font-bold text-zinc-500 font-hud tracking-widest">
                INDEXED HANDBOOKS ({docs.length})
              </span>
              {docs.map(doc => (
                <div key={doc.id} className="p-3 bg-[rgba(157,78,221,0.02)] border border-[rgba(157,78,221,0.12)] rounded-lg text-[10px] font-mono holo-card">
                  <div className="font-bold text-zinc-200 flex items-center gap-1.5 mb-1.5 text-[11px] font-hud tracking-wide">
                    <BookOpen size={10} className="text-[var(--accent-purple)]" /> {doc.title}
                  </div>
                  <p className="text-zinc-500 leading-relaxed">{doc.content.substring(0, 100)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOG TERMINAL TAB */}
        {activeTab === 'logs' && (
          <div className="h-full flex flex-col justify-between">
            <div className="flex-1 overflow-y-auto terminal-console space-y-1.5 min-h-[220px]">
              <div className="text-[9px] text-zinc-600 mb-2 border-b border-zinc-900 pb-1.5 font-hud tracking-widest">
                ⚙️ SYSTEM LOG BUFFER ACTIVE
              </div>
              {logs.map(log => {
                let colorClass = 'text-green-400';
                if (log.type === 'tool_call') colorClass = 'text-[var(--accent-cyan)]';
                else if (log.type === 'status_change') colorClass = 'text-[var(--accent-magenta)]';
                else if (log.type === 'warning') colorClass = 'text-[var(--accent-yellow)]';

                return (
                  <div key={log.id} className="leading-relaxed text-[10px]">
                    <span className="text-zinc-700">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                    <span className={colorClass}>{log.text}</span>
                  </div>
                );
              })}
              <div className="leading-relaxed">
                <span className="text-zinc-700">[{new Date().toLocaleTimeString()}]</span>{' '}
                <span className="text-green-400">awaiting signals...</span>
                <span className="blinking-caret"></span>
              </div>
              <div ref={logsEndRef} />
            </div>
            <button
              onClick={() => setLogs([])}
              className="btn-retro text-[9px] py-1 mt-2 text-center justify-center border-zinc-700 hover:border-zinc-500"
            >
              Clear Buffer
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
