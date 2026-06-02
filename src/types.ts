export interface EmployeeProfile {
  id: string;
  name: string;
  nickname: string;
  department: 'Tech' | 'Design' | 'Marketing' | 'HR' | 'Management';
  position: 'Tech Lead' | 'PM' | 'Developer' | 'UI/UX Designer' | 'HR Manager' | 'Marketing Lead';
  status: 'Available' | 'Focus Mode' | 'In a Meeting' | 'Away From Keyboard' | 'Resting';
  skin_tone_id: number;
  hair_style_id: number;
  hair_color_hex: string;
  outfit_id: number;
  accessory_id: number;
  x: number;
  y: number;
}

export interface Task {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

export interface RoomBooking {
  id: string;
  room_name: 'Alpha Room' | 'Beta Room' | 'Cafe lounge';
  start_time: string;
  end_time: string;
  booked_by: string;
  booked_by_name?: string;
  attendees: string[];
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  embedding?: number[];
  similarity?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'owner' | 'visitor' | 'secretary';
  senderName: string;
  text: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface ActivityLog {
  id: string;
  text: string;
  timestamp: Date;
  type: 'info' | 'tool_call' | 'status_change' | 'warning';
}

export interface VectorEmbedding {
  text: string;
  vector: number[];
}
