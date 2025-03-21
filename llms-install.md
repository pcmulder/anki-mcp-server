# Installing anki-mcp-server with LLMs

This guide provides step-by-step instructions for installing and configuring the anki-mcp-server MCP server using Large Language Models (LLMs).

## Prerequisites

1. Install [Anki](https://apps.ankiweb.net/) on your system
2. Install [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on in Anki
   - Open Anki
   - Go to Tools > Add-ons > Get Add-ons
   - Enter code: 2055492159
   - Restart Anki 
   
## Installation Steps

### Usage with Claude Desktop

Add the server to your claude_desktop_config.json:

Add to your Claude configuration file:
- MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anki": {
      "command": "npx",
      "args": ["--yes", "anki-mcp-server"]
    }
  }
}
```

### Configuration for Cline

Add the dall-e server to your Cline MCP settings file inside VSCode's settings `cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "anki": {
      "command": "npx",
      "args": ["--yes","anki-mcp-server"]
    }
  }
}
```



## Verification

To verify the installation:

1. Ensure Anki is running
2. Start Claude
3. Try creating a new note with the following prompt:

```
Create an Anki card in the "Default" deck with:
Front: What is the capital of France?
Back: Paris
```

## Troubleshooting

1. "Cannot connect to AnkiConnect" error:
   - Ensure Anki is running
   - Check if AnkiConnect is properly installed
   - Restart Anki and try again

2. "Permission denied" when running the server:
   - Ensure the build file is executable:
   ```bash
   chmod +x build/index.js
   ```

3. "Deck not found" error:
   - Create the deck manually in Anki first
   - Check for exact deck name spelling

## Testing

To run the test suite:
```bash
npm test
```

This will verify:
- Server initialization
- AnkiConnect communication
- Note creation/deletion
- Deck operations

For development with auto-rebuild:
```bash
npm run watch
