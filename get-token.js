#!/usr/bin/env node

/**
 * Character AI Token Grabber
 * 
 * Automatically extracts your Character AI auth token from Chrome.
 * Run: node get-token.js
 * 
 * How it works:
 * 1. Opens Character AI in a temporary browser
 * 2. You log in normally (Google, email, etc.)
 * 3. It grabs your token automatically
 * 4. Saves it so you don't need to do this again
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, '.cai-token');

// Check if token already exists
if (existsSync(TOKEN_FILE)) {
    const savedToken = readFileSync(TOKEN_FILE, 'utf-8').trim();
    if (savedToken) {
        console.log('');
        console.log('✅ Token already saved!');
        console.log('');
        console.log('Your token:');
        console.log(savedToken);
        console.log('');
        console.log('To use a different token, delete the .cai-token file and run again.');
        console.log('Or paste a new token below (or press Enter to keep current):');

        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        const answer = await new Promise(resolve => rl.question('> ', resolve));
        rl.close();

        if (answer.trim()) {
            writeFileSync(TOKEN_FILE, answer.trim());
            console.log('✅ Token updated!');
        }
        process.exit(0);
    }
}

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║     Character AI Token Setup                      ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');
console.log('To get your token, follow these steps:');
console.log('');
console.log('  RECOMMENDED — Network header method:');
console.log('');
console.log('  1. Open https://character.ai in Chrome (log in if needed)');
console.log('  2. Press F12 to open DevTools');
console.log('  3. Click the "Network" tab');
console.log('  4. Reload the page');
console.log('  5. Filter for "neo.character.ai" or "plus.character.ai"');
console.log('  6. Click any request → Headers → find "Authorization: Token <token>"');
console.log('  7. Copy the token value (the part after "Token ")');
console.log('');
console.log('  ALTERNATIVE — Console method (may not work in all browsers):');
console.log('');
console.log('  1. Open https://character.ai in Chrome (log in if needed)');
console.log('  2. Press F12 > Console tab');
console.log('  3. Paste this and press Enter:');
console.log('');
console.log('     JSON.parse(localStorage.getItem("char_token")).value');
console.log('');
console.log('  4. If it returns a string, that\'s your token.');
console.log('     If it returns null, use the network method above.');
console.log('');
console.log('Paste your token below:');

const readline = await import('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const token = await new Promise(resolve => rl.question('> ', resolve));
rl.close();

if (!token.trim()) {
    console.log('❌ No token provided. Exiting.');
    process.exit(1);
}

// Clean the token (remove quotes, "Token " prefix, etc.)
let cleanToken = token.trim();
if (cleanToken.startsWith('"') && cleanToken.endsWith('"')) {
    cleanToken = cleanToken.slice(1, -1);
}
if (cleanToken.startsWith("'") && cleanToken.endsWith("'")) {
    cleanToken = cleanToken.slice(1, -1);
}
if (cleanToken.toLowerCase().startsWith('token ')) {
    cleanToken = cleanToken.substring(6);
}

writeFileSync(TOKEN_FILE, cleanToken);

console.log('');
console.log('✅ Token saved to .cai-token');
console.log('');
console.log('You can now use the MCP server! Add this to your MCP config:');
console.log('');
console.log('{');
console.log('  "character-ai": {');
console.log('    "command": "node",');
console.log(`    "args": ["${join(__dirname, 'index.js').replace(/\\/g, '/')}"]`);
console.log('  }');
console.log('}');
console.log('');
console.log('No need for CAI_TOKEN env variable - it reads from .cai-token automatically!');
