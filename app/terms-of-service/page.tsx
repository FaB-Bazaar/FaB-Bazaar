//app/terms-of-service/page.tsx
import Link from "next/link"

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Terms of Service</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
        <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">1. Introduction</h2>
        <p>
          Welcome to FaB Bazaar, a Flesh and Blood trading card organization and discovery platform. 
          These Terms of Service ("Terms") govern your use of our website, mobile applications, Discord bot, 
          API services, and related services (collectively, the "Platform"). By accessing or using our Platform, 
          you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, 
          please do not use our Platform.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">2. Platform Purpose and Scope</h2>
        <p>
          <strong>FaB Bazaar is a collection management and trade discovery tool.</strong> We provide a platform 
          for users to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Organize their card collections (binders)</li>
          <li>Create wants lists</li>
          <li>Discover potential trading partners</li>
          <li>Initiate trade conversations and workflows</li>
          <li>Track trade agreements digitally</li>
        </ul>
        <p>
          <strong>We are NOT:</strong>
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>A marketplace or sales platform</li>
          <li>A payment processor or escrow service</li>
          <li>A party to any trades between users</li>
          <li>An arbiter, mediator, or dispute resolver</li>
          <li>A verification or authentication service</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">3. Definitions</h2>
        <p>
          <strong>"Platform"</strong> refers to the FaB Bazaar website, mobile apps, Discord bot, API, and all related services.
          <br />
          <strong>"User"</strong> refers to any individual who accesses or uses the Platform.
          <br />
          <strong>"Content"</strong> refers to any information, text, graphics, card data, or other materials on the Platform.
          <br />
          <strong>"Cards"</strong> refers to Flesh and Blood trading cards from Legend Story Studios.
          <br />
          <strong>"Trade"</strong> refers to the peer-to-peer exchange of physical cards between Users.
          <br />
          <strong>"Binder"</strong> refers to a User's digital collection of cards available for trading.
          <br />
          <strong>"Wants List"</strong> refers to cards a User is seeking to acquire through trades.
          <br />
          <strong>"Trade Workflow"</strong> refers to our digital tracking system for trade agreements.
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

        <h3 className="text-xl font-medium mt-4 mb-2">4.1 MCP Integration</h3>
        <p>
          Advanced users may access our API through MCP (Model Context Protocol) tokens. These tokens provide 
          programmatic access to your account data and must be kept secure. You are responsible for any 
          activities performed using your MCP tokens.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">5. Age Requirements and Parental Consent</h2>
        <p>
          While users aged 13 and older may create accounts, <strong>users under 18 must have 
          parental or guardian consent</strong> to use the Platform and engage in trades. By using 
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

        <h3 className="text-xl font-medium mt-4 mb-2">6.4 Trade Workflow System</h3>
        <p>
          Our Platform provides a digital trade tracking system where users can confirm trade agreements. 
          <strong>This system does NOT:</strong>
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Hold cards in physical or legal escrow</li>
          <li>Verify that cards are shipped or received</li>
          <li>Authenticate cards or verify conditions</li>
          <li>Guarantee trade completion</li>
          <li>Act as an intermediary or arbitrator</li>
        </ul>
        <p>
          The tracking system is for organizational convenience only. Users are solely responsible for 
          actually shipping cards and completing trades.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.5 Local Store Integration</h3>
        <p>
          You may set your local game store to connect with nearby traders. Store information 
          is used to facilitate local trading opportunities and discovery.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">6.6 Discord Integration</h3>
        <p>
          Our Discord bot provides Platform features within Discord servers. By using the bot, you 
          agree to Discord's Terms of Service and our bot's specific usage guidelines.
        </p>

        <h3 className="text-xl font-semibold mt-4 mb-2">6.7 No User Verification</h3>
        <p>
          <strong>We do not conduct background checks, verify identities, or screen users.</strong> Discord 
          authentication confirms only that a user has a Discord account, not their identity, 
          trustworthiness, or trading history. Exercise caution and use your own judgment when 
          interacting with other users.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">7. Trading Rules and Conduct</h2>
        
        <h3 className="text-xl font-semibold mt-4 mb-2">7.1 TRADES ONLY - No Sales Permitted</h3>
        <p>
          <strong>FaB Bazaar is exclusively for card-for-card trades.</strong> Individual users may NOT:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Sell cards to other users</li>
          <li>Request or send money through the Platform</li>
          <li>Use the Platform to arrange cash-based transactions</li>
          <li>Advertise cards for sale (as opposed to trade)</li>
          <li>Use Platform messaging to negotiate monetary payments</li>
          <li>Use cash to "even out" trade values</li>
        </ul>
        <p>
          <strong>Users wishing to buy or sell cards must use appropriate marketplace platforms 
          (TCGPlayer, eBay, etc.) or conduct such transactions entirely off-platform.</strong> 
          Any user found using the Platform for monetary transactions may have their account 
          suspended or terminated immediately.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">7.2 Authorized Retailers</h3>
        <p>
          Verified retail stores may display their inventory on FaB Bazaar for informational purposes only. 
          <strong>All sales transactions must occur off-platform</strong> through the retailer's own 
          point-of-sale systems, website, or physical location.
        </p>
        <p>
          FaB Bazaar does NOT:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Process payments for retail sales</li>
          <li>Collect sales tax</li>
          <li>Handle order fulfillment</li>
          <li>Provide consumer protections for purchases</li>
          <li>Issue receipts or invoices</li>
        </ul>
        <p>
          Retailers are solely responsible for all aspects of their sales, including pricing, 
          tax compliance, shipping, and customer service. Any purchases made from retailers 
          are subject to that retailer's terms and conditions, not FaB Bazaar's.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">7.3 Trading Obligations</h3>
        <p>When engaging in trades through our Platform, you agree to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Accurately represent the condition, authenticity, and edition of all cards</li>
          <li>Use standardized condition grades (Near Mint, Light Play, Moderately Played, Heavily Played, Damaged)</li>
          <li>Communicate promptly and professionally with trading partners</li>
          <li>Ship cards within agreed timeframes using appropriate packaging</li>
          <li>Provide tracking information when requested</li>
          <li>Only trade authentic Flesh and Blood cards</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">7.4 Prohibited Trading Practices</h3>
        <p>You may not:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Trade counterfeit, proxy, or unauthorized cards</li>
          <li>Misrepresent card conditions or editions</li>
          <li>Engage in fraudulent trading practices</li>
          <li>Fail to complete confirmed trades without valid reason</li>
          <li>Manipulate pricing data or card valuations</li>
        </ul>

        <h3 className="text-xl font-semibold mt-4 mb-2">7.5 Platform Role and Trade Disputes</h3>
        <p>
          <strong>IMPORTANT: FaB Bazaar is a communication and organizational tool only.</strong> We:
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
          <strong>All trades occur at your own risk.</strong> You are solely responsible for evaluating trading 
          partners, verifying card authenticity and condition, and ensuring safe transaction practices. 
          Users are responsible for resolving trade disputes directly with each other. We do not provide 
          mediation or arbitration services.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">8. Data and Pricing</h2>
        
        <h3 className="text-xl font-medium mt-4 mb-2">8.1 TCG Price Data</h3>
        <p>
          We provide daily updated pricing information from third-party sources. Pricing data is for 
          informational purposes only and may not reflect actual market values. We do not guarantee 
          the accuracy or completeness of pricing information.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">8.2 Webhooks and Notifications</h3>
        <p>
          You may configure webhook notifications for binder updates, wants list matches, and other 
          Platform events. You are responsible for the security and proper configuration of webhook endpoints.
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
          <li>Use automated tools to scrape or harvest data without permission</li>
          <li>Distribute malware, viruses, or other harmful code</li>
          <li>Impersonate others or misrepresent your identity or affiliation</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">10. Content and Intellectual Property</h2>
        
        <h3 className="text-xl font-medium mt-4 mb-2">10.1 Platform Content</h3>
        <p>
          The Platform and its original content, features, and functionality are owned by FaB Bazaar and 
          are protected by international copyright, trademark, and other intellectual property laws.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">10.2 Flesh and Blood Content</h3>
        <p>
          Flesh and Blood, card names, artwork, and related intellectual property are owned by Legend 
          Story Studios. We use this content under fair use principles for informational and trading purposes. 
          FaB Bazaar is not affiliated with Legend Story Studios.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">10.3 User-Generated Content</h3>
        <p>
          By uploading or submitting content to the Platform, you grant us a worldwide, non-exclusive, 
          royalty-free license to use, display, and distribute such content in connection with the Platform's operation.
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
          we will notify you in accordance with applicable law, typically within 72 hours of 
          discovering the breach.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">13. Cookies and Tracking</h2>
        <p>
          We use cookies and similar tracking technologies to enhance your experience on the Platform. 
          Our use of cookies is governed by our Cookie Policy and Privacy Policy. You can manage your 
          cookie preferences through our cookie consent banner.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">14. Third-Party Services</h2>
        <p>
          The Platform integrates with third-party services including Discord, TCG pricing APIs, and 
          other data sources. Your use of these services is subject to their respective terms of service 
          and privacy policies. We are not responsible for the practices or policies of third-party services.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">15. Account Suspension and Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account at our sole discretion for violations 
          of these Terms, fraudulent activity, attempts to use the Platform for sales, or other conduct 
          that we deem harmful to the Platform or other Users. Upon termination, your right to use the 
          Platform will cease immediately.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">16. Disclaimer of Warranties</h2>
        <p>
          The Platform is provided on an "AS IS" and "AS AVAILABLE" basis. We disclaim all warranties of 
          any kind, whether express or implied, including but not limited to the implied warranties of 
          merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that 
          the Platform will be uninterrupted, error-free, or secure.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">17. Limitation of Liability</h2>
        <p>
          In no event shall FaB Bazaar, its officers, directors, employees, or agents be liable for any 
          indirect, incidental, special, consequential, or punitive damages, including without limitation, 
          loss of profits, data, use, goodwill, or other intangible losses, arising out of or relating to 
          your use of the Platform, even if we have been advised of the possibility of such damages.
        </p>
        <p>
          <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS 
          ARISING FROM OR RELATED TO THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 
          12 MONTHS PRIOR TO THE EVENT GIVING RISE TO LIABILITY, OR $100, WHICHEVER IS GREATER.</strong>
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

        <h2 className="text-2xl font-semibold mt-6 mb-4">19. Arbitration Agreement and Dispute Resolution</h2>

        <h3 className="text-xl font-medium mt-4 mb-2">19.1 Initial Good Faith Negotiation</h3>
        <p>
          Any dispute arising out of or relating to these Terms or the Platform shall first be addressed 
          through good faith negotiation. You agree to contact us directly to attempt resolution before 
          pursuing any legal action.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">19.2 Binding Arbitration</h3>
        <p>
          Except for disputes that qualify for small claims court, any controversy or claim arising 
          out of or relating to these Terms or the Platform shall be settled by binding arbitration 
          in accordance with the commercial arbitration rules of the American Arbitration Association. 
          The arbitration shall be conducted in Georgia, USA, and judgment on the award may be entered 
          in any court having jurisdiction.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">19.3 Class Action Waiver</h3>
        <p>
          You agree that any arbitration or proceeding shall be limited to the dispute between you 
          and FaB Bazaar individually. To the full extent permitted by law, (a) no arbitration or 
          proceeding shall be joined with any other; (b) there is no right or authority for any 
          dispute to be arbitrated or resolved on a class-action basis or to utilize class action 
          procedures; and (c) you may not bring claims on behalf of any other person.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">19.4 Opt-Out Right</h3>
        <p>
          You may opt out of this arbitration agreement by sending written notice to us within 30 
          days of first accepting these Terms. The notice must include your name, address, and a 
          clear statement that you wish to opt out of arbitration.
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
          If a revision is material, we will provide at least 30 days' notice prior to any new terms 
          taking effect by posting a notice on the Platform or sending notification to your registered 
          email address. Your continued use of the Platform after such changes constitutes acceptance 
          of the new Terms.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">23. Severability</h2>
        <p>
          If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions 
          shall remain in full force and effect, and the invalid provision shall be replaced with a valid 
          provision that most closely reflects the intent of the original provision.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">24. Entire Agreement</h2>
        <p>
          These Terms, together with our Privacy Policy and Cookie Policy, constitute the entire agreement 
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