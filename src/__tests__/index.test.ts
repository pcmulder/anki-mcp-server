import { jest } from '@jest/globals';
import axios, { AxiosStatic } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { MockAnkiConnect } from './helpers/mockAnkiConnect.js';
import {
    createTestDeck,
    createTestBasicNote,
    createTestClozeNote,
    createTestNoteType,
    expectError
} from './helpers/testUtils.js';

describe('AnkiServer', () => {
    let mockAxios: MockAdapter;
    let mockAnkiConnect: MockAnkiConnect;
    let axiosInstance: AxiosStatic;

    beforeAll(() => {
        // Create a fresh axios instance for testing
        axiosInstance = axios;
        // @ts-ignore - Type mismatch in axios-mock-adapter
        mockAxios = new MockAdapter(axiosInstance);
        mockAnkiConnect = new MockAnkiConnect();
    });

    beforeEach(() => {
        mockAnkiConnect.reset();
        mockAxios.reset();

        // Setup mock responses
        mockAxios.onPost('http://localhost:8765').reply(async (config) => {
            try {
                const request = JSON.parse(config.data);
                const method = request.action as keyof MockAnkiConnect;
                const handler = mockAnkiConnect[method];

                if (typeof handler === 'function') {
                    const result = await handler.bind(mockAnkiConnect)(request.params);
                    return [200, { result, error: null }];
                }
                throw new Error(`Invalid action: ${request.action}`);
            } catch (error) {
                if (error instanceof McpError) {
                    return [200, { result: null, error: error.message }];
                }
                return [500, { result: null, error: 'Internal server error' }];
            }
        });
    });

    afterAll(() => {
        mockAxios.restore();
    });

    describe('Deck Operations', () => {
        test('should list all available decks', async () => {
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'deckNames',
                version: 6,
                params: {}
            });
            expect(response.data.result).toContain('Default');
            expect(response.data.error).toBeNull();
        });

        test('should create a new deck', async () => {
            const testDeck = createTestDeck();
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'createDeck',
                version: 6,
                params: { deck: testDeck.name }
            });
            expect(response.data.result).toBe(true);
            expect(mockAnkiConnect.getDeck(testDeck.name)).toBe(true);
        });

        test('should handle duplicate deck creation', async () => {
            const testDeck = createTestDeck();
            // Create deck first time
            await axiosInstance.post('http://localhost:8765', {
                action: 'createDeck',
                version: 6,
                params: { deck: testDeck.name }
            });

            // Try to create same deck again
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'createDeck',
                version: 6,
                params: { deck: testDeck.name }
            });
            expect(response.data.error).toContain('Deck already exists');
        });
    });

    describe('Note Operations', () => {
        let testDeck: string;

        beforeEach(async () => {
            testDeck = createTestDeck().name;
            await axiosInstance.post('http://localhost:8765', {
                action: 'createDeck',
                version: 6,
                params: { deck: testDeck }
            });
        });

        describe('Basic Notes', () => {
            test('should create basic note', async () => {
                const note = createTestBasicNote(testDeck);
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'addNote',
                    version: 6,
                    params: {
                        note: {
                            deckName: note.deck,
                            modelName: 'Basic',
                            fields: {
                                Front: note.front,
                                Back: note.back
                            },
                            tags: note.tags
                        }
                    }
                });

                expect(response.data.result).toBeGreaterThan(0);
                const savedNote = mockAnkiConnect.getNote(response.data.result);
                expect(savedNote?.fields.Front).toBe(note.front);
                expect(savedNote?.fields.Back).toBe(note.back);
            });

            test('should handle missing required fields', async () => {
                const note = createTestBasicNote(testDeck);
                const { front, ...noteWithoutFront } = note;

                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'addNote',
                    version: 6,
                    params: {
                        note: {
                            deckName: noteWithoutFront.deck,
                            modelName: 'Basic',
                            fields: {
                                Back: noteWithoutFront.back
                            },
                            tags: noteWithoutFront.tags
                        }
                    }
                });

                expect(response.data.error).toBeTruthy();
            });
        });

        describe('Cloze Notes', () => {
            test('should create cloze note', async () => {
                const note = createTestClozeNote(testDeck);
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'addNote',
                    version: 6,
                    params: {
                        note: {
                            deckName: note.deck,
                            modelName: 'Cloze',
                            fields: {
                                Text: note.text,
                                Back: note.backExtra || ''
                            },
                            tags: note.tags
                        }
                    }
                });

                expect(response.data.result).toBeGreaterThan(0);
                const savedNote = mockAnkiConnect.getNote(response.data.result);
                expect(savedNote?.fields.Text).toBe(note.text);
                expect(savedNote?.fields.Back).toBe(note.backExtra);
            });
        });

        describe('Note Search and Retrieval', () => {
            let noteId: number;

            beforeEach(async () => {
                const note = createTestBasicNote(testDeck);
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'addNote',
                    version: 6,
                    params: {
                        note: {
                            deckName: note.deck,
                            modelName: 'Basic',
                            fields: {
                                Front: note.front,
                                Back: note.back
                            },
                            tags: note.tags
                        }
                    }
                });
                noteId = response.data.result;
            });

            test('should find notes by search query', async () => {
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'findNotes',
                    version: 6,
                    params: { query: 'Test Front' }
                });
                expect(response.data.result).toContain(noteId);
            });

            test('should get note info', async () => {
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'notesInfo',
                    version: 6,
                    params: { notes: [noteId] }
                });
                expect(response.data.result[0].id).toBe(noteId);
            });
        });

        describe('Note Updates and Deletion', () => {
            let noteId: number;

            beforeEach(async () => {
                const note = createTestBasicNote(testDeck);
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'addNote',
                    version: 6,
                    params: {
                        note: {
                            deckName: note.deck,
                            modelName: 'Basic',
                            fields: {
                                Front: note.front,
                                Back: note.back
                            },
                            tags: note.tags
                        }
                    }
                });
                noteId = response.data.result;
            });

            test('should update note fields', async () => {
                const newFront = 'Updated Front';
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'updateNoteFields',
                    version: 6,
                    params: {
                        note: {
                            id: noteId,
                            fields: {
                                Front: newFront
                            }
                        }
                    }
                });

                expect(response.data.result).toBe(true);
                const updatedNote = mockAnkiConnect.getNote(noteId);
                expect(updatedNote?.fields.Front).toBe(newFront);
            });

            test('should delete note', async () => {
                const response = await axiosInstance.post('http://localhost:8765', {
                    action: 'deleteNotes',
                    version: 6,
                    params: { notes: [noteId] }
                });

                expect(response.data.result).toBe(true);
                expect(mockAnkiConnect.getNote(noteId)).toBeUndefined();
            });
        });
    });

    describe('Note Type Operations', () => {
        test('should list available note types', async () => {
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'modelNames',
                version: 6,
                params: {}
            });
            expect(response.data.result).toContain('Basic');
            expect(response.data.result).toContain('Cloze');
        });

        test('should create custom note type', async () => {
            const noteType = createTestNoteType();
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'createModel',
                version: 6,
                params: {
                    modelName: noteType.name,
                    inOrderFields: noteType.fields,
                    css: noteType.css,
                    cardTemplates: noteType.templates
                }
            });

            expect(response.data.result).toBe(true);
            const types = await mockAnkiConnect.modelNames({});
            expect(types).toContain(noteType.name);
        });

        test('should handle duplicate note type creation', async () => {
            const noteType = createTestNoteType();
            // Create first time
            await axiosInstance.post('http://localhost:8765', {
                action: 'createModel',
                version: 6,
                params: {
                    modelName: noteType.name,
                    inOrderFields: noteType.fields,
                    css: noteType.css,
                    cardTemplates: noteType.templates
                }
            });

            // Try to create same type again
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'createModel',
                version: 6,
                params: {
                    modelName: noteType.name,
                    inOrderFields: noteType.fields,
                    css: noteType.css,
                    cardTemplates: noteType.templates
                }
            });

            expect(response.data.error).toContain('Note type already exists');
        });
    });

    describe('Error Handling', () => {
        test('should handle connection errors', async () => {
            mockAxios.reset();
            mockAxios.onPost('http://localhost:8765').networkError();

            await expect(axiosInstance.post('http://localhost:8765', {
                action: 'deckNames',
                version: 6,
                params: {}
            })).rejects.toThrow();
        });

        test('should handle invalid parameters', async () => {
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'addNote',
                version: 6,
                params: {
                    note: {
                        // Missing required fields
                        deckName: 'Default'
                    }
                }
            });

            expect(response.data.error).toBeTruthy();
        });

        test('should handle non-existent note updates', async () => {
            const response = await axiosInstance.post('http://localhost:8765', {
                action: 'updateNoteFields',
                version: 6,
                params: {
                    note: {
                        id: 99999,
                        fields: {
                            Front: 'New Front'
                        }
                    }
                }
            });

            expect(response.data.error).toContain('Note not found');
        });
    });
});
