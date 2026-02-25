# Character AI MCP Server

An MCP server for **Character AI** with **53 tools** for searching, chatting, managing characters, scenes, voices, group chats, image generation, personas, styles, and more.

## Setup

### Install
```bash
git clone https://github.com/devjyotisahaph/character-ai-mcp.git
cd character-ai-mcp
npm install
```

### Get Your Auth Token

**Easiest method** — one console command:

1. Open **character.ai** in Chrome (log in if needed)
2. Press **F12** → click the **Console** tab
3. Paste this and press Enter:
   ```js
   JSON.parse(localStorage.getItem("char_token")).value
   ```
4. Copy the token string that appears

**Then save it (pick one):**

**Option A** — Run the helper script (recommended):
```bash
node get-token.js
```

**Option B** — Create a `.cai-token` file in the project folder and paste your token in it.

**Option C** — Set `CAI_TOKEN` environment variable in your MCP config.

> Tokens expire periodically. If you get auth errors, repeat the steps above.

### For AI Agents (Auto Token Grab)

If the agent has browser access, it can grab the token automatically with **zero user effort**:

1. Open `https://character.ai` in the browser (user must be logged in)
2. Wait for the page to load
3. List network requests and find any request to `neo.character.ai`
4. Read the request headers — look for `Authorization: Token <token>`
5. Extract the token value (the part after "Token ")
6. Save it to the `.cai-token` file in the MCP server directory

> **Note:** The `localStorage` method (`char_token` key) does not work in all browser environments. The network header sniffing method is more reliable.

### MCP Config

Add to your MCP config (e.g. `mcp_config.json`):

**If using .cai-token file (no env variable needed):**
```json
"character-ai": {
  "command": "node",
  "args": ["/path/to/character-ai-mcp/index.js"],
  "type": "stdio"
}
```

**If using env variable:**
```json
"character-ai": {
  "command": "node",
  "args": ["/path/to/character-ai-mcp/index.js"],
  "type": "stdio",
  "env": { "CAI_TOKEN": "your_token_here" }
}
```

---

## All 38 Tools

### Search & Discover

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_characters` | Search characters by query | `query` |
| `search_scenes` | Search scenes/scenarios | `query` |
| `search_voices` | Search voices | `query` |
| `get_trending` | Get trending characters | - |
| `get_featured` | Get featured characters | - |
| `get_categories` | Get character categories | - |
| `similar_characters` | Find similar characters | `character_id` |

### Character Info

| Tool | Description | Parameters |
|------|-------------|------------|
| `character_info` | Get character info | `character_id` |
| `character_info_detailed` | Get full details + definition (if public) | `character_id` |
| `character_voice` | Get character voice info | `character_id` |

### Single Chat

| Tool | Description | Parameters |
|------|-------------|------------|
| `send_message` | Send message, get reply | `character_id`, `message` |
| `regenerate_response` | Swipe/regenerate response | `character_id`, `turn_id` |
| `edit_message` | Edit a message | `character_id`, `candidate_id`, `turn_id`, `new_message` |
| `delete_message` | Delete a message | `character_id`, `turn_id` |
| `new_conversation` | Start fresh conversation | `character_id`, `with_greeting?` |

### Chat History & Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `chat_history` | Get message history | `character_id` |
| `conversation_list` | List all conversations with a character | `character_id` |
| `recent_chats` | List recent chats | - |
| `pin_message` | Pin/unpin a message | `character_id`, `turn_id`, `pin?` |
| `list_pinned_messages` | Get pinned messages | `chat_id` |
| `archive_conversation` | Archive/unarchive chat | `chat_id`, `archive?` |
| `rename_conversation` | Rename a chat | `chat_id`, `new_name` |
| `duplicate_conversation` | Clone a conversation | `chat_id`, `turn_id` |

### Group Chat

| Tool | Description | Parameters |
|------|-------------|------------|
| `group_chat_list` | List all group chats | - |
| `group_chat_create` | Create group chat room | `title`, `character_id` |
| `group_chat_send` | Send message in group | `room_id`, `message` |
| `group_chat_add_character` | Add character to group | `room_id`, `character_id` |
| `group_chat_remove_character` | Remove character from group | `room_id`, `character_id` |
| `group_chat_delete` | Delete a group chat | `room_id` |

### Image Generation

| Tool | Description | Parameters |
|------|-------------|------------|
| `generate_image` | Generate image from prompt | `prompt` |
| `generate_avatar` | Generate avatar from prompt | `prompt` |

### Personas

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_personas` | List all personas | - |
| `create_persona` | Create persona | `name`, `description` |
| `update_persona` | Update persona | `persona_id`, `name`, `description` |
| `delete_persona` | Delete persona | `persona_id` |
| `set_persona` | Set persona for a character | `character_id`, `persona_id` |
| `set_default_persona` | Set default persona | `persona_id` |

### User & Account

| Tool | Description | Parameters |
|------|-------------|------------|
| `user_info` | Get your account info | - |
| `user_settings` | Get account settings | - |
| `liked_characters` | List characters you liked | - |

### Voices

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_voices` | List your created voices | - |
| `featured_voices` | Get featured voices | - |

---

## Common Workflows

### Chat with a character
```
search_characters({ query: "anime girl" })     → get character_id
character_info({ character_id: "XYZ" })         → check details
send_message({ character_id: "XYZ", message: "Hello!" })
regenerate_response({ character_id: "XYZ", turn_id: "..." })  → swipe
```

### Group chat with multiple characters
```
search_characters({ query: "detective" })       → get IDs
group_chat_create({ title: "Mystery Room", character_id: "ABC" })
group_chat_add_character({ room_id: "...", character_id: "DEF" })
group_chat_send({ room_id: "...", message: "Whos the killer?" })
```

### Manage personas
```
create_persona({ name: "Adventurer", description: "Brave explorer..." })
set_default_persona({ persona_id: "..." })
set_persona({ character_id: "XYZ", persona_id: "..." })
```

### Generate images
```
generate_image({ prompt: "sunset over mountains, anime style" })
generate_avatar({ prompt: "warrior princess with silver hair" })
```

### Beeper Auto-Reply Pipeline (Beeper → CAI → Beeper)
Uses Character AI to generate human-sounding replies for Beeper messages.
CAI replies feel natural and human unlike Claude which sounds robotic.

```
# 1. Get unread Beeper chats
mcp_beeper_search_chats({ unreadOnly: true, type: "single" })

# 2. Read messages for context
mcp_beeper_list_messages({ chatID: "..." })

# 3. Send to CAI character with context for reply generation
send_message({ character_id: "JBCxeSf0wJTEhlGbOBJMxyTdFfTK41md4GI9weJantg",
  message: "(context: [name] said '[msg]'. reply naturally)" })

# 4. Send CAI reply back to Beeper
mcp_beeper_send_message({ chatID: "...", text: "<CAI response>" })
```

Full workflow: [reply-to-unreads.md](./reply-to-unreads.md)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `CAI_TOKEN required` | Set token in mcp_config.json |
| `401` / login failed | Token expired, get a new one from DevTools |
| Character no response | Try again or check character_id |
| `definition not visible` | Character definition set to private |
| Server crash on start | Run `npm install` |

## Tech Stack

- **Runtime:** Node.js (ESM)
- **MCP SDK:** `@modelcontextprotocol/sdk` v1.12+
- **Character AI:** `cainode` v1.2.3
- **Transport:** stdio
