//app/terms-of-service/page.tsx
import Link from "next/link"

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Terms of Service</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
        <p className="mb-4">Last updated: July 13, 2026</p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">1. Introduction</h2>
        <p>
          Welcome to FaB Bazaar, a Flesh and Blood trading card organization and discovery platform.
          These Terms of Service ("Terms") govern your use of our website, Discord bot, API services,
          AI assistant, and related services (collectively, the "Platform"). By accessing or using our
          Platform, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to
          these Terms, please do not use our Platform.
        </p>
        <p>
          FaB Bazaar is a free, open-source community project (see Section 10.5). There are no fees to
          use the Platform. Optional donations made through Metafy support the Platform's operating
          costs but confer no additional rights, features, or paywalled content.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">2. Platform Purpose and Scope</h2>
        <p>
          FaB Bazaar is a collection management and trade discovery tool. We provide a
          platform for users to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Create digital representations of their card collections (binders)</li>
          <li>Create wants lists of cards they are seeking</li>
          <li>Build and manage decks, and play them on Talishar (a third-party platform)</li>
          <li>Discover potential trading partners and send trade requests</li>
          <li>Search cards and view pricing information</li>
          <li>Use Volzar, our AI assistant, as a natural-language interface to these features</li>
        </ul>
        <p>
          We are NOT:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>A marketplace: we do not process payments, provide checkout or escrow, or take any fee or commission from transactions between Users</li>
          <li>A payment processor or escrow service</li>
          <li>A party to any trades between users</li>
          <li>An arbiter, mediator, or dispute resolver</li>
          <li>A verification or authentication service</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">3. Definitions</h2>
        <p>
          "Platform" refers to the FaB Bazaar website, Discord bot, API, AI assistant, and all related services.
          <br />
          "User" refers to any individual who accesses or uses the Platform.
          <br />
          "Content" refers to any information, text, graphics, card data, or other materials on the Platform.
          <br />
          "Cards" refers to Flesh and Blood trading cards from Legend Story Studios.
          <br />
          "Trade" refers to the peer-to-peer exchange of physical cards between Users.
          <br />
          "Binder" refers to a User's digital representation of cards available for trading.
          <br />
          "Wants List" refers to cards a User is seeking to acquire through trades.
          <br />
          "Deck" refers to a User's digital decklist, which may be exported to or synced with Talishar.
          <br />
          "Volzar" refers to the Platform's AI assistant, which is named after a Flesh and Blood card; the card name and all associated card content are the intellectual property of Legend Story Studios (see Section 10.2).
          <br />
          "Connected Application" refers to a third-party application (such as an AI client) that you authorize to access your account via OAuth.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">4. Account Registration and Authentication</h2>
        <p>
          To use most features of the Platform, you must register for an account using Discord OAuth authentication.
          By registering, you represent that:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>You are at least 13 years old</li>
          <li>You have a valid Discord account</li>
          <li>All information you provide is accurate and complete</li>
          <li>You will maintain the security of your account credentials</li>
        </ul>
        <p>
          You are responsible for all activities that occur under your account. You must immediately notify us
          of any unauthorized use of your account.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">4.1 API Access and MCP Tokens</h3>
        <p>
          Advanced users may access our API programmatically, including through MCP (Model Context Protocol)
          tokens. These tokens provide programmatic access to your account data and must be kept secure. You
          are responsible for any activities performed using your tokens.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">4.2 Connected Applications (OAuth)</h3>
        <p>
          You may authorize third-party applications, including AI clients such as Claude, to access your
          account through our OAuth authorization service. Connecting an application is entirely optional
          and requires your explicit approval; no third-party application can access your account unless
          you authorize it. An authorized Connected Application can read and, where you permit it, modify
          your account data (binders, wants lists, decks) on your behalf. Actions taken by a Connected
          Application are attributed to your account, and you are responsible for them. You may review and
          revoke a Connected Application's access at any time from your account settings. We are not
          responsible for the conduct, security, or data practices of third-party applications you choose
          to connect.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">5. Age Requirements and Parental Consent</h2>
        <p>
          While users aged 13 and older may create accounts, users under 18 must have
          parental or guardian consent to use the Platform and engage in trades. By using
          the Platform as a minor, you represent that you have obtained such consent.
        </p>
        <p>
          Parents or guardians of users under 18 are responsible for supervising their child's use
          of the Platform and any trading activities. We recommend that parents review trades and
          shipping arrangements for minors.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">6. Platform Features and Usage</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">6.1 Card Binder Management</h3>
        <p>
          You may create and manage virtual binders containing your Flesh and Blood card collection.
          You represent that you own or have legal right to trade all cards listed in your binders.
          Binders may be public or private. Activity on public binders, such as adding cards, may be
          automatically announced to our Discord community; keep a binder private if you do not want its
          activity shared. You may export your collection data at any time.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.2 Wants Lists</h3>
        <p>
          You may create wants lists to indicate cards you wish to acquire. These lists help facilitate
          trading connections with other Users.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.3 "Who Has" Feature</h3>
        <p>
          Our search functionality allows you to find Users who own specific cards. This feature respects
          User privacy settings and trading preferences.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.4 Decks and Talishar Integration</h3>
        <p>
          You may build and manage decks on the Platform and export or sync them to Talishar
          (talishar.net), a third-party game client operated independently of FaB Bazaar. Your use of
          Talishar is subject to Talishar's own terms. The Platform may import game results from
          Talishar games you play. Imported data describes the game itself: the actions taken during
          the game and the hero name of each deck. No personal identifiers for your opponent are
          stored. Where an opponent has opted out of stats sharing on Talishar, their detailed card
          and turn data is not imported. Game results are private: they are accessible only to you
          (and any co-owners of the deck), and other users cannot view your decks' results. Imported
          results power features such as deck performance statistics and, only when you request it,
          AI game review.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.5 Volzar AI Assistant</h3>
        <p>
          Volzar is an AI assistant available to signed-in users. It acts as a natural-language
          interface to the Platform's own features: you can ask it to search for cards, browse and
          update your binders, wants lists, and decks, look up trading partners, analyze your deck
          performance, and review your imported Talishar games. Use of AI features is entirely
          optional. Your account data is processed by AI only if you use the Volzar interface
          yourself or explicitly authorize a Connected Application (see Section 4.2). If you do
          neither, your data is not sent to any AI provider. By using Volzar, you acknowledge that:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>
            Your messages, and the account data needed to answer them (such as binder, wants, deck, and
            game-result contents), are transmitted to third-party AI model providers via OpenRouter for
            processing, subject to those providers' terms and privacy policies
          </li>
          <li>
            AI-generated responses may be inaccurate, incomplete, or misleading, and are provided for
            informational purposes only. Verify card details, prices, and rules interpretations before
            relying on them
          </li>
          <li>
            When you instruct Volzar to modify your data (for example, adding cards to a binder or
            deck), those changes are made to your account and you are responsible for reviewing them
          </li>
          <li>
            Usage limits apply (per-user and platform-wide) and may change at any time to manage
            operating costs
          </li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">6.6 Local Store Directory</h3>
        <p>
          You may set your local game store to connect with nearby traders. Store listings are
          community-submitted directory entries used to facilitate local trading opportunities and
          discovery. Store listings are informational only. The Platform does not sell cards, process
          payments, or facilitate purchases on behalf of any store.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.7 Discord Integration and Notifications</h3>
        <p>
          Our Discord bot provides Platform features within Discord servers. The Platform also posts
          automated notifications to our Discord community, such as public binder activity and
          trade-interest notifications. By using the bot or these features, you agree to Discord's
          Terms of Service and our bot's specific usage guidelines.
        </p>

        <h3 className="text-xl font-semibold mt-4 mb-2">6.8 No User Verification</h3>
        <p>
          We do not conduct background checks, verify identities, or screen users. Discord
          authentication confirms only that a user has a Discord account, not their identity,
          trustworthiness, or trading history. Exercise caution and use your own judgment when
          interacting with other users.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">7. Trading Rules and Conduct</h2>

        <h3 className="text-xl font-semibold mt-4 mb-2">7.1 Trades and Sales Between Users</h3>
        <p>
          FaB Bazaar is designed for card-for-card trades. Users may also indicate that cards are
          available for sale and negotiate sales with other Users. In either case, the Platform is a
          venue for connecting collectors, not a marketplace: every transaction is agreed and completed
          entirely off-platform, between the Users involved. The Platform does NOT:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Process, hold, or transfer money in any form</li>
          <li>Provide checkout, escrow, invoicing, or order management</li>
          <li>Provide buyer or seller protection of any kind</li>
          <li>Take any fee or commission from transactions between Users</li>
          <li>Verify that payment was made or that cards were shipped</li>
        </ul>
        <p>
          If you sell cards to other Users, you do so at your own risk and under your own
          responsibility. Sellers are solely responsible for complying with all laws that apply to
          them, including tax reporting and collection, consumer protection rules, and any local
          regulations on selling collectibles. Users under 18 should review Section 5; parents or
          guardians are responsible for supervising any selling activity by minors.
        </p>
        <p>
          You may not attempt to send or collect payments through the Platform itself, misrepresent
          whether a card is offered for trade or for sale, or use the Platform to defraud other Users.
          Section 7.4 applies to sales exactly as it applies to trades.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">7.2 Trade Requests</h3>
        <p>
          The Platform lets you express interest in a trade, for example by sending a trade request
          or notification to another User. That is the extent of the Platform's role. We do NOT:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Track, confirm, or record trade agreements</li>
          <li>Hold cards in physical or legal escrow</li>
          <li>Verify that cards are shipped or received</li>
          <li>Authenticate cards or verify conditions</li>
          <li>Guarantee trade completion</li>
          <li>Act as an intermediary or arbitrator</li>
        </ul>
        <p>
          Users are solely responsible for negotiating, shipping, and completing trades.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">7.3 Honest Dealing</h3>
        <p>
          The Platform does not set or enforce trading standards. Condition grading scales, shipping
          methods, timelines, packaging, tracking, and all other terms of a transaction are for the
          Users involved to agree between themselves. The only rules the Platform imposes are a
          baseline of honesty. You may not:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Pass off counterfeit, proxy, or unauthorized cards as genuine</li>
          <li>Misrepresent the condition, authenticity, or edition of a card</li>
          <li>Use the Platform to defraud other Users</li>
          <li>Manipulate pricing data or card valuations</li>
        </ul>
        <p>
          Violations of these rules may result in suspension or termination of your account. This is
          the full extent of the Platform's involvement; we do not evaluate, referee, or enforce the
          terms of any trade or sale.
        </p>

        <h3 className="text-xl font-semibold mt-4 mb-2">7.4 Platform Role and Trade Disputes</h3>
        <p>
          IMPORTANT: FaB Bazaar is a communication and organizational tool only. We:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Do NOT verify user identities, card authenticity, or card conditions</li>
          <li>Do NOT guarantee the completion, safety, or legality of any trade</li>
          <li>Are NOT a party to any transaction between users</li>
          <li>Do NOT authenticate cards or provide condition grading services</li>
          <li>Cannot and do not guarantee that users will complete trades</li>
          <li>Are NOT responsible for user conduct, card authenticity, shipping, or payment issues</li>
          <li>Do NOT act as mediators, arbitrators, or dispute resolvers</li>
        </ul>
        <p>
          All trades occur at your own risk. You are solely responsible for evaluating trading
          partners, verifying card authenticity and condition, and ensuring safe transaction practices.
          Users are responsible for resolving trade disputes directly with each other. We do not provide
          mediation or arbitration services.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">8. Data, Pricing, and Affiliate Links</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">8.1 TCG Price Data</h3>
        <p>
          We provide regularly updated pricing information from third-party sources. Pricing data is for
          informational purposes only and may not reflect actual market values. We do not guarantee
          the accuracy or completeness of pricing information.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">8.2 Affiliate Links</h3>
        <p>
          Some outbound links to third-party marketplaces (such as TCGplayer) are affiliate links, and
          we may earn a commission if you make a purchase after following them. Affiliate tracking is
          applied only if you have enabled advertising cookies in our cookie preferences; otherwise,
          these links point directly to the marketplace with no affiliate tracking. All such purchases
          occur entirely off-platform, on the third party's site and under the third party's terms; the
          Platform is not a party to those transactions.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">9. User Conduct and Prohibited Activities</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Use the Platform for any illegal purpose or in violation of local, state, or federal laws</li>
          <li>Violate any applicable laws in your jurisdiction</li>
          <li>Infringe upon the intellectual property rights of others</li>
          <li>Interfere with or disrupt the Platform's operation or servers</li>
          <li>Attempt to gain unauthorized access to any part of the Platform</li>
          <li>Engage in fraudulent, deceptive, or misleading practices</li>
          <li>Harass, abuse, or harm other Users</li>
          <li>Create multiple accounts to circumvent restrictions</li>
          <li>Circumvent or attempt to circumvent rate limits or AI usage quotas</li>
          <li>Use automated tools to scrape or harvest data without permission</li>
          <li>Distribute malware, viruses, or other harmful code</li>
          <li>Impersonate others or misrepresent your identity or affiliation</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">10. Content and Intellectual Property</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">10.1 Platform Content</h3>
        <p>
          The Platform's source code is licensed as open source (see Section 10.5). The FaB Bazaar name
          and branding may not be used in a way that implies affiliation with or endorsement by FaB
          Bazaar without permission. Original content, features, and functionality of the Platform are
          protected by applicable copyright, trademark, and other intellectual property laws, subject to
          the open-source licenses under which they are released.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">10.2 Flesh and Blood Content</h3>
        <p>
          Flesh and Blood, card names, artwork, and related intellectual property are owned by Legend
          Story Studios. We use this content under fair use principles for informational and trading purposes.
          FaB Bazaar is not affiliated with Legend Story Studios.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">10.3 User-Generated Content</h3>
        <p>
          You retain ownership of any content you submit, including binders, wants lists, decks,
          articles, and card tags. You grant us a worldwide, non-exclusive, royalty-free license to
          host, display, and distribute that content solely to operate the Platform. In plain terms,
          this is the permission that lets us store your content and show it to the people you choose
          to share it with, and nothing more. It does not let us sell or sublicense your content, use
          it in advertising, or use community-contributed content to train proprietary or closed-source
          machine-learning models. The license ends when you delete the content or your account, except
          for copies in routine backups and public card tags already released under Section 10.5.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">10.4 Card Tags: Private vs. Public</h3>
        <p>
          When you tag a card, you choose whether that tag is private or public.
          A private tag is visible only to you and affects only your own searches; we do not publish it or
          attribute it to you. A public tag is submitted for curator review, and once approved it may become
          visible to all users and be attributed to your account as a community contribution. You may change a
          tag from public back to private, or retract it entirely, at any time; because tags are served live
          from the Platform, such changes take effect going forward.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">10.5 Open Source and Open Data Commitment</h3>
        <p>
          FaB Bazaar's source code is released under the GNU Affero General Public License v3.0 (AGPL-3.0),
          which requires that any modified version operated as a network service also make its complete source
          code available to that service's users. Community-contributed structured data (the card classification
          tags that have been made public) is additionally released under the Creative Commons
          Attribution-ShareAlike 4.0 license (CC-BY-SA 4.0). This means such data remains freely available to
          the community, with attribution, regardless of any future change in the Platform's ownership or
          operation. Private tags are never included in this data.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">11. Privacy and Data Protection</h2>
        <p>
          Your privacy is important to us. Our collection and use of personal information is governed by
          our Privacy Policy, which is incorporated into these Terms by reference. By using the Platform,
          you consent to the collection and use of information as described in our Privacy Policy.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">12. Data Security and Breach Notification</h2>
        <p>
          While we implement reasonable security measures to protect your data, no system is
          completely secure. In the event of a data breach that affects your personal information,
          we will notify you without undue delay and in accordance with applicable law.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">13. Cookies and Tracking</h2>
        <p>
          We use cookies and similar technologies to operate the Platform and, with your consent,
          to collect analytics. Analytics cookies are disabled by default and are only enabled if you
          accept them through our cookie consent banner, where you can also manage your preferences at
          any time. Our use of cookies is described in our Privacy Policy.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">14. Third-Party Services</h2>
        <p>
          The Platform integrates with third-party services, including Discord (authentication, bot, and
          community notifications), Talishar (deck play and game-result import), OpenRouter and the AI
          model providers it routes to (Volzar processing), third-party pricing data sources such as
          TCGplayer, Google Analytics (consent-based analytics), and Metafy (optional donations). Your
          use of these services is subject to their respective terms of service and privacy policies.
          We are not responsible for the practices or policies of third-party services.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">15. Account Suspension, Termination, and Deletion</h2>
        <p>
          We reserve the right to suspend or terminate your account at our sole discretion for violations
          of these Terms, fraudulent activity, attempts to process payments through the Platform, or
          other conduct that we deem harmful to the Platform or other Users. Upon termination, your
          right to use the Platform will cease immediately.
        </p>
        <p>
          You may delete your account at any time from your profile page. Deletion takes effect
          immediately and permanently removes your account and its associated personal data. Community
          contributions that have already been published under the open data license described in
          Section 10.5 may remain available under that license after your account is deleted.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">16. Disclaimer of Warranties</h2>
        <p>
          The Platform is provided on an "AS IS" and "AS AVAILABLE" basis. We disclaim all warranties of
          any kind, whether express or implied, including but not limited to the implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that
          the Platform will be uninterrupted, error-free, or secure, or that AI-generated content will be
          accurate or reliable.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">17. Limitation of Liability</h2>
        <p>
          In no event shall FaB Bazaar, its officers, directors, employees, or agents be liable for any
          indirect, incidental, special, consequential, or punitive damages, including without limitation,
          loss of profits, data, use, goodwill, or other intangible losses, arising out of or relating to
          your use of the Platform, even if we have been advised of the possibility of such damages.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS
          ARISING FROM OR RELATED TO THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE
          12 MONTHS PRIOR TO THE EVENT GIVING RISE TO LIABILITY, OR $100, WHICHEVER IS GREATER.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">18. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless FaB Bazaar and its licensors, employees, and
          agents from and against any claims, liabilities, damages, judgments, awards, losses, costs,
          expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Your violation of these Terms</li>
          <li>Your use of the Platform</li>
          <li>Your trading activities with other Users</li>
          <li>Your violation of any rights of another party</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">19. Dispute Resolution</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">19.1 Initial Good Faith Negotiation</h3>
        <p>
          Any dispute arising out of or relating to these Terms or the Platform shall first be addressed
          through good faith negotiation. You agree to contact us directly, using the contact information
          in Section 25, and to allow at least 30 days for informal resolution before pursuing any legal
          action. Most concerns can be resolved this way, quickly and at no cost to anyone.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">19.2 Small Claims and Courts</h3>
        <p>
          If a dispute cannot be resolved informally, either party may bring an individual claim in
          small claims court where permitted. Any other legal action or proceeding shall be brought
          exclusively in the state or federal courts located in Georgia, USA, as set out in Section 21,
          and you consent to the personal jurisdiction of those courts.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">19.3 Class Action Waiver</h3>
        <p>
          To the maximum extent permitted by law, any proceeding shall be limited to the dispute between
          you and FaB Bazaar individually: (a) no proceeding shall be joined or consolidated with any
          other; (b) there is no right or authority for any dispute to be resolved on a class-action
          basis or to utilize class action procedures; and (c) you may not bring claims on behalf of
          any other person.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">20. Force Majeure</h2>
        <p>
          We shall not be liable for any failure or delay in performance under these Terms due to
          circumstances beyond our reasonable control, including but not limited to acts of God,
          natural disasters, war, terrorism, labor disputes, or government actions.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">21. Governing Law and Jurisdiction</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, USA,
          without regard to its conflict of law provisions. Any legal action or proceeding arising under
          these Terms will be brought exclusively in the state or federal courts located in Georgia.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">22. Changes to Terms</h2>
        <p>
          We reserve the right to modify or replace these Terms at any time at our sole discretion.
          If a revision is material, we will provide at least 30 days' notice before the new terms
          take effect by posting a notice on the Platform. Your continued use of the Platform after
          the effective date constitutes acceptance of the new Terms.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">23. Severability</h2>
        <p>
          If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions
          shall remain in full force and effect, and the invalid provision shall be replaced with a valid
          provision that most closely reflects the intent of the original provision.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">24. Entire Agreement</h2>
        <p>
          These Terms, together with our Privacy Policy, constitute the entire agreement
          between you and FaB Bazaar regarding the use of the Platform and supersede all prior agreements
          and understandings, whether written or oral.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">25. Contact Information</h2>
        <p>If you have any questions about these Terms, please contact us at:</p>
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

        <div className="mt-8 mb-4">
          <Link href="/" className="text-blue-600 hover:underline mr-4">
            Return to Home
          </Link>
          <Link href="/privacy-policy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}
