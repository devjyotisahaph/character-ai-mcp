---
description: Reply to all unread Beeper messages using Character AI as the response generator for human-sounding replies
---

# Reply to All Unreads (Beeper → Character AI → Beeper Pipeline)

## Why Character AI?
Claude/AI responses sound robotic and people can tell. Character AI generates replies that sound naturally human, with proper Taglish mixing, casual texting patterns, and real personality. We use CAI as a middleman to generate human-like replies, then send them back via Beeper.

## Prerequisites
- Beeper MCP connected (chats accessible)
- Character AI MCP connected with valid `CAI_TOKEN`

// turbo-all

## Step 1: Get All Unread Chats

```
mcp_beeper_search_chats({
  inbox: "primary",
  limit: 50,
  type: "single",
  unreadOnly: true
})
```

This returns all unread single (DM) chats. Save the list of contacts with their `chatID`, `senderName`, and unread count.

**SKIP**: Group chats, automated messages (SMART, Globe, etc.), and chats where the unread is just a reaction (no text to reply to).

## Step 2: Read Messages for Each Contact

For each unread chat, get the conversation context:

```
mcp_beeper_list_messages({ chatID: "<chatID>" })
```

Read the messages to understand:
- What the contact said (unread messages)
- Previous conversation context (tone, topics, relationship)
- Whether the contact uses English, Tagalog, or Taglish
- The relationship type (romantic partner, friend, casual acquaintance)

## Step 3: Find or Create a Character AI Character for Each Contact

For each contact, search Character AI for an existing character with their name:

```
mcp_character-ai_search_characters({ query: "<contact name>" })
```

**If a matching character is found** (check the results for a character YOU created with matching name):
- Use that `character_id`
- The character already knows this contacts vibe and conversation style

**If NO matching character exists**, check your recent chats for one:
```
mcp_character-ai_recent_chats()
```

**If still not found**, create a new one based on the Beeper conversation context:

```
mcp_character-ai_create_character({
  name: "<contact name>",
  greeting: "hiii",
  description: "A caring Filipino boyfriend who texts in casual Taglish with smooth natural charm. Uses lowercase, no apostrophes, texting shortcuts like lng, nmn, d. Never uses em dashes. Writes in short chunks like real texting. Matches the other persons energy and intimacy level. This character is used to generate replies for [contact name] on Beeper.",
  definition: "{{char}} is a sweet, caring Filipino guy who texts naturally in Taglish. {{char}} never uses apostrophes. {{char}} writes in short chunks like real texting. {{char}} matches the other persons energy level and intimacy. {{char}} uses casual language like haha, grabe, ayy, sige. {{char}} adapts to the contacts language: if they text in English, reply in English. If Taglish, reply in Taglish. {{char}} is the user replying to messages from [contact name]. The relationship dynamic is [romantic/friend/casual] based on conversation history.",
  visibility: "PRIVATE"
})
```

Save the `character_id` for this contact.

### Character Naming Convention
- Name the character exactly as the Beeper contact name (e.g. "Jensel517", "Lyann", "Beyoncei Rubio")
- This makes it easy to search and find later
- Each contact gets their own personalized character that learns their specific conversation style

### Character Lookup Logic (Pseudocode)
```
for each contact in unread_chats:
  1. search_characters(contact.name)
  2. if found AND created by me → use that character_id
  3. else check recent_chats() for matching name
  4. if found → use that character_id  
  5. else → create_character(contact.name) → save new character_id
```

## Step 4: Send to Character AI for Reply Generation + Swipe for Best Reply

Send the contacts message(s) to their specific Character AI character:

```
mcp_character-ai_send_message({
  character_id: "<contact_specific_character_id>",
  message: "<context + their message>"
})
```

**Message format to send to CAI:**
```
(context: this is a chat with [name]. they said: "[their unread messages]". previous convo was about [topic]. they use [language style]. relationship: [type]. reply naturally as if texting them back. keep it short, 1-2 sentences max. no asterisks, no parentheses, no emojis unless natural.)

[their actual message here]
```

### Step 4b: Swipe for Better Replies (regenerate_response)

After getting the first CAI reply, use `regenerate_response` to get 2-3 alternative replies (like the swipe arrows in the CAI app). This gives you multiple options to pick the best one:

```
# Save the turn_id from the initial response
turn_id = response.turn.turn_key.turn_id

# Swipe 1: Get alternative reply
mcp_character-ai_regenerate_response({
  character_id: "<character_id>",
  turn_id: "<turn_id>"
})

# Swipe 2: Get another alternative
mcp_character-ai_regenerate_response({
  character_id: "<character_id>",
  turn_id: "<turn_id>"
})
```

### Step 4c: Pick the Best Reply

Now you have 3 replies to choose from. Evaluate each one and pick the best based on:
- **Most natural sounding** - reads like real human texting, not AI
- **Correct length** - short 1-2 sentences, not too long
- **Matches their vibe** - correct language (English/Taglish), correct relationship level
- **No AI tells** - no apostrophes, no em dashes, no perfect grammar
- **Context-appropriate** - actually addresses what they said

**Pick criteria priority:**
1. Sounds most human and natural
2. Matches conversation tone and energy
3. Appropriate length (short > long)
4. No weird formatting or AI patterns

### Step 4d: Keep Trying Until You Get a Good Reply (NO LIMITS)

**There is NO limit on retries.** If the replies are boring, dull, or dry, keep going until you find a good one. Use a combination of `regenerate_response` (swipe) and blank send (empty message) as many times as needed:

```
# Loop until you get a reply thats good enough:

# Option A: Swipe again for another alternative
mcp_character-ai_regenerate_response({
  character_id: "<character_id>",
  turn_id: "<turn_id>"
})

# Option B: Blank send to get a follow-up / continuation
mcp_character-ai_send_message({
  character_id: "<character_id>",
  message: " "
})
# Then swipe THAT follow-up too if needed
```

**Keep retrying if:**
- Reply is too short or boring (just "okay", "nice", "haha")
- Reply doesnt continue the conversation
- Reply sounds robotic or unnatural
- Reply doesnt match their vibe or energy
- You need a follow-up question to keep things interesting

**What you can do with the results:**
- **Combine** a decent reply + a follow-up into one natural message
- **Replace** a boring reply entirely with a better follow-up
- **Mix and match** parts from different swipes into one reply
- **Blank send multiple times** to get CAI to keep generating continuations

**NEVER settle for a dry response. Keep swiping and blank sending until its good.**

## Step 5: Send Best Reply Back to Beeper

Take the BEST Character AI response from the 3 options and send it to the contact:

```
mcp_beeper_send_message({
  chatID: "<chatID>",
  text: "<best CAI reply after post-processing>"
})
```

**Post-processing the chosen reply:**
- Remove any asterisks (*action*) if present
- Remove any OOC text in parentheses
- Fix any weird formatting
- Keep it short and natural (1-2 sentences max)
- Make sure it matches the contacts language style
- Remove apostrophes (dont, cant, wont, youre)
- Remove em dashes and en dashes

## Step 6: Repeat for All Contacts

Process contacts in batches of 6 for efficiency:
1. Read 6 chats simultaneously
2. Search/create CAI characters for each (can parallelize searches)
3. Send each to CAI one at a time (CAI has rate limits)
4. Send all 6 replies to Beeper simultaneously
5. Move to next batch

## Step 7: Final Check

After processing all contacts, do one more unread check:

```
mcp_beeper_search_chats({
  inbox: "primary",
  limit: 50,
  type: "single",
  unreadOnly: true
})
```

If new unreads came in while processing, repeat the pipeline.

---

## Important Notes

### Per-Contact Character Benefits
- Each contact gets a dedicated CAI character that learns their specific vibe
- Better context retention since the character only talks to one person
- More personalized replies that match each contacts unique conversation style
- Easy to find later by searching the contacts name

### Batch Processing
- Process 6 contacts per batch to avoid overwhelming the system
- Read messages in parallel, send CAI messages sequentially, send Beeper replies in parallel
- Character searches can be parallelized

### Skipping Rules
- **Skip group chats** - only process single/DM chats
- **Skip automated** - SMART, Globe, GCash, etc. are not real people
- **Skip reaction-only** - if the unread is just a heart/emoji reaction, no text reply needed
- **Skip if already replied** - if the last message in chat is from the user, skip

### Relationship Detection
- **Romantic partner**: Uses "baby", "love", "babe" → mirror their terms
- **Male friends**: Use "bro", "pare", "tol" → casual energy
- **Female friends**: Use their name or neutral terms → only use "baby" if THEY use it first
- **Younger/kuya vibe**: Uses "po", "kuya" → respond with casual authority

### Language Matching
- If they text in pure English → reply in English
- If they text in Taglish → reply in Taglish
- If they text in pure Tagalog → reply in Tagalog
- Match their capitalization and punctuation patterns
- Never use apostrophes (dont, cant, wont, youre)
- Never use em dashes (—) or en dashes (–)

### Character AI Tips
- **ALWAYS use regenerate_response** to get 2-3 alternative replies before picking the best one
- The `regenerate_response` tool works like the swipe arrows in the CAI app
- Call it with the `character_id` and `turn_id` from the initial send_message response
- Each call gives a new alternative reply - do 2 swipes for 3 total options
- Pick the reply that sounds most natural and human
- Start a `new_conversation` if the CAI context gets polluted
- If ALL 3 replies are bad, try rewording your context message and send again
- Characters persist on CAI, so once created they stay forever
- The search_characters tool finds by name match, so consistent naming is important
