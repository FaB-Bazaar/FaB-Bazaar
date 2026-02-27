//app/privacy-policy/page.tsx
import Link from "next/link"

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Privacy Policy</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
        <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">1. Introduction</h2>
        <p>
          Welcome to FaB Bazaar, a Flesh and Blood collection management and trade discovery platform. 
          We are committed to protecting your privacy and personal data. This Privacy Policy explains how 
          we collect, use, disclose, and safeguard your information when you use our website, mobile 
          applications, Discord bot, API services, and related services (collectively, the "Platform").
        </p>
        <p>
          By using our Platform, you agree to the collection and use of information in accordance with this 
          Privacy Policy and our Terms of Service.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">2. Information We Collect</h2>
        
        <h3 className="text-xl font-medium mt-4 mb-2">2.1 Personal Information</h3>
        <p>We collect the following personal information:</p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Authentication Data:</strong> Discord ID, Discord username, email address (from Discord OAuth)</li>
          <li><strong>Profile Information:</strong> Username, display name, local store preferences, location data (city/state for local trading discovery)</li>
          <li><strong>Account Credentials:</strong> MCP tokens for API access (securely hashed and stored)</li>
          <li><strong>Contact Information:</strong> Email addresses for notifications and communication</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">2.2 Platform Activity Data</h3>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Card Collections:</strong> Binder contents, card conditions, trade availability, pricing preferences</li>
          <li><strong>Wants Lists:</strong> Desired cards, priority levels, trading preferences</li>
          <li><strong>Deck Information:</strong> Deck lists, formats, hero selections, card quantities</li>
          <li><strong>Trade Workflow Data:</strong> Digital trade agreements, communication between traders, trade tracking status</li>
          <li><strong>Search Activity:</strong> Card searches, filter preferences, "Who Has" queries</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">2.3 Technical Information</h3>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Usage Data:</strong> IP addresses, browser types, device information, page views, session duration</li>
          <li><strong>Cookies and Tracking:</strong> Session cookies, preference settings, analytics data</li>
          <li><strong>API Usage:</strong> MCP integration logs, request patterns, authentication events</li>
          <li><strong>Webhooks:</strong> Notification configurations, endpoint URLs, delivery logs</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">3. How We Use Your Information</h2>
        
        <h3 className="text-xl font-medium mt-4 mb-2">3.1 Platform Services</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Provide and maintain collection management and discovery tools</li>
          <li>Authenticate users and manage account security</li>
          <li>Connect traders with matching collections and wants lists</li>
          <li>Process binder management and wants list functionality</li>
          <li>Enable deck building and sharing features</li>
          <li>Provide digital trade workflow tracking (tracking only - we are not a party to trades)</li>
          <li>Display local store connections for community discovery</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">3.2 Communication and Notifications</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Send trade match alerts when users have complementary wants/haves</li>
          <li>Deliver webhook notifications for binder and wants list updates</li>
          <li>Provide Discord bot functionality and commands</li>
          <li>Send service updates and important account information</li>
          <li>Notify users of potential trade opportunities</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">3.3 Platform Improvement and Safety</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Analyze usage patterns to improve features</li>
          <li>Optimize search and matching algorithms</li>
          <li>Enhance user experience and platform performance</li>
          <li>Monitor for prohibited activity (sales attempts, fraud, abuse)</li>
          <li>Enforce our trade-only policies and Terms of Service</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">4. What We Don't Do</h2>
        <p><strong>Important clarifications about our platform:</strong></p>
        <ul className="list-disc pl-6 mb-4">
          <li>We do NOT process payments or handle any financial transactions</li>
          <li>We do NOT hold cards in escrow or act as an intermediary</li>
          <li>We do NOT verify user identities, card authenticity, or card conditions</li>
          <li>We do NOT guarantee trade completion or act as a dispute resolver</li>
          <li>We do NOT participate in, arbitrate, or take responsibility for user-to-user trades</li>
          <li>We do NOT collect or track sales data (our platform is trade-only)</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">5. Cookies and Tracking Technologies</h2>
        <p>
          We use cookies and similar technologies to enhance your experience. Our cookie consent system 
          allows you to control which cookies are used.
        </p>

        <h3 className="text-xl font-medium mt-4 mb-2">5.1 Cookie Categories</h3>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Necessary Cookies:</strong> Essential for platform functionality, authentication, and security (always active)</li>
          <li><strong>Functional Cookies:</strong> Remember your preferences (dark mode, language, local store settings)</li>
          <li><strong>Analytics Cookies:</strong> Google Analytics data to understand usage patterns and improve our services</li>
          <li><strong>Advertising Cookies:</strong> Google AdSense cookies for relevant ad display and performance measurement</li>
          <li><strong>Affiliate Cookies:</strong> Track affiliate referrals and partnerships when you've consented to advertising cookies</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">5.2 Cookie Consent and Management</h3>
        <p>
          We are compliant with cookie consent requirements and provide clear disclosures about cookie usage. 
          When you first visit our Platform, you will see a cookie consent banner that allows you to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Accept all cookies</li>
          <li>Reject optional cookies (only necessary cookies will be used)</li>
          <li>Customize your cookie preferences by category</li>
        </ul>
        <p>
          If you opt to allow advertising cookies, this enables:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Google AdSense:</strong> Display of relevant advertisements</li>
          <li><strong>Affiliate Links:</strong> Tracking of referral partnerships (such as TCGPlayer affiliate links)</li>
        </ul>
        <p>
          You can change your cookie preferences at any time through our cookie settings in the footer 
          of our website. You may also configure your browser to refuse cookies, though this may limit 
          platform functionality. Necessary cookies cannot be disabled as they are essential for the 
          Platform to function.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">6. Third-Party Services and Data Sharing</h2>
        
        <h3 className="text-xl font-medium mt-4 mb-2">6.1 Authentication and Social Services</h3>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Discord OAuth:</strong> For user authentication and profile information</li>
          <li><strong>Discord API:</strong> For bot functionality and server integration</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">6.2 Analytics and Advertising</h3>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Google Analytics:</strong> Website usage analytics and performance monitoring</li>
          <li><strong>Google AdSense:</strong> Advertising services and revenue generation</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">6.3 Data and Infrastructure</h3>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>MongoDB Atlas:</strong> Database hosting and data storage</li>
          <li><strong>Cloud Hosting Services:</strong> Platform infrastructure and content delivery</li>
          <li><strong>TCG Pricing APIs:</strong> Card pricing and market data (for informational purposes only)</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">6.4 Data Sharing Practices</h3>
        <p>We do not sell, trade, or rent your personal information to third parties. We share information only:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>With your explicit consent for specific features</li>
          <li>To connect traders with matching collections (card lists, wants lists visible per your privacy settings)</li>
          <li>For local trading connections (city/state level only, never full addresses)</li>
          <li>When required by law or to protect our rights</li>
          <li>With service providers who assist in platform operations (under strict confidentiality)</li>
        </ul>
        <p>
          <strong>We never share financial information because we don't collect it - we don't process payments.</strong>
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">7. Data Security and Protection</h2>
        <p>We implement comprehensive security measures to protect your data:</p>
        
        <h3 className="text-xl font-medium mt-4 mb-2">7.1 Technical Safeguards</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Encryption of sensitive data at rest and in transit (TLS/SSL)</li>
          <li>Secure authentication mechanisms and session management</li>
          <li>API rate limiting and abuse prevention</li>
          <li>Regular security monitoring and vulnerability assessments</li>
          <li>Secure database configurations and access controls</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">7.2 Operational Security</h3>
        <ul className="list-disc pl-6 mb-4">
          <li>Limited access to personal data on a need-to-know basis</li>
          <li>Regular backups with encryption</li>
          <li>Incident response procedures</li>
          <li>Employee data handling training</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">7.3 Data Breach Notification</h3>
        <p>
          In the event of a data breach that affects your personal information, we will notify you 
          in accordance with applicable law, typically within 72 hours of discovering the breach. 
          Notification will be sent via email and/or posted prominently on the Platform.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">8. Your Privacy Rights</h2>
        
        <h3 className="text-xl font-medium mt-4 mb-2">8.1 GDPR Rights (EU Users)</h3>
        <p>Under the General Data Protection Regulation, you have the right to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Access:</strong> Request copies of your personal data</li>
          <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
          <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
          <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
          <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
          <li><strong>Restrict:</strong> Limit how we process your data</li>
          <li><strong>Withdraw Consent:</strong> Remove consent for specific processing activities</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">8.2 CCPA Rights (California Users)</h3>
        <p>Under the California Consumer Privacy Act, you have the right to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Know what personal information is collected and how it's used</li>
          <li>Delete personal information held by us</li>
          <li>Opt-out of the sale of personal information (we do not sell your data)</li>
          <li>Non-discrimination for exercising your privacy rights</li>
        </ul>

        <h3 className="text-xl font-medium mt-4 mb-2">8.3 How to Exercise Your Rights</h3>
        <p>To exercise any of these rights, please contact us using the information in Section 13. We will respond to your request within 30 days.</p>

        <h2 className="text-2xl font-semibold mt-6 mb-4">9. Data Retention</h2>
        <p>We retain your personal data based on the following criteria:</p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Account Data:</strong> Retained while your account is active and for 2 years after deletion</li>
          <li><strong>Trade Workflow Tracking:</strong> Retained for 3 years for user safety, platform improvement, and legal compliance</li>
          <li><strong>Analytics Data:</strong> Anonymized after 26 months in accordance with Google Analytics policies</li>
          <li><strong>Communication Logs:</strong> Retained for 1 year for support and safety purposes</li>
          <li><strong>Violation Records:</strong> Records of Terms of Service violations (sales attempts, fraud) retained for 5 years for platform safety</li>
          <li><strong>Legal Compliance:</strong> Some data may be retained longer if required by law</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">10. International Data Transfers</h2>
        <p>
          FaB Bazaar operates from Georgia, USA. If you access our Platform from outside the United States, 
          your information may be transferred to, stored, and processed in the United States. We ensure 
          appropriate safeguards are in place for international transfers, including:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Adherence to Privacy Shield principles where applicable</li>
          <li>Standard contractual clauses with service providers</li>
          <li>Ensuring adequate level of protection for your data</li>
        </ul>

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
          applicable laws. We will notify you of material changes by:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Posting a notice on our Platform</li>
          <li>Sending an email notification (if you have provided an email address)</li>
          <li>Discord notification through our bot (if you use Discord integration)</li>
        </ul>
        <p>
          Changes will take effect 30 days after notification, except for changes required by law, 
          which may take effect immediately. Your continued use of the Platform after changes take 
          effect constitutes acceptance of the updated Privacy Policy.
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
          <li><strong>Consent:</strong> For marketing communications and optional features</li>
          <li><strong>Contract:</strong> To provide collection management and trade discovery services</li>
          <li><strong>Legitimate Interest:</strong> For platform improvement, security, and community safety</li>
          <li><strong>Legal Obligation:</strong> For compliance with applicable laws</li>
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