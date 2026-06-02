import { dbService } from './supabaseClient';
import type { ActivityLog } from '../types';

// Read API Key from environment or local storage config
const getApiKey = () => {
  return import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('VIRTUAL_OFFICE_OPENAI_KEY') || '';
};

export const openaiService = {
  hasKey(): boolean {
    return !!getApiKey();
  },

  // Generate 768-dimension embeddings for pgvector query matching
  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('OpenAI API Key missing, skipping embedding generation.');
      return new Array(768).fill(0);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: 768 // Truncate to 768 dimensions to fit migration schema
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data[0].embedding;
    } catch (err) {
      console.error('Embedding generation error:', err);
      return new Array(768).fill(0);
    }
  },

  // Perform Chat Completion with Tool Calling
  async runSecretaryAgent(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    ownerProfileId: string,
    onLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void
  ): Promise<{ text: string }> {
    const apiKey = getApiKey();
    if (!apiKey) {
      onLog({
        text: 'AI Agent error: OpenAI API Key is missing. Please configure it in the HUD settings.',
        type: 'warning'
      });
      return { text: 'Hello! I am your AI Secretary, but I need an OpenAI API Key to operate in autonomous mode. Please click the "⚙️ Settings" button in the top banner and paste your key!' };
    }

    try {
      // Define tools list
      const tools = [
        {
          type: 'function',
          function: {
            name: 'create_task',
            description: 'Create a new task on the Kanban board for the employee.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Detailed title of the task.' },
                description: { type: 'string', description: 'Brief explanation of what the task involves.' },
                due_date: { type: 'string', description: 'Task deadline date formatted as YYYY-MM-DD.' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency of the task.' }
              },
              required: ['title', 'priority']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'book_meeting_room',
            description: 'Reserve a meeting room booking slot.',
            parameters: {
              type: 'object',
              properties: {
                room_name: { type: 'string', enum: ['Alpha Room', 'Beta Room', 'Cafe lounge'], description: 'Room name selection.' },
                start_time: { type: 'string', description: 'ISO string of start time.' },
                end_time: { type: 'string', description: 'ISO string of end time.' },
                attendees: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'List of nicknames/names attending the meeting.' 
                }
              },
              required: ['room_name', 'start_time', 'end_time']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'update_employee_status',
            description: 'Change the current activity status of the employee.',
            parameters: {
              type: 'object',
              properties: {
                status: { 
                  type: 'string', 
                  enum: ['Available', 'Focus Mode', 'In a Meeting', 'Away From Keyboard', 'Resting'],
                  description: 'New status representation.' 
                }
              },
              required: ['status']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'query_company_knowledge',
            description: 'Queries the company documentation or handbook repository for answers.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Question or search term regarding company policies.' }
              },
              required: ['query']
            }
          }
        }
      ];

      // Build full payload messages
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      onLog({ text: 'Contacting AI Secretary server core...', type: 'info' });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: apiMessages,
          tools: tools,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const assistantMessage = choice.message;

      // Handle Tool Calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        let finalResponseText = '';
        
        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          onLog({
            text: `Agent decided tool execution: ${fnName}(${JSON.stringify(args)})`,
            type: 'tool_call'
          });

          let toolOutput = '';

          try {
            if (fnName === 'create_task') {
              const newTask = await dbService.insertTask({
                employee_id: ownerProfileId,
                title: args.title,
                description: args.description || '',
                due_date: args.due_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
                priority: args.priority || 'medium',
                status: 'todo'
              });
              toolOutput = `Success: Created task "${newTask.title}" (ID: ${newTask.id})`;
              onLog({ text: `Task created: ${newTask.title}`, type: 'info' });
            } 
            else if (fnName === 'book_meeting_room') {
              const newBooking = await dbService.insertBooking({
                room_name: args.room_name,
                start_time: args.start_time,
                end_time: args.end_time,
                booked_by: ownerProfileId,
                attendees: args.attendees || []
              });
              toolOutput = `Success: Room reserved successfully! Room: "${newBooking.room_name}" from ${newBooking.start_time} to ${newBooking.end_time}`;
              onLog({ text: `Meeting room booked: ${newBooking.room_name}`, type: 'info' });
            } 
            else if (fnName === 'update_employee_status') {
              const updated = await dbService.updateProfile({
                id: ownerProfileId,
                status: args.status
              });
              toolOutput = `Success: Updated employee status to "${updated.status}"`;
              onLog({ text: `Status updated to: ${updated.status}`, type: 'status_change' });
            } 
            else if (fnName === 'query_company_knowledge') {
              // Generate embeddings if key is valid for real vector search matching
              let queryEmbedding: number[] | undefined;
              if (dbService.isSupabaseEnabled()) {
                queryEmbedding = await this.generateEmbedding(args.query);
              }
              const matches = await dbService.searchKnowledge(args.query, 0.15, queryEmbedding);
              
              if (matches.length > 0) {
                toolOutput = JSON.stringify(matches.map(m => ({ title: m.title, content: m.content })));
                onLog({ text: `Vector search returned ${matches.length} matches.`, type: 'info' });
              } else {
                toolOutput = 'No matching information found in the knowledge base.';
                onLog({ text: 'Knowledge base search returned zero results.', type: 'info' });
              }
            }
          } catch (execErr: any) {
            toolOutput = `Error executing tool: ${execErr.message || execErr}`;
            onLog({ text: `Tool error: ${toolOutput}`, type: 'warning' });
          }

          // Call OpenAI again with the tool output to generate natural summary response
          onLog({ text: 'Synthesizing final action report...', type: 'info' });
          const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
                assistantMessage,
                {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: fnName,
                  content: toolOutput
                }
              ]
            })
          });

          if (secondResponse.ok) {
            const secondData = await secondResponse.json();
            finalResponseText += secondData.choices[0].message.content + '\n';
          } else {
            finalResponseText += `Tool executed: ${toolOutput}. Synthesizer failed.`;
          }
        }

        return { text: finalResponseText.trim() };
      }

      return { text: assistantMessage.content || '' };
    } catch (err: any) {
      console.error(err);
      onLog({ text: `Completions error: ${err.message || err}`, type: 'warning' });
      return { text: `Sorry, I encountered an error connecting to OpenAI: ${err.message || err}` };
    }
  }
};
