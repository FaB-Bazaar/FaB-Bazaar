import React, { useState } from 'react';
import { X, Filter, Copy, Check } from 'lucide-react';

interface SyntaxGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SyntaxGuideModal = ({ isOpen, onClose }: SyntaxGuideModalProps) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const CodeExample = ({ code, description }: { code: string; description: string }) => (
    <div className="flex items-center gap-2 group">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-sm font-mono bg-gray-800 text-green-400 px-3 py-1 rounded flex-1">
            {code}
          </code>
          <button
            onClick={() => copyToClipboard(code)}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-200 rounded"
            title="Copy to clipboard"
          >
            {copiedCode === code ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-600 ml-3">{description}</p>
      </div>
    </div>
  );

  const filterSections = [
    {
      title: "Price Filters",
      description: "Search by card price with comparison operators",
      examples: [
        { code: "p:<10", desc: "Cards under $10" },
        { code: "p:>50", desc: "Cards over $50" },
        { code: "p:25", desc: "Cards $25 or less" },
        { code: "p:<=100", desc: "Cards $100 or less" }
      ]
    },
    {
      title: "Power/Cost/Defense Filters",
      description: "Search by numeric stats with operators and multiple values",
      examples: [
        { code: "power>3", desc: "Power greater than 3" },
        { code: "cost:0,1,2", desc: "Cost 0, 1, or 2" },
        { code: "defense<4", desc: "Defense less than 4" },
        { code: "power!2,3", desc: "Exclude power 2 and 3" },
        { code: "cost>2", desc: "Cost 3 or higher" },
        { code: "def:2,3", desc: "Defense 2 or 3 (shorthand)" }
      ]
    },
    {
      title: "Type Filters",
      description: "Search by card types with flexible negation support",
      examples: [
        { code: "t:equipment", desc: "Equipment cards" },
        { code: "type:action", desc: "Action cards" },
        { code: "t:!generic", desc: "Exclude all generic cards" },
        { code: "t:necromancer,!generic", desc: "Necromancer cards but not generic" },
        { code: "type:action,attack", desc: "Action or attack cards" }
      ]
    },
    {
      title: "Hero Filters",
      description: "Search for cards legal for specific heroes",
      examples: [
        { code: "hero:marlynn", desc: "Cards legal for Marlynn" },
        { code: "hero:levia", desc: "Cards legal for Levia" },
        { code: "hero:starvo", desc: "Cards legal for Starvo" },
        { code: "hero:gravy", desc: "Cards legal for Gravy" },
        { code: "hero:dor", desc: "Prefixes work when only one hero matches (Dorinthea)" }
      ]
    },
    {
      title: "Talent Filters",
      description: "Search by talents — abbreviations and unambiguous prefixes both work",
      codes: "l=light, li=lightning, i=ice, e=earth, d/dra=draconic, s=shadow, m=mystic, c=chaos, r=royal, el=elemental, reve=revered, revi=reviled",
      examples: [
        { code: "tal:light", desc: "Light talent cards" },
        { code: "tal:dra", desc: "Draconic (prefix)" },
        { code: "talent:i,e", desc: "Ice and Earth talent cards" },
        { code: "tal:!light", desc: "Exclude light talent cards" },
        { code: "tal:light,lightning", desc: "Light or Lightning talent cards" },
        { code: "talent:elemental", desc: "Elemental talent cards" }
      ]
    },
    {
      title: "Rarity Filters",
      description: "Search by card rarity with multiple syntax options",
      codes: "c=common, r=rare, m=majestic, l=legendary, f=fabled, s=super, v=marvel, t=token, p=promo",
      examples: [
        { code: "rarity:m", desc: "Majestic cards" },
        { code: "r:!c", desc: "Not common cards" },
        { code: "r:!l", desc: "Exclude legendary cards" },
        { code: "rarity:m,l,!f", desc: "Majestic or legendary, but not fabled" },
        { code: "r:v,f", desc: "Marvel or fabled cards" }
      ]
    },
    {
      title: "Foiling Filters",
      description: "Search by foiling type",
      codes: "rf/r=rainbow, cf/c=cold, nf/s=normal/standard, g=gold",
      examples: [
        { code: "foil:rf", desc: "Rainbow foil cards" },
        { code: "f:!cf", desc: "Not cold foil cards" },
        { code: "foil:r,c,!s", desc: "Rainbow or cold foil, but not standard" },
        { code: "f:cf", desc: "Cold foil cards (shorthand)" }
      ]
    },
    {
      title: "Set Filters",
      description: "Search by card set",
      examples: [
        { code: "set:wtr", desc: "Welcome to Rathe cards" },
        { code: "set:!arc", desc: "Exclude Arcane Rising cards" },
        { code: "set:wtr,arc,!out", desc: "WTR or ARC, but not Outsiders" },
        { code: "set:hnt,mst", desc: "The Hunted or Part the Mistveil" }
      ]
    },
    {
      title: "Edition Filters",
      description: "Search by card edition",
      codes: "f=first, u=unlimited, n=normal, a=alpha",
      examples: [
        { code: "edition:f", desc: "First edition cards" },
        { code: "edition:!u", desc: "Not unlimited edition" },
        { code: "edition:a,f,!n", desc: "Alpha or first, but not normal" }
      ]
    },
    {
      title: "Class Filters",
      description: "Search by hero class — aliases and unambiguous prefixes both work",
      codes: "any 2 letters: gu=guardian, ne=necromancer, ni=ninja, ra=ranger, ru=runeblade, wa=warrior, wi=wizard, me/mech=mechanologist (mer=merchant), rb=runeblade, gen=generic",
      examples: [
        { code: "class:guardian", desc: "Guardian class cards" },
        { code: "c:mech", desc: "Mechanologist cards (alias)" },
        { code: "c:wiz,ran", desc: "Wizard or Ranger cards (prefixes)" },
        { code: "class:!brute", desc: "Not brute class cards" },
        { code: "c:guardian,!generic", desc: "Guardian cards but not generic" },
        { code: "hero:bravo -generic", desc: "Bare -class / !class excludes a class without the c: prefix" }
      ]
    },
    {
      title: "Keyword Filters",
      description: "Search by card keywords (single words or quoted phrases)",
      examples: [
        { code: "keyword:dominate", desc: "Cards with dominate" },
        { code: "keyword:stealth,combo", desc: "Cards with stealth or combo" },
        { code: 'keyword:"go again"', desc: 'Cards with "go again" keyword' },
        { code: 'keyword:!"stealth"', desc: "Cards without stealth" },
        { code: "keyword:!crush,intimidate", desc: "Exclude crush and intimidate" }
      ]
    },
    {
      title: "Text Filters",
      description: "Search card text content (always use quotes)",
      examples: [
        { code: 'text:"create a ponder"', desc: "Cards containing exact phrase" },
        { code: 'text:"runechant"', desc: "Cards mentioning runechant" },
        { code: 'text:!"arrow"', desc: "Cards not mentioning arrow" }
      ]
    },
    {
      title: "Format Filters",
      description: "Search by format legality",
      examples: [
        { code: "format:blitz", desc: "Blitz legal cards" },
        { code: "format:cc", desc: "Classic Constructed legal cards" },
        { code: "format:commoner", desc: "Commoner legal cards" },
        { code: "format:ll", desc: "Living Legend legal cards" }
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <Filter className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">FAB Search Filter Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Important Notes Section */}
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">🔥 Key Features & Best Practices</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <p className="font-medium mb-1">✅ Multi-Value Support:</p>
                <p className="mb-2">Use commas for multiple values: <code className="bg-blue-100 px-1 rounded">cost:0,1,2</code></p>
                
                <p className="font-medium mb-1">✅ Flexible Operators:</p>
                <p className="mb-2">Use &gt;, &lt;, ! for comparisons: <code className="bg-blue-100 px-1 rounded">power&gt;4</code></p>
              </div>
              <div>
                <p className="font-medium mb-1">✅ Smart Negation:</p>
                <p className="mb-2">Use ! or - to exclude: <code className="bg-blue-100 px-1 rounded">r:!c</code> or <code className="bg-blue-100 px-1 rounded">t:!generic</code></p>
                
                <p className="font-medium mb-1">✅ Order Doesn&apos;t Matter:</p>
                <p>Filters work in any order, but put card names at the end</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filterSections.map((section, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{section.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{section.description}</p>
                
                {section.codes && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-xs font-medium text-blue-800 mb-1">Codes:</p>
                    <p className="text-xs text-blue-700">{section.codes}</p>
                  </div>
                )}
                
                <div className="space-y-3">
                  {section.examples.map((example, i) => (
                    <CodeExample 
                      key={i}
                      code={example.code}
                      description={example.desc}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Complex Query Examples Section */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Complex Query Examples
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Combine multiple filters for precise searches. All examples use the latest syntax improvements:
            </p>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Basic Combinations */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Basic Combinations</h4>
                <div className="space-y-3">
                  <CodeExample 
                    code="hero:marlynn cost:0,1,2 r:m,l"
                    description="Marlynn-legal 0-2 cost majestic or legendary cards"
                  />
                  <CodeExample 
                    code="t:equipment defense>2 tal:earth,ice"
                    description="Equipment with 3+ defense and earth or ice talents"
                  />
                  <CodeExample 
                    code="power>4 cost<3 format:blitz t:!generic"
                    description="High-power, low-cost Blitz cards (no generic)"
                  />
                </div>
              </div>

              {/* Hero-Specific Deckbuilding */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Hero-Specific Deckbuilding</h4>
                <div className="space-y-3">
                  <CodeExample 
                    code="hero:levia cost:0,1 keyword:stealth format:blitz p:<20"
                    description="Budget Levia stealth cards for Blitz"
                  />
                  <CodeExample 
                    code="hero:uzuri cost:0,1 defense:2,3 keyword:stealth back stab"
                    description="Uzuri stealth cards with 2-3 defense, including &quot;Back Stab&quot;"
                  />
                  <CodeExample 
                    code="hero:starvo tal:elemental power>5 cost<4 t:!generic"
                    description="Starvo elemental cards with high power and low cost"
                  />
                </div>
              </div>

              {/* Advanced Negation & Exclusions */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Advanced Negation & Exclusions</h4>
                <div className="space-y-3">
                  <CodeExample 
                    code="t:attack,action r:m,l f:rf,cf set:!dtd,!out r:!c"
                    description="Premium foil attacks/actions, excluding recent sets and commons"
                  />
                  <CodeExample 
                    code="c:guardian,wizard cost:1,2,3 power!0 keyword:!stealth"
                    description="Guardian/Wizard 1-3 cost cards with power (not 0), no stealth"
                  />
                  <CodeExample 
                    code="tal:light,lightning tal:!shadow,earth p:<50 edition:f,u"
                    description="Light/Lightning (no shadow/earth) under $50 in first/unlimited"
                  />
                </div>
              </div>

              {/* Collection & Investment */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Collection & Investment Queries</h4>
                <div className="space-y-3">
                  <CodeExample 
                    code="r:l,f f:rf edition:f,a p:>100 p:<500 set:wtr,arc"
                    description="Premium legendary/fabled rainbow foils from early sets ($100-500)"
                  />
                  <CodeExample 
                    code="r:m f:cf p:<30 set:!dtd,!out t:!token"
                    description="Affordable majestic cold foils excluding recent sets and tokens"
                  />
                  <CodeExample 
                    code="hero:marlynn,starvo r:l,f edition:f p:>50 p:<200"
                    description="First edition legendary/fabled for specific heroes ($50-200)"
                  />
                </div>
              </div>

              {/* Format-Specific */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Format-Specific Searches</h4>
                <div className="space-y-3">
                  <CodeExample 
                    code="format:commoner r:c cost:0,1 keyword:dominate,stealth p:<5"
                    description="Budget Commoner 0-1 cost commons with key keywords"
                  />
                  <CodeExample 
                    code='format:blitz t:attack power>3 cost<3 keyword:"go again" r:!l'
                    description="Efficient Blitz attacks with &quot;go again&quot; (non-legendary)"
                  />
                  <CodeExample 
                    code="format:cc power>6 cost:2,3,4 t:!defense defense<3"
                    description="High-power CC threats that aren't defense reactions"
                  />
                </div>
              </div>

              {/* Advanced Combinations */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Expert-Level Combinations</h4>
                <div className="space-y-3">
                  <CodeExample 
                    code="hero:gravy t:action,instant cost:0,1,2 keyword:!stealth r:!c set:out,hnt"
                    description="Gravy actions/instants from recent sets, low cost, no stealth, no commons"
                  />
                  <CodeExample 
                    code="tal:earth,ice defense>1 defense<4 t:equipment c:guardian f:!s"
                    description="Guardian earth/ice equipment with 2-3 defense in foil"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">💡 Pro Tips</h3>
            <div className="text-sm text-yellow-800 space-y-2">
              <p><strong>Card Names:</strong> Put card names at the end or use quotes: <code className="bg-yellow-100 px-1 rounded">hero:uzuri cost:0,1 back stab</code></p>
              <p><strong>Multi-word Keywords:</strong> Use quotes for phrases: <code className="bg-yellow-100 px-1 rounded">keyword:&quot;go again&quot;</code></p>
              <p><strong>Price Ranges:</strong> Combine operators: <code className="bg-yellow-100 px-1 rounded">p:&gt;50 p:&lt;200</code></p>
              <p><strong>Complex Exclusions:</strong> Mix positive and negative: <code className="bg-yellow-100 px-1 rounded">r:m,l,!c</code> (majestic or legendary, but not common)</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end p-6 border-t border-gray-300 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyntaxGuideModal;