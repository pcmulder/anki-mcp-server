import { McpError } from '@modelcontextprotocol/sdk/types.js';

export interface TestDeck {
    name: string;
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
    return {
        name: `Test Deck ${Date.now()}`
    };
}

export function createTestBasicNote(deckName: string): TestBasicNote {
    return {
        deck: deckName,
        front: 'Test Front',
        back: 'Test Back',
        tags: ['test', 'basic']
    };
}

export function createTestClozeNote(deckName: string): TestClozeNote {
    return {
        deck: deckName,
        text: 'This is a {{c1::cloze deletion}} test',
        backExtra: 'Additional back content',
        tags: ['test', 'cloze']
    };
}

export function createTestNoteType(): TestNoteType {
    const name = `Test Note Type ${Date.now()}`;
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
