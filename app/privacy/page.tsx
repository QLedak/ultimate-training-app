import Link from "next/link";

/**
 * DRAFT — placeholder legal content, not reviewed by an attorney. Fill in
 * [APP NAME], [COMPANY NAME/ENTITY], and [CONTACT EMAIL] once decided, and
 * have a lawyer review before this governs real users — especially given
 * the health/injury data this app collects. Keep this in sync with
 * lib/db/supabase-admin.ts's actual table list (see the comment in
 * supabase/migrations/0007_enable_rls.sql) whenever new personal data
 * fields are added.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/login" className="text-sm text-brand underline">
        ← Back
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-brand-dark">Privacy Policy</h1>
      <p className="mt-1 text-sm text-slate-500">Draft — last updated [DATE]. Not final; pending legal review.</p>

      <div className="prose prose-slate mt-8 max-w-none space-y-6 text-sm leading-6 text-slate-700">
        <section>
          <h2 className="text-base font-semibold text-brand-dark">1. What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Account info:</strong> name, email, password (stored hashed by our authentication provider).</li>
            <li>
              <strong>Health &amp; training data:</strong> the intake information you provide (training history,
              equipment, current and historical injuries/pain, benchmark lifts, bodyweight, goals), your training
              schedule, and every workout you log (weights, reps, sets, how each set felt, notes).
            </li>
            <li><strong>Coach communications:</strong> if applicable, messages/edits exchanged during program review.</li>
            <li><strong>Usage data:</strong> basic technical logs (e.g. IP address, timestamps) used for security and abuse prevention.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">2. How we use it</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To generate and adjust your personalized training programs, including sending relevant parts of it to our AI provider (see below) to produce the program.</li>
            <li>To let your coach review, edit, and approve programs before they reach you.</li>
            <li>To operate, secure, and improve the Service (e.g. fraud/abuse prevention, debugging).</li>
            <li>
              With your (or your coach&apos;s) explicit opt-in, an approved program may be added, de-identified,
              to a reference library used to help generate other athletes&apos; programs. This is optional per
              program, not automatic.
            </li>
          </ul>
          <p>We do not sell your personal information.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">3. Who we share it with</h2>
          <p>We share data only with service providers who need it to operate the Service on our behalf:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Supabase</strong> — hosts our database and handles authentication.</li>
            <li><strong>Anthropic</strong> — processes the training-relevant portions of your profile to generate program content. Anthropic does not use this data to train its models under our agreement with them. [Confirm actual data-use terms of the Anthropic plan in use before publishing this.]</li>
            <li>[Add a payment processor, e.g. Stripe, once payments are implemented — card details are handled by them directly, never stored by us.]</li>
          </ul>
          <p>We do not share your health/injury information with any other third party without your consent, except as required by law.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">4. Data retention &amp; deletion</h2>
          <p>
            We retain your data for as long as your account is active, so your training history remains useful to
            your program. You can request deletion of your account and associated data at any time by contacting
            [CONTACT EMAIL]; we&apos;ll delete it except where we&apos;re required to retain records by law (e.g.
            billing records).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">5. Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, export, or delete your personal
            data, and to object to certain processing. Contact [CONTACT EMAIL] to exercise these rights.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">6. Security</h2>
          <p>
            We use industry-standard measures (encrypted connections, access controls, database-level security
            policies) to protect your data, but no system is perfectly secure — we can&apos;t guarantee absolute
            security.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">7. Children&apos;s privacy</h2>
          <p>
            The Service is not intended for children under [13/16 — set per jurisdiction]. If you believe a child
            has provided us personal information, contact us and we&apos;ll delete it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">8. Changes to this policy</h2>
          <p>We&apos;ll notify you of material changes to this policy before they take effect.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-brand-dark">9. Contact</h2>
          <p>Questions about this policy? Contact us at [CONTACT EMAIL].</p>
        </section>
      </div>
    </main>
  );
}
