import type { EmployeeProfile } from '../types';

export class OfficeSimulator {
  private bots: EmployeeProfile[] = [];
  
  // Design seats targets
  private deskPositions = {
    'bot-alice': { x: 285, y: 160 },
    'bot-bob': { x: 120, y: 280 },
    'bot-carol': { x: 285, y: 280 },
  };

  private meetingPositions = {
    'bot-alice': { x: 480, y: 120 },
    'bot-bob': { x: 520, y: 120 },
    'bot-carol': { x: 500, y: 140 },
  };

  private breakPosition = { x: 80, y: 400 };

  // Current bot schedule states
  // 'desk' | 'meeting' | 'break' | 'moving'
  private botStates: { [id: string]: { state: string; targetX: number; targetY: number; timer: number } } = {
    'bot-alice': { state: 'desk', targetX: 285, targetY: 160, timer: Date.now() + 10000 },
    'bot-bob': { state: 'desk', targetX: 120, targetY: 280, timer: Date.now() + 15000 },
    'bot-carol': { state: 'meeting', targetX: 500, targetY: 140, timer: Date.now() + 8000 },
  };

  // Simulated dialogue bank for meeting transcripts
  private meetingQuotes = [
    "Carol: Alright team, let's look at the timeline for the AI integration features.",
    "Alice: The backend vector database schema migration is finished. RLS policies are active.",
    "Bob: I've uploaded the HUD overlay layout wireframes. They fit 16-bit screens.",
    "Carol: Excellent. Johnny, can you review the database triggers by tomorrow?",
    "Alice: I can assist with that. We need to test the Realtime presence broadcast performance.",
    "Bob: The color scheme looks clean. Let's stick with the neon magenta highlights.",
    "Carol: Great. Let's wrap up this standup. Don't forget to push your code changes."
  ];

  private quoteIndex = 0;

  constructor() {
    // Spawns Alice, Bob, and Carol
    this.bots = [
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
        x: 285,
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
        status: 'In a Meeting',
        skin_tone_id: 1,
        hair_style_id: 4,
        hair_color_hex: '#ffffff',
        outfit_id: 5,
        accessory_id: 3,
        x: 500,
        y: 140
      }
    ];
  }

  public getBots(): EmployeeProfile[] {
    return this.bots;
  }

  // Update simulator loop (called at an interval e.g. 100ms)
  // Returns updated bots array and any new simulated dialogue string
  public tick(onTranscriptAdded: (line: string) => void): EmployeeProfile[] {
    const now = Date.now();
    let isMeetingActive = false;

    this.bots = this.bots.map(bot => {
      const schedule = this.botStates[bot.id];
      if (!schedule) return bot;

      // Check if timer expired, switch task
      if (now > schedule.timer) {
        const states = ['desk', 'meeting', 'break'];
        const nextState = states[Math.floor(Math.random() * states.length)];
        
        let tx = bot.x;
        let ty = bot.y;
        let nextStatus: EmployeeProfile['status'] = 'Available';

        if (nextState === 'desk') {
          const pos = this.deskPositions[bot.id as keyof typeof this.deskPositions];
          tx = pos.x; ty = pos.y;
          nextStatus = 'Focus Mode';
        } else if (nextState === 'meeting') {
          const pos = this.meetingPositions[bot.id as keyof typeof this.meetingPositions];
          tx = pos.x; ty = pos.y;
          nextStatus = 'In a Meeting';
        } else if (nextState === 'break') {
          tx = this.breakPosition.x + (Math.random() * 40 - 20);
          ty = this.breakPosition.y + (Math.random() * 30 - 15);
          nextStatus = 'Resting';
        }

        this.botStates[bot.id] = {
          state: nextState,
          targetX: tx,
          targetY: ty,
          timer: now + 10000 + Math.random() * 20000 // stay there for 10-30s
        };

        return { ...bot, status: nextStatus };
      }

      // Step movement towards target coordinate
      const dx = schedule.targetX - bot.x;
      const dy = schedule.targetY - bot.y;
      const distance = Math.hypot(dx, dy);

      let newX = bot.x;
      let newY = bot.y;
      const speed = 2.0;

      if (distance > 4) {
        // Move step
        newX += (dx / distance) * speed;
        newY += (dy / distance) * speed;
      } else {
        // Arrived at target, snap
        newX = schedule.targetX;
        newY = schedule.targetY;
      }

      // Count if in meeting room
      if (schedule.state === 'meeting' && newX > 400 && newY < 260) {
        isMeetingActive = true;
      }

      return {
        ...bot,
        x: Math.round(newX),
        y: Math.round(newY)
      };
    });

    // If bots are gathered in the meeting room, periodically generate simulated dialogue lines
    if (isMeetingActive && Math.random() < 0.1) {
      const line = this.meetingQuotes[this.quoteIndex];
      this.quoteIndex = (this.quoteIndex + 1) % this.meetingQuotes.length;
      onTranscriptAdded(line);
    }

    return this.bots;
  }
}
