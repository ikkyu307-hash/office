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
    <div className="hud-panel h-full flex flex-col border border-[var(--border-color)] overflow-hidden">
      
      {/* Sidebar Tabs */}
      <div className="grid grid-cols-5 border-b border-[var(--border-color)] bg-[rgba(25,27,44,0.3)]">
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
              className={`py-3 flex flex-col items-center justify-center gap-1 border-r border-[var(--border-color)] transition-all ${
                isActive 
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-cyan)] border-b-2 border-b-[var(--accent-cyan)]' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={16} />
              <span className="text-[9px] font-mono leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-[rgba(10,11,16,0.3)]">
        
        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col justify-between gap-3">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {chatMessages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col p-2.5 rounded ${
                    msg.sender === 'secretary' 
                      ? 'bg-[rgba(0,240,255,0.05)] border border-[rgba(0,240,255,0.15)] text-zinc-200' 
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] text-zinc-300 ml-6'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-mono text-[9px] font-bold ${
                      msg.sender === 'secretary' ? 'text-[var(--accent-cyan)]' : 'text-zinc-400'
                    }`}>
                      {msg.sender === 'secretary' ? '🤖 SECRETARY' : `👤 ${msg.senderName.toUpperCase()}`}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-mono whitespace-pre-line leading-relaxed">{msg.text}</p>
                </div>
              ))}
              {isTyping && (
                <div className="text-[10px] text-[var(--accent-cyan)] font-mono animate-pulse">
                  🤖 Secretary is computing actions...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Ask secretary: 'Add a urgent bug fix task'"
                className="input-retro text-xs flex-1"
                disabled={isTyping}
              />
              <button
                type="submit"
                className="btn-retro p-2 border-[var(--accent-cyan)] text-[var(--accent-cyan)]"
                disabled={isTyping}
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}

        {/* KANBAN TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-4 h-full">
            {/* Quick creation form */}
            <form onSubmit={handleCreateTask} className="flex flex-col gap-2 p-3 bg-[rgba(25,27,44,0.4)] border border-[var(--border-color)] rounded">
              <span className="text-[10px] font-bold text-zinc-400 font-mono">📝 QUICK TASK ADD</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Task title..."
                  className="input-retro text-[11px] py-1 flex-1"
                  required
                />
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as any)}
                  className="input-retro text-[10px] py-1 cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Med</option>
                  <option value="high">High</option>
                </select>
                <button type="submit" className="btn-retro px-2 py-1">
                  <Plus size={12} />
                </button>
              </div>
            </form>

            {/* Kanban Columns (Simulated) */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {['todo', 'in_progress', 'done'].map(statusName => {
                const columnTasks = tasks.filter(t => t.status === statusName);
                const titleMap: { [key: string]: string } = {
                  todo: '📋 TODO',
                  in_progress: '⚡ IN PROGRESS',
                  done: '✅ COMPLETED'
                };
                return (
                  <div key={statusName} className="flex flex-col gap-2">
                    <span className="text-[9px] font-bold text-zinc-500 font-mono tracking-wider">
                      {titleMap[statusName]} ({columnTasks.length})
                    </span>
                    <div className="space-y-2">
                      {columnTasks.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 font-mono p-2 border border-dashed border-[var(--border-color)] rounded text-center">
                          Column Empty
                        </div>
                      ) : (
                        columnTasks.map(task => (
                          <div 
                            key={task.id} 
                            onClick={() => handleToggleTaskStatus(task)}
                            className="p-2 bg-[rgba(25,27,44,0.2)] border border-[var(--border-color)] hover:border-zinc-400 transition-colors rounded cursor-pointer flex justify-between items-center text-[11px] font-mono group"
                          >
                            <div className="flex flex-col">
                              <span className="text-zinc-200 group-hover:text-[var(--accent-cyan)] transition-colors">
                                {task.title}
                              </span>
                              {task.due_date && (
                                <span className="text-[8px] text-zinc-500 mt-1">Due: {task.due_date}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] px-1 rounded uppercase font-bold ${
                                task.priority === 'high' ? 'bg-red-950 text-red-400 border border-red-800' :
                                task.priority === 'medium' ? 'bg-yellow-950 text-yellow-400 border border-yellow-800' :
                                'bg-zinc-800 text-zinc-400'
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
            <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-wider uppercase mb-1">
              📅 OFFICE ROOM RESERVATIONS
            </span>
            {bookings.length === 0 ? (
              <div className="text-xs text-zinc-500 font-mono p-4 text-center">
                No active meeting bookings.
              </div>
            ) : (
              bookings.map(book => (
                <div key={book.id} className="p-3 bg-[rgba(25,27,44,0.3)] border border-[var(--border-color)] rounded flex flex-col gap-1 text-[11px] font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--accent-cyan)] font-bold">{book.room_name}</span>
                    <span className="text-[9px] text-zinc-500">Booked by {book.booked_by_name || 'System'}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    🕒 {new Date(book.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(book.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {book.attendees && book.attendees.length > 0 && (
                    <div className="text-[9px] text-zinc-500 mt-1 flex flex-wrap gap-1">
                      <span>Attendees:</span>
                      {book.attendees.map(a => (
                        <span key={a} className="bg-zinc-800 px-1 py-0.5 rounded text-[8px] text-zinc-300">{a}</span>
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
            <form onSubmit={handleUploadKnowledge} className="flex flex-col gap-2 p-3 bg-[rgba(25,27,44,0.4)] border border-[var(--border-color)] rounded">
              <span className="text-[10px] font-bold text-zinc-400 font-mono">📚 INDEX NEW VECTOR DOCUMENT</span>
              
              <input
                type="text"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                placeholder="Document Title (e.g., HR Guidelines)"
                className="input-retro text-[11px] py-1"
                required
              />
              
              <textarea
                value={docContent}
                onChange={e => setDocContent(e.target.value)}
                placeholder="Document details, FAQs, credentials..."
                rows={3}
                className="input-retro text-[10px] py-1 resize-none"
                required
              />

              <button type="submit" className="btn-retro text-[11px] py-1 border-[var(--accent-cyan)] text-[var(--accent-cyan)] flex justify-center gap-1.5">
                <Database size={12} /> Index Embedding
              </button>
            </form>

            {/* Knowledge Document List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              <span className="text-[9px] font-bold text-zinc-500 font-mono tracking-wider">
                INDEXED HANDBOOKS ({docs.length})
              </span>
              {docs.map(doc => (
                <div key={doc.id} className="p-2.5 bg-[rgba(25,27,44,0.1)] border border-[var(--border-color)] rounded text-[10px] font-mono">
                  <div className="font-bold text-zinc-300 flex items-center gap-1.5 mb-1 text-[11px]">
                    <BookOpen size={10} className="text-[var(--accent-cyan)]" /> {doc.title}
                  </div>
                  <p className="text-zinc-500 leading-normal">{doc.content.substring(0, 100)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOG TERMINAL TAB */}
        {activeTab === 'logs' && (
          <div className="h-full flex flex-col justify-between">
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-400 bg-black p-3 border border-[var(--border-color)] rounded space-y-1.5 min-h-[220px]">
              {logs.map(log => {
                let colorClass = 'text-green-400';
                if (log.type === 'tool_call') colorClass = 'text-[var(--accent-cyan)]';
                else if (log.type === 'status_change') colorClass = 'text-[var(--accent-magenta)]';
                else if (log.type === 'warning') colorClass = 'text-[var(--accent-yellow)]';

                return (
                  <div key={log.id} className="leading-relaxed">
                    <span className="text-zinc-700">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                    <span className={colorClass}>{log.text}</span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
            <button
              onClick={() => setLogs([])}
              className="btn-retro text-[9px] py-1 mt-2 text-center justify-center"
            >
              Clear Buffer
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
