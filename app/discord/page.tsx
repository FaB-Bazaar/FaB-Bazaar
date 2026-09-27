import Image from 'next/image'

// A how-to reference for the Discord bot: what each command does, on the first
// screen. Descriptions mirror app/discord-v2/register-commands.ts and the
// command handlers — keep them in sync when a command changes.

const DISCORD_INVITE = 'https://discord.gg/Rx8eBhhQtk'

const code = 'text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded'

const COMMANDS: { name: string; args: string; does: React.ReactNode }[] = [
  {
    name: '/search',
    args: 'name',
    does: <>Every printing of a card, with set, edition, foiling and TCGplayer prices. Each result has four buttons (below).</>,
  },
  {
    name: '/binder',
    args: '[user]',
    does: <>Your binders, or someone else&apos;s. Pick a binder from the menu; long binders are paged.</>,
  },
  {
    name: '/wants',
    args: 'user',
    does: <>Someone&apos;s wants list, with the printings they prefer.</>,
  },
  {
    name: '/trade',
    args: '[user] [store]',
    does: (
      <>
        Cards you have that they want, and cards they have that you want. With <code className={code}>store:</code>, it checks
        against everyone who follows that store.
      </>
    ),
  },
  {
    name: '/deck',
    args: '[user]',
    does: <>A deck list: yours, or someone else&apos;s.</>,
  },
  {
    name: '/needs',
    args: '',
    does: <>Pick one of your decks and get the cards you still need for it: any printing, or the exact printings in the deck.</>,
  },
]

const RIGHT_CLICK: [string, string][] = [
  ['Show Binder', 'Same as /binder for that person.'],
  ['Show Wants List', 'Same as /wants for that person.'],
  ['Deck Needs', 'Same as /needs, but the final list is posted in the channel.'],
]

const BUTTONS: [string, string][] = [
  ['Add to Binder', 'Pick a binder and the card is added to your collection.'],
  ['Add to Wants', 'Adds that printing to your wants list, so traders can see you are looking.'],
  ['Who Has', 'Every FaB Bazaar user who owns that printing.'],
  ['Who Wants', 'Everyone who has that card on their wants list.'],
]

const EXAMPLES: [string, string, string][] = [
  ['/search', 'd2d28237-f174-4b23-f2ba-ef5a61d6e900', 'Search results with prices and the four buttons'],
  ['/binder', 'bcbb7986-fe1b-4446-ee98-c775cfe8b700', 'A binder, paged'],
  ['/wants', 'a01ac0e6-2c69-4f0f-030d-5d73463bd000', 'A wants list'],
  ['/trade', '911b03e3-736d-4199-4f54-1263ebb2ef00', 'Trade matches between two users'],
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function DiscordPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Discord bot</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        The FaB Bazaar bot runs in the{' '}
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="font-medium text-[#5865F2] dark:text-[#7983F5] hover:underline">
          FaB Bazaar Discord
        </a>{' '}
        and uses the same Discord account you sign in with here, so your binders and wants are already there. Type a command in
        any channel where the bot is active.
      </p>

      <div className="mt-6 mb-10 overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-700">
        <table aria-label="Slash commands" className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/80 text-left text-xs text-gray-600 dark:text-gray-400">
            <tr>
              <th scope="col" className="py-2 px-3 font-medium">Command</th>
              <th scope="col" className="py-2 px-3 font-medium">What it does</th>
            </tr>
          </thead>
          <tbody>
            {COMMANDS.map(({ name, args, does }) => (
              <tr key={name} className="border-t border-gray-200 dark:border-gray-700 align-top">
                <th scope="row" className="py-2.5 px-3 text-left font-normal sm:whitespace-nowrap">
                  <code className="font-semibold text-[#5865F2] dark:text-[#7983F5]">{name}</code>
                  {args && <>{' '}<span className="block sm:inline font-mono text-xs text-gray-500 dark:text-gray-400">{args}</span></>}
                </th>
                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="-mt-8 mb-10 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-mono">[user]</span> is optional and defaults to you. Other people only see the binders you allow
        Discord commands for (binder settings).
      </p>

      <div className="grid gap-x-10 sm:grid-cols-2">
        <Section title="Right-click a user → Apps">
          <dl className="space-y-2 text-sm">
            {RIGHT_CLICK.map(([name, does]) => (
              <div key={name}>
                <dt className="font-medium text-gray-900 dark:text-gray-100">{name}</dt>
                <dd className="text-gray-700 dark:text-gray-300">{does}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Buttons on /search results">
          <dl className="space-y-2 text-sm">
            {BUTTONS.map(([name, does]) => (
              <div key={name}>
                <dt className="font-medium text-gray-900 dark:text-gray-100">{name}</dt>
                <dd className="text-gray-700 dark:text-gray-300">{does}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <Section title="Examples">
        <div className="grid gap-6 sm:grid-cols-2">
          {EXAMPLES.map(([cmd, imageId, caption]) => (
            <figure key={cmd}>
              <div className="relative w-full aspect-video bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden">
                <Image
                  src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${imageId}/public`}
                  alt={`Discord ${cmd} command: ${caption}`}
                  fill
                  className="object-contain"
                />
              </div>
              <figcaption className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                <code className="text-gray-900 dark:text-gray-100">{cmd}</code> · {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Notes">
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          <li>Anything you add or remove through the bot shows up on the website straight away, and the other way round.</li>
          <li>Most replies are only visible to you. The Deck Needs list is the exception: it posts in the channel.</li>
          <li>
            The bot runs in the FaB Bazaar Discord. If you run a store or playgroup server and want it there, ask in the
            Discord.
          </li>
          <li>Found a bug or want a feature? Post in the Discord&apos;s feedback channel.</li>
        </ul>
      </Section>
    </div>
  )
}
