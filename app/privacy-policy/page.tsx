import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/legal-page'

const effectiveDate = 'April 4, 2026'

export const metadata: Metadata = {
  title: 'Privacy Policy | Sovaio',
  description:
    'Learn what information Sovaio collects, how we use it, and the choices available to users.',
  alternates: {
    canonical: '/privacy-policy',
  },
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This Privacy Policy explains how Sovaio collects, uses, stores, and shares information when you use our website, create an account, upload analytics exports, generate rate cards, and use our AI-powered creator tools."
      effectiveDate={effectiveDate}
    >
      <LegalSection title="1. Scope">
        <p>
          This Privacy Policy applies to Sovaio&apos;s website, web application, and related services
          that help creators analyze channel performance, generate sponsorship pricing guidance,
          and manage brand negotiations.
        </p>
        <p>
          By using Sovaio, you agree to the collection and use of information as described in
          this Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p>We collect information you provide directly to us, information created through your use of the service, and certain information collected automatically.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Account and profile information, such as your email address, name, channel name,
            avatar, niche, subscriber count, sponsorship history, and other profile details you
            choose to provide.
          </li>
          <li>
            YouTube analytics information that you choose to upload or generate through the
            product, including structured data derived from exported YouTube Studio CSV reports,
            analytics snapshot data, report confidence data, and related metrics.
          </li>
          <li>
            Content you create in the service, such as rate cards, pitch emails, negotiation
            details, notes, chat messages, suggested scripts, and other saved workspace content.
          </li>
          <li>
            Communications you send to us, including support requests sent to{' '}
            <a className="text-primary hover:text-primary-hover" href="mailto:support@sovaio.com">
              support@sovaio.com
            </a>
            .
          </li>
          <li>
            Usage and device information collected automatically, such as page views, feature
            interactions, browser and device information, timestamps, approximate location data
            inferred from IP address, referral data, and error or performance diagnostics.
          </li>
          <li>
            Authentication, session, and security information, including cookies or similar
            technologies used to keep you signed in, secure your account, and remember session
            preferences.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How We Use Information">
        <p>We use the information we collect to operate, improve, and protect Sovaio, including to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Create and manage your account and profile.</li>
          <li>Process your uploaded analytics data and generate reports, rate cards, and creator guidance.</li>
          <li>Provide AI-powered features, including channel advice, sponsorship pricing guidance, and negotiation assistance.</li>
          <li>Store your saved work so you can return to it later.</li>
          <li>Authenticate users, maintain sessions, and protect against misuse, fraud, and unauthorized access.</li>
          <li>Analyze product usage, troubleshoot issues, and improve the reliability and usefulness of the service.</li>
          <li>Communicate with you about your account, support issues, updates, and service-related notices.</li>
          <li>Comply with legal obligations and enforce our agreements.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. AI Processing">
        <p>
          Sovaio includes AI-powered features. When you use those features, we may send relevant
          prompts, messages, analytics context, deal context, and related workspace information to
          third-party model providers that help us generate responses and recommendations.
        </p>
        <p>
          AI outputs can be incomplete, inaccurate, or unsuitable for a particular situation. You
          should review outputs carefully before relying on them for business, legal, financial, or
          contractual decisions.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies and Analytics">
        <p>
          We use cookies and similar technologies for authentication, session continuity, security,
          and product analytics. We also use analytics tools to understand how users navigate the
          site, which features are used, and when errors occur so we can improve the service.
        </p>
      </LegalSection>

      <LegalSection title="6. How We Share Information">
        <p>We do not sell your personal information. We may share information in the following circumstances:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            With service providers and infrastructure vendors that help us operate Sovaio, such as
            authentication, database, storage, analytics, hosting, and AI providers.
          </li>
          <li>
            When you direct us to do so or when sharing is necessary to provide a feature you
            request.
          </li>
          <li>
            To comply with law, regulation, legal process, or valid governmental request.
          </li>
          <li>
            To protect the rights, safety, security, or property of Sovaio, our users, or others.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Data Retention">
        <p>
          We retain information for as long as reasonably necessary to provide the service, keep
          your account active, maintain your saved workspace, comply with legal obligations, resolve
          disputes, and enforce our agreements.
        </p>
        <p>
          If you delete your account, we will delete or de-identify account data from our active
          systems as described by our internal processes, although limited copies may remain in
          backups, logs, or records retained for security, fraud prevention, or legal compliance for
          a limited period.
        </p>
      </LegalSection>

      <LegalSection title="8. Your Choices and Rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>You can review and update certain profile information from your account settings.</li>
          <li>
            You can request account deletion by using any in-product deletion feature we make
            available or by contacting{' '}
            <a className="text-primary hover:text-primary-hover" href="mailto:support@sovaio.com">
              support@sovaio.com
            </a>
            .
          </li>
          <li>
            Depending on where you live, you may have rights to request access to, correction of,
            deletion of, or portability for certain personal information, or to object to or limit
            certain processing. We will review and respond to qualifying requests as required by
            applicable law.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="9. California and Other U.S. Privacy Rights">
        <p>
          Depending on whether applicable privacy laws cover Sovaio or a particular request,
          residents of certain states may have rights to know, access, correct, delete, or obtain a
          copy of certain personal information, and to appeal a denied request. We may ask you to
          verify your identity before acting on a request.
        </p>
        <p>
          If you want to exercise a privacy request, contact{' '}
          <a className="text-primary hover:text-primary-hover" href="mailto:support@sovaio.com">
            support@sovaio.com
          </a>{' '}
          and include enough information for us to evaluate and respond.
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          We use reasonable administrative, technical, and organizational safeguards designed to
          protect personal information. No method of transmission over the internet or method of
          electronic storage is completely secure, so we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="11. Children&apos;s Privacy">
        <p>
          Sovaio is not directed to children under 13, and we do not knowingly collect personal
          information from children under 13. If you believe a child under 13 has provided personal
          information to us, contact{' '}
          <a className="text-primary hover:text-primary-hover" href="mailto:support@sovaio.com">
            support@sovaio.com
          </a>{' '}
          so we can investigate.
        </p>
      </LegalSection>

      <LegalSection title="12. International Processing">
        <p>
          Your information may be processed and stored in countries other than the country where
          you live. By using Sovaio, you understand that your information may be transferred to and
          processed in jurisdictions that may have different data protection laws than your own.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will post the
          updated version on this page and update the effective date above. Your continued use of
          Sovaio after an update becomes effective means you accept the revised policy.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
