import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { MockAnkiConnect } from './mockAnkiConnect.js';

export interface TestDeck {
    name: string;
}

// Track created test resources
let testResources: {
    decks: Set<string>;
    noteIds: Set<number>;
    noteTypes: Set<string>;
} = {
    decks: new Set(),
    noteIds: new Set(),
    noteTypes: new Set()
};

// Initialize test tracking
export function initializeTestTracking() {
    testResources = {
        decks: new Set(),
        noteIds: new Set(),
        noteTypes: new Set()
    };
}

// Clean up test resources
export async function cleanupTestResources(ankiConnect: MockAnkiConnect) {
    // Delete all test notes
    if (testResources.noteIds.size > 0) {
        await ankiConnect.deleteNotes({ notes: Array.from(testResources.noteIds) });
    }

    // Delete all test decks
    for (const deck of testResources.decks) {
        try {
            await ankiConnect.deleteDeck(deck);
        } catch (error) {
            console.error(`Failed to delete deck ${deck}:`, error);
        }
    }

    // Reset tracking
    initializeTestTracking();
}

export interface TestBasicNote {
    deck: string;
    front: string;
    back: string;
    tags: string[];
}

export interface TestClozeNote {
    deck: string;
    text: string;
    backExtra?: string;
    tags: string[];
}

export interface TestNoteType {
    name: string;
    fields: string[];
    css: string;
    templates: Array<{
        name: string;
        front: string;
        back: string;
    }>;
}

export function createTestDeck(): TestDeck {
    const deck = {
        name: `test_deck_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };
    testResources.decks.add(deck.name);
    return deck;
}

export function createTestBasicNote(deckName: string): TestBasicNote {
    const timestamp = Date.now();
    return {
        deck: deckName,
        front: `Test Front ${timestamp}`,
        back: `Test Back ${timestamp}`,
        tags: ['test', 'basic', `test_${timestamp}`]
    };
}

export function createTestClozeNote(deckName: string): TestClozeNote {
    const timestamp = Date.now();
    return {
        deck: deckName,
        text: `This is a {{c1::cloze deletion}} test ${timestamp}`,
        backExtra: `Additional back content ${timestamp}`,
        tags: ['test', 'cloze', `test_${timestamp}`]
    };
}

export function createTestNoteType(): TestNoteType {
    const name = `test_note_type_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    testResources.noteTypes.add(name);
    return {
        name,
        fields: ['Question', 'Answer', 'Notes'],
        css: '.card { font-family: arial; }',
        templates: [
            {
                name: 'Card 1',
                front: '{{Question}}',
                back: '{{FrontSide}}<hr id="answer">{{Answer}}<br><br>{{Notes}}'
            }
        ]
    };
}

export function expectError(error: unknown, message?: string) {
    expect(error).toBeInstanceOf(McpError);
    if (message) {
        expect((error as McpError).message).toContain(message);
    }
}
