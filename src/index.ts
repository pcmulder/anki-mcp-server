#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Tool argument types
interface ListDecksArgs {
  [key: string]: never;
}

interface CreateDeckArgs {
  name: string;
}

interface CreateNoteArgs {
  type: 'Basic' | 'Cloze';
  deck: string;
  front?: string;
  back?: string;
  text?: string;
  backExtra?: string;
  fields?: Record<string, string>;
  tags?: string[];
}

interface BatchCreateNotesArgs {
  notes: {
    type: 'Basic' | 'Cloze';
    deck: string;
    front?: string;
    back?: string;
    text?: string;
    backExtra?: string;
    fields?: Record<string, string>;
    tags?: string[];
  }[];
  stopOnError?: boolean;
}

interface SearchNotesArgs {
  query: string;
}

interface GetNoteInfoArgs {
  noteId: number;
}

interface UpdateNoteArgs {
  id: number;
  fields: Record<string, string>;
  tags?: string[];
}

interface DeleteNoteArgs {
  noteId: number;
}

interface ListNoteTypesArgs {
  [key: string]: never;
}

interface CreateNoteTypeArgs {
  name: string;
  fields: string[];
  css?: string;
  templates: {
    name: string;
    front: string;
    back: string;
  }[];
}

// Types for Anki operations
interface AnkiRequest {
  action: string;
  version: number;
  params: Record<string, any>;
}

interface AnkiResponse {
  result: any;
  error: string | null;
}

interface BasicNote {
  type: 'Basic';
  front: string;
  back: string;
  tags?: string[];
  deck: string;
}

interface ClozeNote {
  type: 'Cloze';
  text: string;
  backExtra?: string;
  tags?: string[];
  deck: string;
}

interface NoteUpdate {
  id: number;
  fields: Record<string, string>;
  tags?: string[];
}

interface BatchOperation<T> {
  operations: T[];
  stopOnError?: boolean;
  results: {
    success: boolean;
    error?: string;
    data?: any;
  }[];
}

function validateArgs<T>(args: Record<string, unknown> | undefined, requiredFields: (keyof T)[]): T {
  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
  }

  for (const field of requiredFields) {
    if (!(field in args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Missing required field: ${String(field)}`
      );
    }
  }

  return args as T;
}

class AnkiServer {
  private server: Server;
  private readonly ankiConnectUrl: string = 'http://localhost:8765';

  constructor() {
    this.server = new Server(
      {
        name: 'anki-connect-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async invokeAnki(action: string, params: Record<string, any> = {}): Promise<any> {
    console.error(`[Anki] Sending request: ${action}`, params);
    try {
      const requestData = {
        action,
        version: 6,
        params,
      };
      console.error('[Anki] Request data:', JSON.stringify(requestData, null, 2));

      const response = await axios.post<AnkiResponse>(this.ankiConnectUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        },
        timeout: 5000,
        validateStatus: null,
        maxRedirects: 0,
        httpAgent: new (await import('http')).Agent({
          keepAlive: true,
          maxSockets: 1
        })
      });

      console.error(`[Anki] Response status: ${response.status}`);
      console.error('[Anki] Response data:', JSON.stringify(response.data, null, 2));

      if (response.status !== 200) {
        throw new McpError(
          ErrorCode.InternalError,
          `Anki returned non-200 status: ${response.status}`
        );
      }

      if (response.data.error) {
        throw new McpError(ErrorCode.InternalError, `Anki error: ${response.data.error}`);
      }

      return response.data.result;
    } catch (error) {
      console.error('[Anki] Error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new McpError(
            ErrorCode.InternalError,
            'Anki is not running. Please start Anki and ensure AnkiConnect plugin is enabled.'
          );
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
          console.error('[Anki] Connection error:', error.code);
          // Retry once on timeout or reset
          console.error('[Anki] Retrying request...');
          try {
            // Recreate the request data
            const retryRequestData = {
              action,
              version: 6,
              params
            };
            const retryResponse = await axios.post<AnkiResponse>(this.ankiConnectUrl, retryRequestData, {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Connection': 'keep-alive'
              },
              timeout: 10000, // Longer timeout for retry
              validateStatus: null,
              maxRedirects: 0,
              httpAgent: new (await import('http')).Agent({
                keepAlive: true,
                maxSockets: 1
              })
            });
            console.error('[Anki] Retry successful');
            return retryResponse.data.result;
          } catch (retryError) {
            console.error('[Anki] Retry failed:', retryError);
            throw new McpError(
              ErrorCode.InternalError,
              'Connection to Anki failed after retry. Please check if Anki is running and responsive.'
            );
          }
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to connect to Anki: ${error.message} (${error.code})`
        );
      }
      throw error;
    }
  }

  private async checkAnkiConnection(): Promise<void> {
    try {
      await this.invokeAnki('version');
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        'Failed to connect to Anki. Please ensure Anki is running and AnkiConnect plugin is enabled.'
      );
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_decks',
          description: 'List all available Anki decks',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'create_deck',
          description: 'Create a new Anki deck',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the deck to create',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'create_note',
          description: 'Create a new note (Basic or Cloze)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['Basic', 'Cloze'],
                description: 'Type of note to create',
              },
              deck: {
                type: 'string',
                description: 'Deck name',
              },
              front: {
                type: 'string',
                description: 'Front content (for Basic notes)',
              },
              back: {
                type: 'string',
                description: 'Back content (for Basic notes)',
              },
              text: {
                type: 'string',
                description: 'Cloze text (for Cloze notes)',
              },
              backExtra: {
                type: 'string',
                description: 'Additional back content (for Cloze notes)',
              },
              fields: {
                type: 'object',
                description: 'Custom fields for the note',
                additionalProperties: true
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Tags for the note',
              },
            },
            required: ['type', 'deck'],
          },
        },
        {
          name: 'batch_create_notes',
          description: 'Create multiple notes at once',
          inputSchema: {
            type: 'object',
            properties: {
              notes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['Basic', 'Cloze'],
                    },
                    deck: {
                      type: 'string',
                    },
                    front: {
                      type: 'string',
                    },
                    back: {
                      type: 'string',
                    },
                    text: {
                      type: 'string',
                    },
                    backExtra: {
                      type: 'string',
                    },
                    fields: {
                      type: 'object',
                      additionalProperties: true
                    },
                    tags: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                    },
                  },
                  required: ['type', 'deck'],
                },
              },
              stopOnError: {
                type: 'boolean',
                description: 'Whether to stop on first error',
              },
            },
            required: ['notes'],
          },
        },
        {
          name: 'search_notes',
          description: 'Search for notes using Anki query syntax',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Anki search query',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_note_info',
          description: 'Get detailed information about a note',
          inputSchema: {
            type: 'object',
            properties: {
              noteId: {
                type: 'number',
                description: 'Note ID',
              },
            },
            required: ['noteId'],
          },
        },
        {
          name: 'update_note',
          description: 'Update an existing note',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
                description: 'Note ID',
              },
              fields: {
                type: 'object',
                description: 'Fields to update',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'New tags for the note',
              },
            },
            required: ['id', 'fields'],
          },
        },
        {
          name: 'delete_note',
          description: 'Delete a note',
          inputSchema: {
            type: 'object',
            properties: {
              noteId: {
                type: 'number',
                description: 'Note ID to delete',
              },
            },
            required: ['noteId'],
          },
        },
        {
          name: 'list_note_types',
          description: 'List all available note types',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'create_note_type',
          description: 'Create a new note type',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the new note type',
              },
              fields: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Field names for the note type',
              },
              css: {
                type: 'string',
                description: 'CSS styling for the note type',
              },
              templates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                    },
                    front: {
                      type: 'string',
                    },
                    back: {
                      type: 'string',
                    },
                  },
                  required: ['name', 'front', 'back'],
                },
                description: 'Card templates',
              },
            },
            required: ['name', 'fields', 'templates'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.checkAnkiConnection();

      switch (request.params.name) {
        case 'list_decks':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(await this.invokeAnki('deckNames'), null, 2),
              },
            ],
          };

        case 'create_deck': {
          const args = validateArgs<CreateDeckArgs>(request.params.arguments, ['name']);
          await this.invokeAnki('createDeck', {
            deck: args.name,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Created deck: ${args.name}`,
              },
            ],
          };
        }

        case 'create_note': {
          const args = validateArgs<CreateNoteArgs>(request.params.arguments, ['type', 'deck']);
          const { type, deck, front, back, text, backExtra, fields, tags } = args;
          let note;

          if (type === 'Basic') {
            if (fields) {
              note = {
                deckName: deck,
                modelName: '基础',
                fields,
                tags: tags || [],
              };
            } else if (front && back) {
              note = {
                deckName: deck,
                modelName: '基础',
                fields: {
                  正面: front,
                  背面: back,
                },
                tags: tags || [],
              };
            } else {
              throw new McpError(ErrorCode.InvalidParams, 'Basic notes require front and back content');
            }
          } else if (type === 'Cloze') {
            if (fields) {
              note = {
                deckName: deck,
                modelName: '填空题',
                fields,
                tags: tags || [],
              };
            } else if (text) {
              note = {
                deckName: deck,
                modelName: '填空题',
                fields: {
                  正面: text,
                  背面: backExtra || '',
                },
                tags: tags || [],
              };
            } else {
              throw new McpError(ErrorCode.InvalidParams, 'Cloze notes require text content');
            }
          } else {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid note type');
          }

          const noteId = await this.invokeAnki('addNote', { note });
          return {
            content: [
              {
                type: 'text',
                text: `Created note with ID: ${noteId}`,
              },
            ],
          };
        }

        case 'batch_create_notes': {
          const args = validateArgs<BatchCreateNotesArgs>(request.params.arguments, ['notes']);
          const { notes, stopOnError } = args;
          const results: BatchOperation<any>['results'] = [];

          for (const noteData of notes) {
            try {
              const note = {
                deckName: noteData.deck,
                modelName: noteData.type === 'Basic' ? '基础' : '填空题',
                fields: noteData.fields || (noteData.type === 'Basic'
                  ? { 正面: noteData.front, 背面: noteData.back }
                  : { 正面: noteData.text, 背面: noteData.backExtra || '' }),
                tags: noteData.tags || [],
              };

              const noteId = await this.invokeAnki('addNote', { note });
              results.push({ success: true, data: noteId });
            } catch (error) {
              results.push({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              if (stopOnError) {
                break;
              }
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ results }, null, 2),
              },
            ],
          };
        }

        case 'search_notes': {
          const args = validateArgs<SearchNotesArgs>(request.params.arguments, ['query']);
          const noteIds = await this.invokeAnki('findNotes', {
            query: args.query,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(noteIds, null, 2),
              },
            ],
          };
        }

        case 'get_note_info': {
          const args = validateArgs<GetNoteInfoArgs>(request.params.arguments, ['noteId']);
          const info = await this.invokeAnki('notesInfo', {
            notes: [args.noteId],
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(info[0], null, 2),
              },
            ],
          };
        }

        case 'update_note': {
          const args = validateArgs<UpdateNoteArgs>(request.params.arguments, ['id', 'fields']);
          const { id, fields, tags } = args;
          const note = { id, fields };
          if (tags) {
            await this.invokeAnki('clearTags', { notes: [id] });
            await this.invokeAnki('addTags', {
              notes: [id],
              tags: tags.join(' '),
            });
          }
          await this.invokeAnki('updateNoteFields', { note });
          return {
            content: [
              {
                type: 'text',
                text: `Updated note: ${id}`,
              },
            ],
          };
        }

        case 'delete_note': {
          const args = validateArgs<DeleteNoteArgs>(request.params.arguments, ['noteId']);
          await this.invokeAnki('deleteNotes', {
            notes: [args.noteId],
          });
          return {
            content: [
              {
                type: 'text',
                text: `Deleted note: ${args.noteId}`,
              },
            ],
          };
        }

        case 'list_note_types':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(await this.invokeAnki('modelNames'), null, 2),
              },
            ],
          };

        case 'create_note_type': {
          const args = validateArgs<CreateNoteTypeArgs>(request.params.arguments, ['name', 'fields', 'templates']);
          const { name, fields, css, templates } = args;
          await this.invokeAnki('createModel', {
            modelName: name,
            inOrderFields: fields,
            css: css || '',
            cardTemplates: templates,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Created note type: ${name}`,
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Anki MCP server running on stdio');
  }
}

const server = new AnkiServer();
server.run().catch(console.error);
