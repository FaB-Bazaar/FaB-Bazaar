# FaB Bazaar Web Components

Framework-agnostic article components built with [Lit](https://lit.dev) for use in MDX, React, Svelte, Vue, or plain HTML.

## 🎯 Purpose

This package provides a **React → Web Component conversion framework** for FaB Bazaar's article system. It demonstrates reusable patterns for converting existing React components to standards-based Web Components that work everywhere.

## 🏗️ Architecture

### Component Complexity Ladder

We've converted three reference components of increasing complexity to establish conversion patterns:

1. **`fab-callout`** (Simple) - Props only, no state
2. **`fab-creator-spotlight`** (Moderate) - Composition with slots
3. **`fab-spotlight-card`** (Complex) - Client-side data fetching, state management

These serve as templates for all future component conversions.

## 📦 Installation

### For Development (in this monorepo)

```bash
cd web-components
npm install
npm run build
```

### For Distribution (CDN)

```html
<script type="module" src="https://cdn.fabbazaar.app/ui@1.0.0.js"></script>
```

### For NPM (future)

```bash
npm install @fabbazaar/ui
```

```javascript
import '@fabbazaar/ui';
```

## 🔧 Usage

### In MDX (FaB Bazaar)

```mdx
## Getting Started

<fab-callout
  title="New to Dromai?"
  text="This guide assumes basic hero knowledge"
  link-href="/guides/dromai-intro"
  link-text="View Beginner's Guide">
</fab-callout>

<fab-creator-spotlight
  image-url="https://example.com/avatar.jpg"
  name="Creator Name"
  bio="Bio text here"
  links='[{"href":"https://patreon.com/creator","label":"Patreon","icon":"patreon"}]'>
</fab-creator-spotlight>

<fab-spotlight-card
  printing-id="WTR001"
  title="Round 1 MVP"
  commentary="This card was crucial. **Fyendal's Spring Tunic** enabled the combo.">
</fab-spotlight-card>
```

### In React

```tsx
export default function Article() {
  return (
    <>
      <fab-callout
        title="Tip"
        text="Always sideboard wisely"
        link-href="/guide"
        link-text="Learn More"
      />
    </>
  );
}
```

### In Svelte

```svelte
<fab-callout
  title="Tip"
  text="Always sideboard wisely"
  link-href="/guide"
  link-text="Learn More"
/>
```

### In Plain HTML

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://cdn.fabbazaar.app/ui@1.0.0.js"></script>
</head>
<body>
  <fab-callout
    title="Tip"
    text="Always sideboard wisely"
    link-href="/guide"
    link-text="Learn More">
  </fab-callout>
</body>
</html>
```

## 📚 Component Reference

### `<fab-callout>`

Info box for tips, warnings, and contextual information.

**Attributes:**
- `title` - The callout title
- `text` - The callout body text
- `link-href` - Optional link URL
- `link-text` - Optional link label

**CSS Variables:**
```css
fab-callout {
  --fab-callout-bg: #f0f9ff;
  --fab-callout-border: #3b82f6;
  --fab-callout-text: #1e293b;
  --fab-callout-icon-color: #3b82f6;
}
```

---

### `<fab-creator-spotlight>`

Content creator profile feature component.

**Attributes (Simple Mode):**
- `image-url` - Creator's profile image URL
- `name` - Creator's name
- `bio` - Creator's bio text
- `links` - JSON string of links: `[{"href":"...","label":"...","icon":"..."}]`

**Slots (Advanced Mode):**
- `header` - Custom header content
- `links` - Custom links content

**Example with slots:**
```html
<fab-creator-spotlight image-url="...">
  <div slot="header">
    <h3>Creator Name</h3>
    <p>Custom <strong>formatted</strong> bio</p>
  </div>
  <div slot="links">
    <a href="...">Patreon</a>
  </div>
</fab-creator-spotlight>
```

**CSS Variables:**
```css
fab-creator-spotlight {
  --fab-spotlight-bg-start: #dbeafe;
  --fab-spotlight-bg-end: #e0e7ff;
  --fab-spotlight-text: #0f172a;
}
```

---

### `<fab-spotlight-card>`

Featured card analysis component with rich commentary.

**Attributes:**
- `printing-id` - Card printing ID to fetch and display
- `title` - Optional custom title (defaults to card name)
- `commentary` - Rich text (supports `**Card Name**` mentions)
- `api-base` - Optional API base URL (defaults to current origin)

**Commentary Syntax:**
Wrap card names in `**double asterisks**` to render them as highlighted mentions:

```html
<fab-spotlight-card
  printing-id="WTR001"
  commentary="This card synergizes with **Fyendal's Spring Tunic** and **Art of War**.">
</fab-spotlight-card>
```

**CSS Variables:**
```css
fab-spotlight-card {
  --fab-spotlight-bg: #fffbeb;
  --fab-spotlight-border: #f59e0b;
  --fab-spotlight-badge-bg: #d97706;
}
```

**API Requirements:**
Expects a `/api/printings/search?printingIds=XXX` endpoint that returns:
```json
{
  "success": true,
  "data": {
    "printings": [{
      "printing_id": "...",
      "name": "...",
      "image_url": "...",
      "set": "...",
      "edition": "...",
      "rarity": "...",
      "foiling": "..."
    }]
  }
}
```

## 🎨 Theming

All components use CSS custom properties (variables) for theming. Override them globally or per-component:

```css
/* Global theme */
:root {
  --fab-callout-bg: #f0f9ff;
  --fab-callout-border: #3b82f6;
}

/* Per-component override */
fab-callout {
  --fab-callout-bg: #fef3c7;
  --fab-callout-border: #f59e0b;
}
```

### Dark Mode

Components respect CSS variables, so you can implement dark mode by changing variable values:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --fab-callout-bg: #1e293b;
    --fab-callout-text: #f1f5f9;
    --fab-callout-border: #475569;
  }
}
```

## 🔄 React → Web Component Conversion Patterns

This framework demonstrates five core conversion patterns:

### Pattern 1: Props → Attributes

**React:**
```tsx
interface CalloutProps {
  title: string;
  linkHref: string;
}
```

**Web Component:**
```typescript
@property() title = '';
@property({ attribute: 'link-href' }) linkHref = '';
```

**Usage:**
```html
<fab-callout title="..." link-href="..."></fab-callout>
```

**Rules:**
- String/number/boolean → Direct attribute mapping
- camelCase props → kebab-case attributes
- Complex objects → JSON string attributes or child elements

---

### Pattern 2: Children → Slots

**React:**
```tsx
<Component>
  <Header>Title</Header>
  <Content>Body</Content>
</Component>
```

**Web Component:**
```typescript
render() {
  return html`
    <slot name="header"></slot>
    <slot name="content"></slot>
  `;
}
```

**Usage:**
```html
<fab-component>
  <div slot="header">Title</div>
  <div slot="content">Body</div>
</fab-component>
```

**Rules:**
- Named slots for specific content areas
- Default slot for unspecified children
- Support both slot mode AND attribute mode for flexibility

---

### Pattern 3: Client-Side Data Fetching

**React:**
```tsx
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

**Web Component:**
```typescript
@state() private data: any = null;
@state() private loading = true;

async connectedCallback() {
  super.connectedCallback();
  await this.fetchData();
}

private async fetchData() {
  this.loading = true;
  const res = await fetch('/api/data');
  this.data = await res.json();
  this.loading = false;
}
```

**Rules:**
- Use `@state()` for internal reactive state
- Fetch in `connectedCallback()` lifecycle hook
- Handle loading and error states
- Use absolute or relative URLs (no env variables in browser)
- Refetch when key attributes change via `updated()` lifecycle

---

### Pattern 4: Styling Strategy

**Option A: Shadow DOM + CSS Variables (Recommended)**

```typescript
static styles = css`
  :host {
    --component-bg: #ffffff;
    display: block;
  }
  .wrapper {
    background: var(--component-bg);
  }
`;
```

**Pros:**
- ✅ Style encapsulation
- ✅ No collisions with host page
- ✅ Portable across frameworks
- ✅ Themeable via CSS variables

**Cons:**
- ❌ Cannot use host page's Tailwind classes

**Option B: Light DOM + Tailwind**

```typescript
createRenderRoot() {
  return this; // Disable Shadow DOM
}
render() {
  return html`<div class="rounded-lg border p-4">...</div>`;
}
```

**Pros:**
- ✅ Can use Tailwind classes
- ✅ Simpler mental model

**Cons:**
- ❌ Style collisions possible
- ❌ Less portable

**Recommendation:** Use Shadow DOM + CSS variables for distributable components.

---

### Pattern 5: Events

**React:**
```tsx
<Component onChange={(value) => handle(value)} />
```

**Web Component:**
```typescript
private handleChange(value: string) {
  this.dispatchEvent(new CustomEvent('change', {
    detail: { value },
    bubbles: true,
    composed: true  // Crosses shadow boundary
  }));
}
```

**Usage:**
```javascript
element.addEventListener('change', (e) => {
  console.log(e.detail.value);
});
```

## 🏗️ Development

### Project Structure

```
web-components/
├── src/
│   ├── index.ts                    # Entry point
│   ├── fab-callout.ts              # Simple reference
│   ├── fab-creator-spotlight.ts    # Moderate reference
│   └── fab-spotlight-card.ts       # Complex reference
├── dist/                           # Build output
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md                       # This file
```

### Build Commands

```bash
# Development mode (watch + hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Adding New Components

1. **Create component file** in `src/fab-your-component.ts`
2. **Follow existing patterns** (see conversion patterns above)
3. **Export in** `src/index.ts`
4. **Document usage** in this README
5. **Build and test**: `npm run build`

**Template:**

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('fab-your-component')
export class FabYourComponent extends LitElement {
  static styles = css`
    :host {
      --fab-your-bg: #ffffff;
      display: block;
    }
  `;

  @property() someProp = '';

  render() {
    return html`<div>Your content</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-your-component': FabYourComponent;
  }
}
```

## 🚀 Deployment

### CDN Deployment (Cloudflare/Vercel)

1. Build the project: `npm run build`
2. Upload `dist/fabbazaar-ui.js` to CDN
3. Serve with correct MIME type: `application/javascript`
4. Enable versioning: `ui@1.0.0.js`, `ui@1.1.0.js`, etc.
5. Set CORS headers for cross-origin usage

### Load in Host Application

```html
<!-- Load from CDN -->
<script type="module" src="https://cdn.fabbazaar.app/ui@1.0.0.js"></script>
```

Or in Next.js `app/layout.tsx`:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src="/wc/fabbazaar-ui.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## 📖 Reference Documentation

### Lit Documentation
- [Lit Docs](https://lit.dev)
- [Components](https://lit.dev/docs/components/defining/)
- [Reactive Properties](https://lit.dev/docs/components/properties/)
- [Styles](https://lit.dev/docs/components/styles/)

### Web Components Standards
- [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)
- [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [HTML Templates](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_templates_and_slots)

## 🎓 Learning Path

**If you're converting a React component:**

1. **Simple props only?** → Follow `fab-callout` pattern
2. **Composition with children?** → Follow `fab-creator-spotlight` pattern
3. **Needs data fetching?** → Follow `fab-spotlight-card` pattern
4. **Mix of all?** → Combine patterns as needed

## 🔮 Future Components

Once the framework is validated, these components will be added:

- `fab-intro` - Article lead/summary
- `fab-match-report` - Tournament round writeups
- `fab-section-header` - Semantic section headers
- `fab-byline` - Author attribution
- `fab-key-takeaways` - Bullet highlights
- `fab-decklist-block` - Structured decklists

## 📝 License

MIT © FaB Bazaar
