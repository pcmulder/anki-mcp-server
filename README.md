# Anki MCP Server

A Model Context Protocol (MCP) server that enables LLMs to interact with Anki flashcard software through AnkiConnect.

## Features

### Tools
- `list_decks` - List all available Anki decks
- `create_deck` - Create a new Anki deck
- `create_note` - Create a new note (Basic or Cloze)
- `batch_create_notes` - Create multiple notes at once
- `search_notes` - Search for notes using Anki query syntax
- `get_note_info` - Get detailed information about a note
- `update_note` - Update an existing note
- `delete_note` - Delete a note
- `list_note_types` - List all available note types
- `create_note_type` - Create a new note type

## Prerequisites

1. [Anki](https://apps.ankiweb.net/) installed on your system
2. [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed in Anki

For detailed installation instructions, see [llms-install.md](llms-install.md).

## Development

### Setup

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. For development with auto-rebuild:
```bash
npm run watch
```

### Testing

Run the test suite:
```bash
npm test
```

This executes tests for:
- Server initialization
- AnkiConnect communication
- Note operations (create/read/update/delete)
- Deck management
- Error handling

### Debugging

Since MCP servers communicate over stdio, we recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npm run inspector
```

This provides a browser-based interface for:
- Monitoring MCP messages
- Testing tool invocations
- Viewing server logs
- Debugging communication issues

## Example Usage

1. Create a new deck:
```
Create a new Anki deck called "Programming"
```

2. Add a basic card:
```
Create an Anki card in the "Programming" deck with:
Front: What is a closure in JavaScript?
Back: A closure is the combination of a function and the lexical environment within which that function was declared.
```

3. Add a cloze deletion card:
```
Create a cloze card in the "Programming" deck with:
Text: In JavaScript, {{c1::const}} declares a block-scoped variable that cannot be {{c2::reassigned}}.
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests: `npm test`
4. Submit a pull request

## License

MIT License - see LICENSE file for details
