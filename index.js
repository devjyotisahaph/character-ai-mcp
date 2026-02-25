import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const { CAINode } = await import("cainode");

// Token loading: env variable > .cai-token file
const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, '.cai-token');

let CAI_TOKEN = process.env.CAI_TOKEN;
if (!CAI_TOKEN && existsSync(TOKEN_FILE)) {
  CAI_TOKEN = readFileSync(TOKEN_FILE, 'utf-8').trim();
}
if (!CAI_TOKEN) {
  console.error("ERROR: No Character AI token found.");
  console.error("");
  console.error("Easy setup: run 'node get-token.js' to save your token.");
  console.error("");
  console.error("Or set CAI_TOKEN environment variable in your MCP config.");
  process.exit(1);
}

let client = null;
let isLoggedIn = false;

async function ensureLoggedIn() {
  if (!isLoggedIn || !client) {
    client = new CAINode();
    await client.login(CAI_TOKEN);
    isLoggedIn = true;
  }
  return client;
}

function json(data) { return JSON.stringify(data, null, 2); }
function ok(text) { return { content: [{ type: "text", text }] }; }
function err(msg) { return { content: [{ type: "text", text: msg }], isError: true }; }

const server = new McpServer({ name: "character-ai", version: "2.0.0" });

// ===================== SEARCH & DISCOVER =====================

server.tool("search_characters", "Search for Character AI characters by query.", {
  query: z.string().describe("Search query to find characters"),
}, async ({ query }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Search results for "${query}":\n\n${json(await c.search.characters(query))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("search_scenes", "Search for scenes/scenarios on Character AI.", {
  query: z.string().describe("Search query for scenes"),
}, async ({ query }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Scenes for "${query}":\n\n${json(await c.search.scenes(query))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("search_voices", "Search for available voices on Character AI.", {
  query: z.string().describe("Search query for voices"),
}, async ({ query }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Voices for "${query}":\n\n${json(await c.search.voices(query))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("get_trending", "Get trending characters on Character AI.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Trending characters:\n\n${json(await c.search.trending())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("get_featured", "Get featured characters on Character AI.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Featured characters:\n\n${json(await c.explore.featured())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("get_categories", "Get character categories on Character AI.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Categories:\n\n${json(await c.explore.character_categories())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("similar_characters", "Find characters similar to a given character.", {
  character_id: z.string().describe("Character ID to find similar characters for"),
}, async ({ character_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Similar characters:\n\n${json(await c.explore.simillar_char(character_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== CHARACTER INFO =====================

server.tool("character_info", "Get information about a character.", {
  character_id: z.string().describe("The character ID"),
}, async ({ character_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Character info:\n\n${json(await c.character.info(character_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("character_info_detailed", "Get FULL detailed character info including definition (only works if definition is public).", {
  character_id: z.string().describe("The character ID"),
}, async ({ character_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const info = await c.character.info_detailed();
    await c.character.disconnect();
    return ok(`Detailed character info:\n\n${json(info)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("character_voice", "Get the current voice info for a character.", {
  character_id: z.string().describe("The character ID"),
}, async ({ character_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Voice info:\n\n${json(await c.character.current_voice(character_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== CHARACTER CREATION (Direct API) =====================

async function caiApiCall(endpoint, body) {
  const res = await fetch(`https://neo.character.ai${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${CAI_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return await res.json();
}

server.tool("create_character", "Create a new AI character on Character AI.", {
  name: z.string().describe("Character name (required)"),
  greeting: z.string().describe("First message the character sends when chat starts"),
  title: z.string().optional().describe("Short tagline for the character card"),
  description: z.string().optional().describe("Leave empty unless specified. Detailed personality, backstory, traits (max 500 chars)"),
  definition: z.string().optional().describe("Advanced behavior definition with example dialogues. Use {{char}} and {{user}} variables"),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional().describe("Character visibility (default: PRIVATE)"),
}, async ({ name, greeting, title, description, definition, visibility }) => {
  try {
    await ensureLoggedIn();
    const greetingText = greeting || "";
    const body = {
      name,
      greeting: greetingText,
      greetings: [greetingText],
      title: title || "",
      description: description || "",
      definition: definition || "",
      visibility: visibility || "PRIVATE",
      copyable: false,
      dynamic_greeting_enabled: false,
      allow_dynamic_greeting: true,
      voice_id: "",
      default_voice_id: "",
      tags: [],
      categories: [],
      additional_greetings: [],
      avatar_rel_path: "",
      img_gen_enabled: false,
      base_img_prompt: "",
      strip_img_prompt_from_msg: false,
      identifier: "id:" + crypto.randomUUID(),
    };
    const result = await caiApiCall("/character/v1/create_character", body);
    return ok(`Character created!\n\n${json(result)}`);
  } catch (e) { return err(`Error creating character: ${e.message}`); }
});

server.tool("update_character", "Update an existing character's attributes.", {
  character_id: z.string().describe("External ID of the character to update"),
  name: z.string().optional().describe("New name"),
  greeting: z.string().optional().describe("New greeting message"),
  title: z.string().optional().describe("New tagline"),
  description: z.string().optional().describe("New description"),
  definition: z.string().optional().describe("New definition"),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional().describe("New visibility"),
}, async ({ character_id, name, greeting, title, description, definition, visibility }) => {
  try {
    await ensureLoggedIn();
    const body = { external_id: character_id };
    if (name !== undefined) body.name = name;
    if (greeting !== undefined) body.greeting = greeting;
    if (title !== undefined) body.title = title;
    if (description !== undefined) body.description = description;
    if (definition !== undefined) body.definition = definition;
    if (visibility !== undefined) body.visibility = visibility;
    const result = await caiApiCall("/character/v1/update_character", body);
    return ok(`Character updated!\n\n${json(result)}`);
  } catch (e) { return err(`Error updating character: ${e.message}`); }
});

// ===================== SINGLE CHAT =====================

server.tool("send_message", "Send a message to a character and get their response.", {
  character_id: z.string().describe("Character ID to chat with"),
  message: z.string().describe("Message to send"),
}, async ({ character_id, message }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const response = await c.character.send_message(message, false, "");
    await c.character.disconnect();
    return ok(`Character response:\n\n${json(response)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("regenerate_response", "Regenerate/swipe to get an alternative character response.", {
  character_id: z.string().describe("Character ID"),
  turn_id: z.string().describe("Turn ID of the message to regenerate"),
}, async ({ character_id, turn_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const response = await c.character.generate_turn_candidate(turn_id);
    await c.character.disconnect();
    return ok(`Alternative response:\n\n${json(response)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("edit_message", "Edit a message in a character chat.", {
  character_id: z.string().describe("Character ID"),
  candidate_id: z.string().describe("Candidate ID of the message"),
  turn_id: z.string().describe("Turn ID of the message"),
  new_message: z.string().describe("New message content"),
}, async ({ character_id, candidate_id, turn_id, new_message }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const result = await c.character.edit_message(candidate_id, turn_id, new_message);
    await c.character.disconnect();
    return ok(`Message edited:\n\n${json(result)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("delete_message", "Delete a message from a character chat.", {
  character_id: z.string().describe("Character ID"),
  turn_id: z.string().describe("Turn ID of the message to delete"),
}, async ({ character_id, turn_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const result = await c.character.delete_message(turn_id);
    await c.character.disconnect();
    return ok(`Message deleted:\n\n${json(result)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("new_conversation", "Start a new conversation with a character (saves current one to history).", {
  character_id: z.string().describe("Character ID to start a new conversation with"),
  with_greeting: z.boolean().optional().describe("Include greeting message (default: true)"),
}, async ({ character_id, with_greeting }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const result = await c.character.create_new_conversation(with_greeting !== false);
    await c.character.disconnect();
    return ok(`New conversation created:\n\n${json(result)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

// ===================== CHAT HISTORY & MANAGEMENT =====================

server.tool("chat_history", "Get message history for a character conversation.", {
  character_id: z.string().describe("Character ID to get history for"),
}, async ({ character_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const history = await c.chat.history_chat_turns();
    await c.character.disconnect();
    return ok(`Chat history:\n\n${json(history)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("conversation_list", "List all conversation histories with a character.", {
  character_id: z.string().describe("Character ID"),
}, async ({ character_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const list = await c.chat.history_conversation_list();
    await c.character.disconnect();
    return ok(`Conversation list:\n\n${json(list)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("recent_chats", "List recent chat activity.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Recent chats:\n\n${json(await c.character.recent_list())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("pin_message", "Pin or unpin a message in a chat.", {
  character_id: z.string().describe("Character ID"),
  turn_id: z.string().describe("Turn ID of the message to pin"),
  pin: z.boolean().optional().describe("True to pin, false to unpin (default: true)"),
}, async ({ character_id, turn_id, pin }) => {
  try {
    const c = await ensureLoggedIn();
    await c.character.connect(character_id);
    const result = await c.chat.pin_message(turn_id, pin !== false);
    await c.character.disconnect();
    return ok(`Message ${pin !== false ? "pinned" : "unpinned"}:\n\n${json(result)}`);
  } catch (e) {
    try { await client?.character?.disconnect(); } catch (_) { }
    return err(`Error: ${e.message}`);
  }
});

server.tool("list_pinned_messages", "Get all pinned messages in a chat.", {
  chat_id: z.string().describe("Chat ID to get pinned messages from"),
}, async ({ chat_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Pinned messages:\n\n${json(await c.chat.list_pinned_message(chat_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("archive_conversation", "Archive or unarchive a conversation.", {
  chat_id: z.string().describe("Chat ID"),
  archive: z.boolean().optional().describe("True to archive, false to unarchive (default: true)"),
}, async ({ chat_id, archive }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.chat.archive_conversation(chat_id, archive !== false);
    return ok(`Conversation ${archive !== false ? "archived" : "unarchived"}:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("rename_conversation", "Rename a conversation.", {
  chat_id: z.string().describe("Chat ID"),
  new_name: z.string().describe("New name for the conversation"),
}, async ({ chat_id, new_name }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.chat.rename_conversation(chat_id, new_name);
    return ok(`Conversation renamed:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("duplicate_conversation", "Duplicate a conversation up to a specific point.", {
  chat_id: z.string().describe("Chat ID to duplicate"),
  turn_id: z.string().describe("Turn ID to duplicate up to"),
}, async ({ chat_id, turn_id }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.chat.duplicate_conversation(chat_id, turn_id);
    return ok(`Conversation duplicated:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== GROUP CHAT =====================

server.tool("group_chat_list", "List all your group chats.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Group chats:\n\n${json(await c.group_chat.list())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("group_chat_create", "Create a new group chat room with a character.", {
  title: z.string().describe("Name/title for the group chat room"),
  character_id: z.string().describe("Character ID to add to the room"),
}, async ({ title, character_id }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.group_chat.create(title, character_id);
    return ok(`Group chat created:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("group_chat_send", "Send a message in a group chat.", {
  room_id: z.string().describe("Room ID of the group chat"),
  message: z.string().describe("Message to send"),
}, async ({ room_id, message }) => {
  try {
    const c = await ensureLoggedIn();
    await c.group_chat.connect(room_id);
    const result = await c.group_chat.send_message(message);
    const response = await c.group_chat.generate_turn();
    await c.group_chat.disconnect(room_id);
    return ok(`Group chat response:\n\n${json(response)}`);
  } catch (e) {
    return err(`Error: ${e.message}`);
  }
});

server.tool("group_chat_add_character", "Add a character to an existing group chat.", {
  room_id: z.string().describe("Room ID"),
  character_id: z.string().describe("Character ID to add"),
}, async ({ room_id, character_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.group_chat.connect(room_id);
    const result = await c.group_chat.char_add(character_id);
    await c.group_chat.disconnect(room_id);
    return ok(`Character added to group:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("group_chat_remove_character", "Remove a character from a group chat.", {
  room_id: z.string().describe("Room ID"),
  character_id: z.string().describe("Character ID to remove"),
}, async ({ room_id, character_id }) => {
  try {
    const c = await ensureLoggedIn();
    await c.group_chat.connect(room_id);
    const result = await c.group_chat.char_remove(character_id);
    await c.group_chat.disconnect(room_id);
    return ok(`Character removed from group:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("group_chat_delete", "Delete a group chat room.", {
  room_id: z.string().describe("Room ID to delete"),
}, async ({ room_id }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.group_chat.delete(room_id);
    return ok(`Group chat deleted:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== IMAGE GENERATION =====================

server.tool("generate_image", "Generate an image using a text prompt.", {
  prompt: z.string().describe("Text prompt describing the image to generate"),
}, async ({ prompt }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.image.generate_image(prompt);
    return ok(`Generated image:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("generate_avatar", "Generate an avatar image using a text prompt.", {
  prompt: z.string().describe("Text prompt describing the avatar to generate"),
}, async ({ prompt }) => {
  try {
    const c = await ensureLoggedIn();
    const result = await c.image.generate_avatar(prompt);
    return ok(`Generated avatar:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== PERSONAS =====================

server.tool("list_personas", "List all your personas.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Your personas:\n\n${json(await c.persona.list())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("create_persona", "Create a new persona.", {
  name: z.string().describe("Persona name"),
  description: z.string().describe("Personality traits, background, preferences"),
}, async ({ name, description }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Persona created:\n\n${json(await c.persona.create(name, description))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("update_persona", "Update an existing persona.", {
  persona_id: z.string().describe("Persona ID to update"),
  name: z.string().describe("New persona name"),
  description: z.string().describe("New description"),
}, async ({ persona_id, name, description }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Persona updated:\n\n${json(await c.persona.update(persona_id, name, description))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("delete_persona", "Delete a persona.", {
  persona_id: z.string().describe("Persona ID to delete"),
}, async ({ persona_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Persona deleted:\n\n${json(await c.persona.delete(persona_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("set_persona", "Set which persona to use for a specific character.", {
  character_id: z.string().describe("Character ID"),
  persona_id: z.string().describe("Persona ID to use"),
}, async ({ character_id, persona_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Persona set:\n\n${json(await c.persona.set_character(character_id, persona_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("set_default_persona", "Set a persona as your default across all chats.", {
  persona_id: z.string().describe("Persona ID to set as default"),
}, async ({ persona_id }) => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Default persona set:\n\n${json(await c.persona.set_default(persona_id))}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== USER =====================

server.tool("user_info", "Get your Character AI account information.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Your account info:\n\n${json(c.user.info)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("user_settings", "Get your account settings.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Settings:\n\n${json(await c.user.settings())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("liked_characters", "Get list of characters you have liked/voted for.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Liked characters:\n\n${json(await c.user.liked_character_list())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== VOICE =====================

server.tool("list_voices", "List voices you have created.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Your voices:\n\n${json(await c.voice.user_created_list())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("featured_voices", "Get featured/popular voices.", {}, async () => {
  try {
    const c = await ensureLoggedIn();
    return ok(`Featured voices:\n\n${json(await c.explore.featured_voices())}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== SCENE CREATION (Direct API) =====================

async function caiApiGet(endpoint) {
  const res = await fetch(`https://neo.character.ai${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${CAI_TOKEN}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return await res.json();
}

async function caiPlusApiCall(endpoint, body) {
  const res = await fetch(`https://plus.character.ai${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${CAI_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return await res.json();
}

server.tool("create_scene", "Create a new scene/scenario on Character AI. Scenes have a setting, player goal, intro, greeting, name, and tags.", {
  name: z.string().describe("Scene name/title (max 40 chars, required)"),
  character_id: z.string().describe("Character ID to use in the scene"),
  scene_setting: z.string().describe("Scene setting - high-level description of the environment and context (max 650 chars)"),
  player_goal: z.string().describe("Player goal - what the user should try to accomplish (max 120 chars)"),
  intro: z.string().describe("Introduce this scene - opening text the audience sees before entering (max 650 chars)"),
  greeting: z.string().describe("Character greeting - first message the character sends when scene starts (max 1200 chars)"),
  tags: z.array(z.string()).optional().describe("Tags for the scene (e.g. ['Fantasy', 'Romance', 'Mystery'])"),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional().describe("Scene visibility (default: PRIVATE)"),
}, async ({ name, character_id, scene_setting, player_goal, intro, greeting, tags, visibility }) => {
  try {
    await ensureLoggedIn();
    const body = {
      name,
      description: scene_setting || "",
      goal: player_goal || "",
      intro: intro || "",
      greeting: greeting || "",
      character_id,
      visibility: visibility || "PRIVATE",
      tags: tags || [],
    };
    const result = await caiApiCall("/chat/scene/create/", body);
    return ok(`Scene created!\n\n${json(result)}`);
  } catch (e) { return err(`Error creating scene: ${e.message}`); }
});

server.tool("create_voice", "Create a new voice on Character AI using a text prompt.", {
  name: z.string().describe("Voice name"),
  description: z.string().optional().describe("Voice description"),
  voice_prompt: z.string().describe("Text prompt describing the voice characteristics (e.g. 'deep male voice, warm and calm')"),
  visibility: z.enum(["public", "private"]).optional().describe("Voice visibility (default: private)"),
}, async ({ name, description, voice_prompt, visibility }) => {
  try {
    await ensureLoggedIn();
    const body = {
      name,
      description: description || "",
      voice_prompt: voice_prompt || "",
      visibility: visibility || "private",
    };
    const result = await caiApiCall("/multimodal/api/v1/voices/", body);
    return ok(`Voice created!\n\n${json(result)}`);
  } catch (e) { return err(`Error creating voice: ${e.message}`); }
});

server.tool("set_character_voice", "Set which voice a character uses.", {
  character_id: z.string().describe("Character ID to set voice for"),
  voice_id: z.string().describe("Voice ID to assign to the character"),
}, async ({ character_id, voice_id }) => {
  try {
    await ensureLoggedIn();
    const body = {
      character_external_id: character_id,
      voice_id: voice_id,
    };
    const result = await caiPlusApiCall("/chat/character/voice_override/update/", body);
    return ok(`Voice set!\n\n${json(result)}`);
  } catch (e) { return err(`Error setting voice: ${e.message}`); }
});

server.tool("get_scene", "Get details about a specific scene.", {
  scene_id: z.string().describe("Scene ID to get details for"),
}, async ({ scene_id }) => {
  try {
    await ensureLoggedIn();
    const result = await caiApiGet(`/chat/character/scene/${scene_id}/`);
    return ok(`Scene details:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("get_voice_info", "Get detailed info about a specific voice by ID.", {
  voice_id: z.string().describe("Voice ID to get info for"),
}, async ({ voice_id }) => {
  try {
    await ensureLoggedIn();
    const result = await caiApiGet(`/multimodal/api/v1/voices/${voice_id}/`);
    return ok(`Voice info:\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== STYLE & EXTRAS =====================

server.tool("set_character_style", "Set the AI response style/model for a character chat. In the CAI app, this is under 'Style' or 'New chat' menu. Each style changes how the AI responds.", {
  character_id: z.string().describe("Character ID to set style for"),
  style: z.string().optional().describe("Style name. Available: 'roar' (speed/smarts, DEFAULT), 'pipsqueak' (concise/short), 'deepsqueak' (roleplay), 'nyan' (thoughtful), 'softlaunch', 'dynamic' (experimental), 'goro' (experimental), 'default'"),
  start_new_chat: z.boolean().optional().describe("If true, starts a new chat with the selected style. If false, continues current chat with new style (default: false)"),
}, async ({ character_id, style, start_new_chat }) => {
  try {
    await ensureLoggedIn();
    const body = {
      external_id: character_id,
      style_name: (style || "roar").toLowerCase(),
      new_chat: start_new_chat || false,
    };
    const result = await caiApiCall("/chat/character/style/update/", body);
    return ok(`Style set to "${style}"${start_new_chat ? " (new chat started)" : ""}!\n\n${json(result)}`);
  } catch (e) { return err(`Error setting style: ${e.message}`); }
});

server.tool("customize_chat", "Customize the chat appearance (wallpaper and chat bubble color). This is the 'Customize' menu in CAI (c.ai+ feature).", {
  character_id: z.string().describe("Character ID to customize chat for"),
  chat_color: z.string().optional().describe("Chat bubble color name (e.g. 'blue', 'green', 'purple', 'pink', 'orange', 'red')"),
}, async ({ character_id, chat_color }) => {
  try {
    await ensureLoggedIn();
    const body = {
      external_id: character_id,
      chat_color: chat_color || "",
    };
    const result = await caiApiCall("/chat/character/customize/", body);
    return ok(`Chat customized!\n\n${json(result)}`);
  } catch (e) { return err(`Error customizing chat: ${e.message}`); }
});

server.tool("like_character", "Like/upvote a character (or unlike).", {
  character_id: z.string().describe("Character ID to like"),
  like: z.boolean().optional().describe("True to like, false to unlike (default: true)"),
}, async ({ character_id, like }) => {
  try {
    await ensureLoggedIn();
    const shouldLike = like !== false;
    const body = {
      external_id: character_id,
      label: shouldLike ? "like" : "none",
    };
    const result = await caiApiCall("/chat/character/vote/", body);
    return ok(`Character ${shouldLike ? "liked" : "unliked"}!\n\n${json(result)}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

server.tool("get_character_link", "Get a shareable link for a character.", {
  character_id: z.string().describe("Character ID to get link for"),
}, async ({ character_id }) => {
  try {
    return ok(`Shareable link:\n\nhttps://character.ai/chat/${character_id}`);
  } catch (e) { return err(`Error: ${e.message}`); }
});

// ===================== START SERVER =====================

const transport = new StdioServerTransport();
await server.connect(transport);
