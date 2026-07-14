//app/privacy-policy/page.tsx
import Link from "next/link"

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Privacy Policy</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
        <p className="mb-4">Last updated: July 13, 2026</p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">1. Introduction</h2>
        <p>
          Welcome to FaB Bazaar, a Flesh and Blood collection management and trade discovery platform.
          We are committed to protecting your privacy and personal data. This Privacy Policy explains how
          we collect, use, disclose, and safeguard your information when you use our website, Discord bot,
          API services, AI assistant, and related services (collectively, the "Platform").
        </p>
        <p>
          FaB Bazaar is a free, open-source community project. We process no payments and hold no
          financial information about you. By using our Platform, you agree to the collection and use of
          information in accordance with this Privacy Policy and our Terms of Service.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">2. Information We Collect</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">2.1 Account Information</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Authentication data: Discord ID, Discord username, and the email address Discord provides through OAuth. We do not use this email address for marketing and do not send newsletters.</li>
          <li>Profile information: username, display name, country and language preferences, and local store selection (used for local trading discovery at the city/store level, never a home address).</li>
          <li>API credentials: MCP tokens (stored hashed) and OAuth client registrations for applications you connect to your account.</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">2.2 Platform Activity Data</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Card collections: binder contents, card conditions, and trade availability.</li>
          <li>Wants lists: desired cards and trading preferences.</li>
          <li>Decks: deck lists, formats, hero selections, and card quantities.</li>
          <li>Game results: data imported from Talishar games you play, consisting of the actions taken during the game and the hero name of each deck. No personal identifiers for your opponent are stored, and opponents who opted out of stats sharing on Talishar have their detailed data excluded. Game results are visible only to you and any co-owners of the deck.</li>
          <li>Articles and card tags: content you author, including whether each card tag is private or public (see the Terms of Service for how public tags are licensed).</li>
          <li>Trade activity: trade requests and trade-interest notifications you send or receive.</li>
          <li>Search activity: card searches, filter preferences, and "Who Has" queries.</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">2.3 AI Assistant (Volzar) Data</h3>
        <p>
          When you use Volzar, your messages and the account data needed to answer them (such as binder,
          wants, deck, and game-result contents) are processed to generate a response. We do not store
          your conversations on our servers; chat history lives in your browser session. We record only
          daily usage counts to enforce fair-use limits. See Section 6 for where AI processing happens.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">2.4 Technical Information</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Usage data: IP addresses, browser types, device information, page views.</li>
          <li>Cookies and tracking: session cookies, preference settings, and analytics data as described in Section 5.</li>
          <li>API usage: authentication events, request logs, and rate-limiting counters.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">3. How We Use Your Information</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">3.1 Platform Services</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Provide and maintain collection management, deck building, and discovery tools</li>
          <li>Authenticate users and manage account security</li>
          <li>Connect traders with matching collections and wants lists</li>
          <li>Power features you invoke, such as search, trade matching, deck statistics, and the Volzar AI assistant</li>
          <li>Display local store connections for community discovery</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">3.2 Communication and Notifications</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Announce activity on public binders to our Discord community</li>
          <li>Deliver trade requests and trade-interest notifications</li>
          <li>Provide Discord bot functionality and commands</li>
        </ul>
        <p>
          We do not send marketing email. Service announcements are posted on the Platform and in our
          Discord community.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">3.3 Platform Improvement and Safety</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Analyze usage patterns to improve features</li>
          <li>Monitor for fraud, abuse, and misrepresentation</li>
          <li>Enforce our Terms of Service</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">4. What We Don't Do</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>We do NOT process payments or hold any financial information</li>
          <li>We do NOT sell, trade, or rent your personal information</li>
          <li>We do NOT send marketing email</li>
          <li>We do NOT use your content to train proprietary or closed-source machine-learning models</li>
          <li>We do NOT send your data to any AI provider unless you use Volzar or authorize a connected application</li>
          <li>We do NOT verify user identities or act as a party to trades or sales between users</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">5. Cookies and Tracking Technologies</h2>
        <p>
          We use cookies and similar technologies to operate the Platform. Our cookie consent banner
          lets you control which optional cookies are used, and you can change your choices at any time
          via the cookie settings in the site footer.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">5.1 Cookie Categories</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Necessary cookies: essential for platform functionality, authentication, and security (always active).</li>
          <li>Functional cookies: remember your preferences (dark mode, language, local store settings).</li>
          <li>Analytics cookies: Google Analytics 4 data to understand usage patterns and improve our services. Google Analytics scripts are not loaded until you grant analytics consent; no tracking occurs before your choice. When enabled, we track: page views, card searches (including the search term you enter), card detail views, deck views, deck creation, deck imports, Presenter mode opens, and login events. We also set a user-type property (anonymous or authenticated) on each session. Deck names you create are included as a parameter on deck-related events. We do not send your email, user ID, or Discord identifier to Google Analytics. IP addresses are anonymized, and Google Signals and ad personalization are disabled for analytics.</li>
          <li>Advertising cookies: enable affiliate referral tracking, and ad display where advertisements are active on the Platform.</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">5.2 Affiliate Links</h3>
        <p>
          Outbound links to TCGplayer may include affiliate tracking that supports the Platform, at no
          cost to you. Affiliate tracking is applied only when you have enabled advertising cookies;
          otherwise, links point directly to the marketplace with no tracking parameters added.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">6. Third-Party Services and Data Sharing</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">6.1 Services We Use</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Discord: authentication (OAuth), bot functionality, and community notifications.</li>
          <li>OpenRouter and AI model providers: when you use Volzar, your messages and the account data needed to answer them are transmitted to OpenRouter and routed to an AI model provider for processing, subject to their terms and privacy policies. This happens only when you use Volzar.</li>
          <li>Talishar (talishar.net): deck sync and game-result import, as described in Section 2.2 and Talishar's own terms.</li>
          <li>Google Analytics: consent-based usage analytics (see Section 5.1).</li>
          <li>Metafy: if you link a Metafy account, we check your supporter status with Metafy. Donations are processed entirely by Metafy; we never see payment details.</li>
          <li>Infrastructure providers: self-hosted database on infrastructure we operate, with hosting, DNS, and content delivery services (including Cloudflare).</li>
          <li>TCG pricing sources: we receive card pricing data from third-party sources; we do not send them your personal data.</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">6.2 Connected Applications</h3>
        <p>
          If you authorize a third-party application (such as an AI client) through our OAuth service,
          that application can access your account data as described in the Terms of Service. You control
          this access and can revoke it at any time from your account settings. Connected applications
          operate under their own privacy policies.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.3 Data Sharing Practices</h3>
        <p>We do not sell, trade, or rent your personal information. We share information only:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>As you direct: public binders, public tags, published articles, and trade matching visible per your settings</li>
          <li>With applications you explicitly authorize (Section 6.2)</li>
          <li>With the service providers above, to the extent needed to operate the Platform</li>
          <li>When required by law or to protect our rights and the safety of our users</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">7. Data Security and Protection</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">7.1 Safeguards</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Encryption of data in transit (TLS/SSL)</li>
          <li>Hashed storage of authentication tokens</li>
          <li>Secure authentication mechanisms and session management</li>
          <li>API rate limiting and abuse prevention</li>
          <li>Access to personal data limited to the Platform's operator</li>
          <li>Regular encrypted backups</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">7.2 Data Breach Notification</h3>
        <p>
          In the event of a data breach that affects your personal information, we will notify you
          without undue delay and in accordance with applicable law, by posting a notice prominently
          on the Platform.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">8. Your Privacy Rights</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">8.1 Self-Serve Tools</h3>
        <p>
          The most common privacy actions are available directly in your account: you can export your
          collection data at any time, edit your profile information, control the visibility of binders
          and tags, revoke connected applications, and delete your account from your profile page.
          Account deletion takes effect immediately and permanently removes your account and its
          associated personal data.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">8.2 GDPR Rights (EU Users)</h3>
        <p>Under the General Data Protection Regulation, you have the right to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Access: request copies of your personal data</li>
          <li>Rectification: correct inaccurate or incomplete data</li>
          <li>Erasure: request deletion of your data ("right to be forgotten")</li>
          <li>Portability: receive your data in a structured, machine-readable format</li>
          <li>Object: object to processing based on legitimate interests</li>
          <li>Restrict: limit how we process your data</li>
          <li>Withdraw consent: remove consent for specific processing activities</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">8.3 CCPA Rights (California Users)</h3>
        <p>Under the California Consumer Privacy Act, you have the right to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Know what personal information is collected and how it's used</li>
          <li>Delete personal information held by us</li>
          <li>Opt out of the sale of personal information (we do not sell your data)</li>
          <li>Non-discrimination for exercising your privacy rights</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">8.4 How to Exercise Your Rights</h3>
        <p>
          For anything not covered by the self-serve tools, contact us using the information in
          Section 12. We will respond to your request within 30 days.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">9. Data Retention</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>Account and activity data: retained while your account is active, and deleted immediately when you delete your account. Copies may persist for a limited period in routine encrypted backups before those backups expire.</li>
          <li>Public contributions: card tags published under the open data license described in the Terms of Service remain available under that license.</li>
          <li>Analytics data: retained for up to 14 months in Google Analytics 4, per our configured retention setting; older events are automatically deleted by Google.</li>
          <li>Server and security logs: retained for a limited period for abuse prevention and troubleshooting.</li>
          <li>Moderation records: records of serious Terms of Service violations may be retained as needed for platform safety.</li>
          <li>Legal compliance: some data may be retained longer if required by law.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">10. International Data Transfers</h2>
        <p>
          FaB Bazaar operates from the United States. If you access our Platform from outside the
          United States, your information is transferred to, stored, and processed in the United
          States. Where our service providers process data internationally, that processing is covered
          by their standard data protection terms, including Standard Contractual Clauses where
          applicable.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">11. Children's Privacy</h2>
        <p>
          Account creation on our Platform requires a Discord account. Discord requires users to be at
          least 13 years of age (or the minimum age required in their country, whichever is greater).
          By requiring Discord authentication, we comply with age restrictions set by Discord's Terms of Service.
        </p>
        <p>
          We do not knowingly collect personal information from children below Discord's minimum age requirements.
          If we discover that we have collected personal information from a user below the required age,
          we will delete such information immediately.
        </p>
        <p>
          Users between 13 and 18 (or their country's age of majority) should have parental or guardian
          consent to use the Platform. Parents are encouraged to monitor their children's use of the
          Platform and trading activities.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">12. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices or
          applicable laws. If a change is material, we will post a notice on the Platform at least 30
          days before it takes effect, except for changes required by law, which may take effect
          immediately. Your continued use of the Platform after changes take effect constitutes
          acceptance of the updated Privacy Policy.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">13. Contact Information</h2>
        <p>If you have any questions about this Privacy Policy or wish to exercise your privacy rights, please contact us:</p>
        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6 space-y-3">
          <div className="flex items-center">
            <span className="text-gray-600 dark:text-gray-300 font-medium min-w-20">Email:</span>
            <a href="mailto:fabbazaar@fabbazaar.app" className="text-blue-600 dark:text-blue-400 hover:underline">
              fabbazaar@fabbazaar.app
            </a>
          </div>
          <div className="flex items-center">
            <span className="text-gray-600 dark:text-gray-300 font-medium min-w-20">Discord:</span>
            <a href="https://discord.gg/Rx8eBhhQtk" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
              FaB Bazaar Community
            </a>
          </div>
          <div className="flex items-center">
            <span className="text-gray-600 dark:text-gray-300 font-medium min-w-20">Location:</span>
            <span className="text-gray-800 dark:text-gray-200">Georgia, USA</span>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mt-6 mb-4">14. Legal Basis for Processing (GDPR)</h2>
        <p>Our legal basis for processing your personal data includes:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Consent: for optional cookies (analytics, advertising) and optional features</li>
          <li>Contract: to provide collection management and trade discovery services</li>
          <li>Legitimate interest: for platform improvement, security, and community safety</li>
          <li>Legal obligation: for compliance with applicable laws</li>
        </ul>

        <div className="mt-8 mb-4 flex gap-4">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Return to Home
          </Link>
          <Link href="/terms-of-service" className="text-blue-600 dark:text-blue-400 hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  )
}
