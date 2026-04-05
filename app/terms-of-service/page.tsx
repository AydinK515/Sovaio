import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection } from '@/components/legal-page'

const effectiveDate = 'April 4, 2026'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read the terms that govern access to and use of the Sovaio website and creator tools.',
  alternates: {
    canonical: '/terms-of-service',
  },
  openGraph: {
    title: 'Terms of Service | Sovaio',
    description: 'Read the terms that govern access to and use of the Sovaio website and creator tools.',
    url: 'https://sovaio.com/terms-of-service',
    images: [{ url: '/sovaiobanner.png', width: 1536, height: 1024, alt: 'Sovaio' }],
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | Sovaio',
    description: 'Read the terms that govern access to and use of the Sovaio website and creator tools.',
    images: ['/sovaiobanner.png'],
  },
}

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="These Terms of Service govern your access to and use of Sovaio&apos;s website, applications, and creator tools. Please read them carefully before using the service."
      effectiveDate={effectiveDate}
    >
      <LegalSection title="1. Acceptance of Terms">
        <p>
          By accessing or using Sovaio, you agree to be bound by these Terms of Service and our{' '}
          <Link className="text-primary hover:text-primary-hover" href="/privacy-policy">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and Accounts">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be able to form a binding contract in order to use Sovaio.</li>
          <li>You are responsible for providing accurate account information and keeping your credentials secure.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You must promptly notify us at <a className="text-primary hover:text-primary-hover" href="mailto:team@sovaio.com">team@sovaio.com</a> if you believe your account has been compromised.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. The Service">
        <p>
          Sovaio provides software tools for creators, including analytics processing,
          sponsorship-pricing guidance, AI-assisted channel support, and negotiation workflow tools.
        </p>
        <p>
          Sovaio is a software product. We are not your manager, agent, lawyer, accountant,
          financial advisor, broker, or fiduciary, and we do not negotiate with brands on your
          behalf unless we explicitly agree otherwise in a separate written agreement.
        </p>
      </LegalSection>

      <LegalSection title="4. User Content and Permissions">
        <p>
          You may submit, upload, store, or generate content through Sovaio, including analytics
          exports, profile details, notes, chat messages, rate cards, and deal information
          (&quot;User Content&quot;).
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You retain ownership of your User Content.</li>
          <li>
            You give Sovaio a non-exclusive, worldwide, royalty-free license to host, store,
            process, reproduce, and use your User Content as needed to operate, maintain, secure,
            improve, and provide the service to you.
          </li>
          <li>
            You represent that you have the rights, permissions, and authority needed to submit the
            User Content and to let us process it as described in these Terms.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use Sovaio in violation of any law, regulation, contract, or third-party right.</li>
          <li>Upload or submit content you do not have the right to use.</li>
          <li>Attempt to probe, disrupt, disable, or gain unauthorized access to the service or any related systems.</li>
          <li>Interfere with another user&apos;s access to or use of the service.</li>
          <li>Reverse engineer, scrape, copy, or extract the service except as allowed by applicable law.</li>
          <li>Use the service to build a competing product or to run abusive, fraudulent, deceptive, or spam-related activity.</li>
          <li>Use AI-generated output in a misleading way or present it as professional advice from Sovaio.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. AI Features and No Professional Advice">
        <p>
          Some parts of Sovaio use AI to generate insights, drafts, summaries, and recommendations.
          AI outputs may be inaccurate, incomplete, delayed, or unsuitable for your specific
          situation.
        </p>
        <p>
          You are responsible for reviewing any AI-generated output before relying on it. Sovaio
          does not guarantee that any pricing guidance, negotiation script, or recommendation is
          correct, lawful, enforceable, or commercially successful.
        </p>
        <p>
          Sovaio does not provide legal, financial, tax, employment, or other regulated
          professional advice.
        </p>
      </LegalSection>

      <LegalSection title="7. Paid Features">
        <p>
          Certain features may be offered on a paid or subscription basis now or in the future. If
          you purchase a paid feature, you agree to the pricing and billing terms presented to you
          at the time of purchase.
        </p>
        <p>
          Unless otherwise stated at the time of purchase, fees are non-refundable to the maximum
          extent permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual Property">
        <p>
          Sovaio and its related software, design, branding, interfaces, and content other than
          User Content are owned by Sovaio or its licensors and are protected by applicable
          intellectual property laws.
        </p>
        <p>
          Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
          revocable right to access and use the service for your internal personal or business use.
        </p>
      </LegalSection>

      <LegalSection title="9. Feedback">
        <p>
          If you provide feedback, ideas, or suggestions about Sovaio, you grant us a
          non-exclusive, worldwide, perpetual, irrevocable, royalty-free right to use them for any
          lawful purpose without compensation or attribution to you.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension and Termination">
        <p>
          We may suspend or terminate your access to Sovaio, with or without notice, if we believe
          you violated these Terms, created risk for us or others, or used the service in a way
          that could cause harm, legal exposure, or operational disruption.
        </p>
        <p>
          You may stop using the service at any time. If available in the product, you may also
          delete your account through your settings or by contacting{' '}
          <a className="text-primary hover:text-primary-hover" href="mailto:team@sovaio.com">
            team@sovaio.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers">
        <p>
          SOVAIO IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          WE DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE,
          INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          TITLE, NON-INFRINGEMENT, ACCURACY, QUIET ENJOYMENT, OR THAT THE SERVICE WILL BE
          UNINTERRUPTED, SECURE, OR ERROR-FREE.
        </p>
      </LegalSection>

      <LegalSection title="12. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOVAIO AND ITS AFFILIATES, OFFICERS,
          EMPLOYEES, CONTRACTORS, LICENSORS, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR
          ANY LOSS OF PROFITS, REVENUE, BUSINESS, GOODWILL, DATA, OR OTHER INTANGIBLE LOSSES,
          ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT
          OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF $100 OR THE
          AMOUNT YOU PAID TO SOVAIO FOR THE SERVICE IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE
          TO THE CLAIM.
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnity">
        <p>
          You agree to defend, indemnify, and hold harmless Sovaio and its affiliates, officers,
          employees, contractors, and service providers from and against claims, liabilities,
          damages, losses, and expenses, including reasonable attorneys&apos; fees, arising out of or
          related to your User Content, your use of the service, or your violation of these Terms
          or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to the Service or Terms">
        <p>
          We may modify, suspend, or discontinue all or part of Sovaio at any time. We may also
          update these Terms from time to time. When we do, we will post the updated version on
          this page and update the effective date above.
        </p>
        <p>
          Your continued use of Sovaio after updated Terms become effective means you accept the
          revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact">
        <p>
          If you have questions about these Terms, contact{' '}
          <a className="text-primary hover:text-primary-hover" href="mailto:team@sovaio.com">
            team@sovaio.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
