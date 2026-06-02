import { createClient } from '@supabase/supabase-js';
import type { EmployeeProfile, Task, RoomBooking, KnowledgeDoc } from '../types';

// Load Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Initialize Supabase Client
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Config Management Keys
const CONFIG_KEY_GEMINI = 'VIRTUAL_OFFICE_GEMINI_KEY';

// Default mock data for local fallback
const INITIAL_PROFILES: EmployeeProfile[] = [
  {
    id: 'user-id-123',
    name: 'Player',
    nickname: 'Hero',
    department: 'Tech',
    position: 'Developer',
    status: 'Available',
    skin_tone_id: 2,
    hair_style_id: 3,
    hair_color_hex: '#dfa62a',
    outfit_id: 2,
    accessory_id: 1,
    x: 120,
    y: 160
  },
  {
    id: 'bot-alice',
    name: 'Alice Cooper',
    nickname: 'Alice',
    department: 'Tech',
    position: 'Tech Lead',
    status: 'Focus Mode',
    skin_tone_id: 1,
    hair_style_id: 2,
    hair_color_hex: '#e24177',
    outfit_id: 1,
    accessory_id: 2,
    x: 280,
    y: 160
  },
  {
    id: 'bot-bob',
    name: 'Bob Miller',
    nickname: 'Bob',
    department: 'Design',
    position: 'UI/UX Designer',
    status: 'Available',
    skin_tone_id: 3,
    hair_style_id: 1,
    hair_color_hex: '#2b7ce9',
    outfit_id: 3,
    accessory_id: 0,
    x: 120,
    y: 280
  },
  {
    id: 'bot-carol',
    name: 'Carol Danvers',
    nickname: 'Carol',
    department: 'Management',
    position: 'PM',
    status: 'Resting',
    skin_tone_id: 1,
    hair_style_id: 4,
    hair_color_hex: '#ffffff',
    outfit_id: 5,
    accessory_id: 3,
    x: 440,
    y: 400
  }
];

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    employee_id: 'user-id-123',
    title: 'Initialize repository structure',
    description: 'Scaffold the Vite React codebase and establish type systems.',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    priority: 'high',
    status: 'done'
  },
  {
    id: 'task-2',
    employee_id: 'user-id-123',
    title: 'Implement 2D Canvas Engine',
    description: 'Design the office layout with collision zones and seat tracking.',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    priority: 'high',
    status: 'in_progress'
  },
  {
    id: 'task-3',
    employee_id: 'bot-alice',
    title: 'Review system design documents',
    description: 'Verify security policies for database storage components.',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    priority: 'medium',
    status: 'todo'
  },
  {
    id: 'task-4',
    employee_id: 'bot-bob',
    title: 'Deliver wireframes for HUD widgets',
    description: 'Draw mock layouts for sidebars, task boards, and chat.',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    priority: 'medium',
    status: 'done'
  }
];

const INITIAL_BOOKINGS: RoomBooking[] = [
  {
    id: 'book-1',
    room_name: 'Alpha Room',
    start_time: new Date(Date.now() - 3600000).toISOString(),
    end_time: new Date(Date.now() + 1800000).toISOString(),
    booked_by: 'bot-carol',
    booked_by_name: 'Carol',
    attendees: ['Carol', 'Alice', 'Player']
  }
];

const INITIAL_KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: 'doc-1',
    title: 'Office Security & Wi-Fi Password',
    content: 'The office Wi-Fi network is "PixelOffice_5G". The password is "16bitGamerOffice!". Guest network is "OfficeGuest" with no password but requires landing page acceptance. Keep security badges visible.'
  },
  {
    id: 'doc-2',
    title: 'Working Hours & Flex Time',
    content: 'Core collaboration hours are 10:00 AM to 4:00 PM. Employees can flex remaining hours. Working from the game map counts towards active time. Break room stays open 24/7.'
  },
  {
    id: 'doc-3',
    title: 'Code Review Guidelines',
    content: 'All pull requests must undergo review by at least one Tech Lead. Unit test coverage should cover a minimum of 80% for business logic. Run linting checks before committing.'
  },
  {
    id: 'doc-4',
    title: 'Gemini API Setup Tutorial',
    content: 'To power autonomous secretary agents, provide a Gemini API key in the top banner configuration panel. This key is stored securely inside your browser storage and calls the official Google AI API directly.'
  }
];

const initLocalStorage = () => {
  if (!localStorage.getItem('VO_PROFILES')) {
    localStorage.setItem('VO_PROFILES', JSON.stringify(INITIAL_PROFILES));
  }
  if (!localStorage.getItem('VO_TASKS')) {
    localStorage.setItem('VO_TASKS', JSON.stringify(INITIAL_TASKS));
  }
  if (!localStorage.getItem('VO_BOOKINGS')) {
    localStorage.setItem('VO_BOOKINGS', JSON.stringify(INITIAL_BOOKINGS));
  }
  if (!localStorage.getItem('VO_KNOWLEDGE')) {
    localStorage.setItem('VO_KNOWLEDGE', JSON.stringify(INITIAL_KNOWLEDGE));
  }
};

initLocalStorage();

// Listeners for emulating realtime updates locally
const profileListeners: ((profiles: EmployeeProfile[]) => void)[] = [];
const taskListeners: (() => void)[] = [];
const bookingListeners: (() => void)[] = [];

export const dbService = {
  isSupabaseEnabled(): boolean {
    return !!supabase;
  },

  getGeminiApiKey(): string {
    return localStorage.getItem(CONFIG_KEY_GEMINI) || '';
  },

  setGeminiApiKey(key: string): void {
    localStorage.setItem(CONFIG_KEY_GEMINI, key);
  },

  // PROFILES API
  async getProfiles(): Promise<EmployeeProfile[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .order('name');
      if (!error && data) return data as EmployeeProfile[];
      console.warn('Supabase profile fetch error, falling back:', error);
    }
    return JSON.parse(localStorage.getItem('VO_PROFILES') || '[]');
  },

  async updateProfile(profile: Partial<EmployeeProfile> & { id: string }): Promise<EmployeeProfile> {
    if (supabase) {
      const { data, error } = await supabase
        .from('employee_profiles')
        .update(profile)
        .eq('id', profile.id)
        .select()
        .single();
      if (!error && data) return data as EmployeeProfile;
      console.warn('Supabase profile update error, falling back:', error);
    }

    const profiles = JSON.parse(localStorage.getItem('VO_PROFILES') || '[]');
    const idx = profiles.findIndex((p: EmployeeProfile) => p.id === profile.id);
    if (idx !== -1) {
      profiles[idx] = { ...profiles[idx], ...profile };
      localStorage.setItem('VO_PROFILES', JSON.stringify(profiles));
      profileListeners.forEach(listener => listener(profiles));
      return profiles[idx];
    }
    throw new Error('Profile not found');
  },

  async insertProfile(profile: EmployeeProfile): Promise<EmployeeProfile> {
    if (supabase) {
      const { data, error } = await supabase
        .from('employee_profiles')
        .insert(profile)
        .select()
        .single();
      if (!error && data) return data as EmployeeProfile;
      console.warn('Supabase profile insert error, falling back:', error);
    }

    const profiles = JSON.parse(localStorage.getItem('VO_PROFILES') || '[]');
    profiles.push(profile);
    localStorage.setItem('VO_PROFILES', JSON.stringify(profiles));
    profileListeners.forEach(listener => listener(profiles));
    return profile;
  },

  subscribeToProfiles(callback: (profiles: EmployeeProfile[]) => void) {
    if (supabase) {
      const channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'employee_profiles' },
          async () => {
            const updated = await this.getProfiles();
            callback(updated);
          }
        )
        .subscribe();
      
      this.getProfiles().then(callback);

      return {
        unsubscribe() {
          channel.unsubscribe();
        }
      };
    }

    profileListeners.push(callback);
    this.getProfiles().then(callback);
    return {
      unsubscribe() {
        const idx = profileListeners.indexOf(callback);
        if (idx !== -1) profileListeners.splice(idx, 1);
      }
    };
  },

  // TASKS API
  async getTasks(employeeId?: string): Promise<Task[]> {
    if (supabase) {
      let query = supabase.from('tasks').select('*');
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data as Task[];
      console.warn('Supabase tasks fetch error, falling back:', error);
    }

    const tasks: Task[] = JSON.parse(localStorage.getItem('VO_TASKS') || '[]');
    if (employeeId) {
      return tasks.filter(t => t.employee_id === employeeId);
    }
    return tasks;
  },

  async insertTask(task: Omit<Task, 'id'>): Promise<Task> {
    if (supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();
      if (!error && data) {
        taskListeners.forEach(l => l());
        return data as Task;
      }
      console.warn('Supabase task insert error, falling back:', error);
    }

    const tasks = JSON.parse(localStorage.getItem('VO_TASKS') || '[]');
    const newTask: Task = {
      ...task,
      id: 'task-' + Math.random().toString(36).substring(2, 9)
    };
    tasks.push(newTask);
    localStorage.setItem('VO_TASKS', JSON.stringify(tasks));
    taskListeners.forEach(l => l());
    return newTask;
  },

  async updateTask(task: Partial<Task> & { id: string }): Promise<Task> {
    if (supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .update(task)
        .eq('id', task.id)
        .select()
        .single();
      if (!error && data) {
        taskListeners.forEach(l => l());
        return data as Task;
      }
      console.warn('Supabase task update error, falling back:', error);
    }

    const tasks = JSON.parse(localStorage.getItem('VO_TASKS') || '[]');
    const idx = tasks.findIndex((t: Task) => t.id === task.id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...task };
      localStorage.setItem('VO_TASKS', JSON.stringify(tasks));
      taskListeners.forEach(l => l());
      return tasks[idx];
    }
    throw new Error('Task not found');
  },

  async deleteTask(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      if (!error) {
        taskListeners.forEach(l => l());
        return;
      }
      console.warn('Supabase task delete error, falling back:', error);
    }

    const tasks = JSON.parse(localStorage.getItem('VO_TASKS') || '[]');
    const filtered = tasks.filter((t: Task) => t.id !== id);
    localStorage.setItem('VO_TASKS', JSON.stringify(filtered));
    taskListeners.forEach(l => l());
  },

  subscribeToTasks(callback: () => void) {
    if (supabase) {
      const channel = supabase.channel('schema-tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          callback();
        })
        .subscribe();
      return {
        unsubscribe() {
          channel.unsubscribe();
        }
      };
    }

    taskListeners.push(callback);
    return {
      unsubscribe() {
        const idx = taskListeners.indexOf(callback);
        if (idx !== -1) taskListeners.splice(idx, 1);
      }
    };
  },

  // ROOM BOOKINGS API
  async getBookings(): Promise<RoomBooking[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('room_bookings')
        .select('*, employee_profiles(name)')
        .order('start_time');
      if (!error && data) {
        return data.map((b: any) => ({
          ...b,
          booked_by_name: b.employee_profiles?.name || 'Employee'
        })) as RoomBooking[];
      }
      console.warn('Supabase bookings fetch error, falling back:', error);
    }

    return JSON.parse(localStorage.getItem('VO_BOOKINGS') || '[]');
  },

  async insertBooking(booking: Omit<RoomBooking, 'id'>): Promise<RoomBooking> {
    if (supabase) {
      const { data, error } = await supabase
        .from('room_bookings')
        .insert(booking)
        .select()
        .single();
      if (!error && data) {
        bookingListeners.forEach(l => l());
        return data as RoomBooking;
      }
      console.warn('Supabase booking insert error, falling back:', error);
    }

    const bookings = JSON.parse(localStorage.getItem('VO_BOOKINGS') || '[]');
    const profiles = JSON.parse(localStorage.getItem('VO_PROFILES') || '[]');
    const booker = profiles.find((p: EmployeeProfile) => p.id === booking.booked_by);

    const newBooking: RoomBooking = {
      ...booking,
      id: 'book-' + Math.random().toString(36).substring(2, 9),
      booked_by_name: booker?.name || 'Employee'
    };
    bookings.push(newBooking);
    localStorage.setItem('VO_BOOKINGS', JSON.stringify(bookings));
    bookingListeners.forEach(l => l());
    return newBooking;
  },

  subscribeToBookings(callback: () => void) {
    if (supabase) {
      const channel = supabase.channel('schema-bookings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => {
          callback();
        })
        .subscribe();
      return {
        unsubscribe() {
          channel.unsubscribe();
        }
      };
    }

    bookingListeners.push(callback);
    return {
      unsubscribe() {
        const idx = bookingListeners.indexOf(callback);
        if (idx !== -1) bookingListeners.splice(idx, 1);
      }
    };
  },

  // KNOWLEDGE BASE / VECTOR MEMORY API
  async getKnowledge(): Promise<KnowledgeDoc[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('company_knowledge')
        .select('id, title, content')
        .order('title');
      if (!error && data) return data as KnowledgeDoc[];
      console.warn('Supabase knowledge fetch error, falling back:', error);
    }
    return JSON.parse(localStorage.getItem('VO_KNOWLEDGE') || '[]');
  },

  async insertKnowledge(doc: Omit<KnowledgeDoc, 'id'>, embedding?: number[]): Promise<KnowledgeDoc> {
    if (supabase) {
      const { data, error } = await supabase
        .from('company_knowledge')
        .insert({
          title: doc.title,
          content: doc.content,
          embedding: embedding || null
        })
        .select()
        .single();
      if (!error && data) return data as KnowledgeDoc;
      console.warn('Supabase knowledge insert error, falling back:', error);
    }

    const docs = JSON.parse(localStorage.getItem('VO_KNOWLEDGE') || '[]');
    const newDoc: KnowledgeDoc = {
      ...doc,
      id: 'doc-' + Math.random().toString(36).substring(2, 9)
    };
    docs.push(newDoc);
    localStorage.setItem('VO_KNOWLEDGE', JSON.stringify(docs));
    return newDoc;
  },

  async searchKnowledge(query: string, matchThreshold: number = 0.2, embedding?: number[]): Promise<KnowledgeDoc[]> {
    if (supabase && embedding) {
      const { data, error } = await supabase.rpc('match_knowledge', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: 5
      });
      if (!error && data) return data as KnowledgeDoc[];
      console.warn('Supabase vector RPC search error, falling back:', error);
    }

    // Keyword similarity search simulation
    const docs = await this.getKnowledge();
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return docs.slice(0, 3);

    const results = docs.map(doc => {
      let score = 0;
      const text = `${doc.title} ${doc.content}`.toLowerCase();
      queryTerms.forEach(term => {
        if (text.includes(term)) {
          score += 0.3;
          if (doc.title.toLowerCase().includes(term)) {
            score += 0.2;
          }
        }
      });
      return { ...doc, similarity: Math.min(score, 1.0) };
    });

    return results
      .filter(r => (r.similarity || 0) >= matchThreshold)
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }
};
