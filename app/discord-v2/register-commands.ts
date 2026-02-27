import { REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const commands = [
  // 1. /search - Search for cards
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for cards')
    .addStringOption(opt =>
      opt
        .setName('name')
        .setDescription('Card name to search for')
        .setRequired(true)
    ),

  // 2. /binder - View binders (SIMPLIFIED: only user parameter)
  new SlashCommandBuilder()
    .setName('binder')
    .setDescription('View a user\'s binder(s) - shows selection menu for choosing specific binder')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('The Discord user (defaults to yourself)')
        .setRequired(false)
    ),

  // 3. /wants - View wants list
  new SlashCommandBuilder()
    .setName('wants')
    .setDescription('Get the wants list for a user')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('The Discord user')
        .setRequired(true)
    ),

  // 4. /trade - Simple trade analysis
  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('See what you and another user can trade')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('The user to check trades with')
        .setRequired(true)
    ),

  // 5. /deck - View a user's deck list
  new SlashCommandBuilder()
    .setName('deck')
    .setDescription('View a user\'s deck list')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('The Discord user (defaults to yourself)')
        .setRequired(false)
    ),

  // NEW: Context menu commands (right-click on users)
  new ContextMenuCommandBuilder()
    .setName('Show Binder')
    .setType(ApplicationCommandType.User),

  new ContextMenuCommandBuilder()
    .setName('Show Wants List')
    .setType(ApplicationCommandType.User),

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN as string);

(async () => {
  try {
    console.log('Registering slash commands and context menu commands...');
    console.log(`Registering ${commands.length} commands:`);
    
    // Log each command with its type
    commands.forEach(cmd => {
      const type = cmd.type === 2 ? 'Context Menu' : 'Slash Command';
      console.log(`  - ${cmd.name} (${type})`);
    });
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),      
      { body: commands }
    );
    
    console.log('✅ All commands registered successfully.');
    const slashCommands = commands.filter(c => c.type === 1 || !c.type).map(c => `/${c.name}`);
    const contextCommands = commands.filter(c => c.type === 2).map(c => `"${c.name}"`);
    
    if (slashCommands.length) console.log('Slash commands:', slashCommands.join(', '));
    if (contextCommands.length) console.log('Context menu commands:', contextCommands.join(', '));
    
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();
