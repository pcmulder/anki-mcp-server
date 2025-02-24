import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface AnkiNote {
    id: number;
    fields: Record<string, string>;
    tags: string[];
    modelName: string;
    deckName: string;
}

type AnkiHandler = (params: any) => Promise<any>;

export class MockAnkiConnect {
    private decks: Set<string>;
    private notes: Map<number, AnkiNote>;
    private noteTypes: Set<string>;
    private nextNoteId: number;

    constructor() {
        this.decks = new Set(['Default']);
        this.notes = new Map();
        this.noteTypes = new Set(['Basic', 'Cloze']);
        this.nextNoteId = 1;
    }

    private validateNoteFields(note: any) {
        if (!note) {
            throw new McpError(ErrorCode.InvalidParams, 'Note is required');
        }

        if (!note.deckName) {
            throw new McpError(ErrorCode.InvalidParams, 'Deck name is required');
        }

        if (!note.modelName) {
            throw new McpError(ErrorCode.InvalidParams, 'Model name is required');
        }

        if (!note.fields) {
            throw new McpError(ErrorCode.InvalidParams, 'Fields are required');
        }

        if (note.modelName === 'Basic') {
            if (!note.fields.Front) {
                throw new McpError(ErrorCode.InvalidParams, 'Front field is required for Basic notes');
            }
            if (!note.fields.Back) {
                throw new McpError(ErrorCode.InvalidParams, 'Back field is required for Basic notes');
            }
        }

        if (note.modelName === 'Cloze') {
            if (!note.fields.Text) {
                throw new McpError(ErrorCode.InvalidParams, 'Text field is required for Cloze notes');
            }
        }
    }

    deckNames: AnkiHandler = async () => {
        return Array.from(this.decks);
    };

    createDeck: AnkiHandler = async ({ deck }: { deck: string }) => {
        if (!deck) {
            throw new McpError(ErrorCode.InvalidParams, 'Deck name is required');
        }

        if (this.decks.has(deck)) {
            throw new McpError(ErrorCode.InvalidParams, `Deck already exists: ${deck}`);
        }
        this.decks.add(deck);
        return true;
    };

    addNote: AnkiHandler = async ({ note }: { note: any }) => {
        this.validateNoteFields(note);

        if (!this.decks.has(note.deckName)) {
            throw new McpError(ErrorCode.InvalidParams, `Deck not found: ${note.deckName}`);
        }

        if (!this.noteTypes.has(note.modelName)) {
            throw new McpError(ErrorCode.InvalidParams, `Note type not found: ${note.modelName}`);
        }

        const noteId = this.nextNoteId++;
        this.notes.set(noteId, {
            id: noteId,
            fields: { ...note.fields },
            tags: [...(note.tags || [])],
            modelName: note.modelName,
            deckName: note.deckName
        });
        return noteId;
    };

    findNotes: AnkiHandler = async ({ query }: { query: string }) => {
        if (!query) {
            throw new McpError(ErrorCode.InvalidParams, 'Search query is required');
        }

        return Array.from(this.notes.entries())
            .filter(([_, note]) =>
                Object.values(note.fields).some(value =>
                    value.toLowerCase().includes(query.toLowerCase())
                )
            )
            .map(([id]) => id);
    };

    notesInfo: AnkiHandler = async ({ notes }: { notes: number[] }) => {
        if (!Array.isArray(notes)) {
            throw new McpError(ErrorCode.InvalidParams, 'Notes parameter must be an array');
        }

        return notes
            .map(id => this.notes.get(id))
            .filter(Boolean)
            .map(note => ({
                ...note,
                tags: [...note!.tags]
            }));
    };

    updateNoteFields: AnkiHandler = async ({ note }: { note: { id: number; fields: Record<string, string> } }) => {
        if (!note) {
            throw new McpError(ErrorCode.InvalidParams, 'Note is required');
        }

        if (typeof note.id !== 'number') {
            throw new McpError(ErrorCode.InvalidParams, 'Note ID must be a number');
        }

        if (!note.fields || typeof note.fields !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, 'Fields must be an object');
        }

        const existingNote = this.notes.get(note.id);
        if (!existingNote) {
            throw new McpError(ErrorCode.InvalidParams, `Note not found: ${note.id}`);
        }

        existingNote.fields = {
            ...existingNote.fields,
            ...note.fields
        };
        return true;
    };

    deleteNotes: AnkiHandler = async ({ notes }: { notes: number[] }) => {
        if (!Array.isArray(notes)) {
            throw new McpError(ErrorCode.InvalidParams, 'Notes parameter must be an array');
        }

        notes.forEach(id => {
            if (!this.notes.has(id)) {
                throw new McpError(ErrorCode.InvalidParams, `Note not found: ${id}`);
            }
            this.notes.delete(id);
        });
        return true;
    };

    modelNames: AnkiHandler = async () => {
        return Array.from(this.noteTypes);
    };

    createModel: AnkiHandler = async ({ modelName, inOrderFields, css, cardTemplates }: any) => {
        if (!modelName) {
            throw new McpError(ErrorCode.InvalidParams, 'Model name is required');
        }

        if (!Array.isArray(inOrderFields) || inOrderFields.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, 'Fields array is required');
        }

        if (!Array.isArray(cardTemplates) || cardTemplates.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, 'Card templates array is required');
        }

        if (this.noteTypes.has(modelName)) {
            throw new McpError(ErrorCode.InvalidParams, `Note type already exists: ${modelName}`);
        }

        this.noteTypes.add(modelName);
        return true;
    };

    // Helper methods for testing
    reset() {
        this.decks = new Set(['Default']);
        this.notes.clear();
        this.noteTypes = new Set(['Basic', 'Cloze']);
        this.nextNoteId = 1;
    }

    getDeck(name: string) {
        return this.decks.has(name);
    }

    getNote(id: number) {
        const note = this.notes.get(id);
        if (!note) return undefined;
        return {
            ...note,
            tags: [...note.tags]
        };
    }
}
