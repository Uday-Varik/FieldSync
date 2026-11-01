import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import styles from '../../auth.module.css';

// Sign-in page (docs/17 slice (d), §3.3). Surrounding copy
// and Clerk appearance variables only — the Clerk flow,
// routes, and redirects are unchanged. The sign-up/invite
// wording is the PR #47 explainer, reused verbatim: signing
// in alone does not grant access. Appearance values mirror
// the §2 tokens in globals.css (brand, ink, muted text,
// system font stack, control radius); Clerk appearance
// variables take literal values, so the token values are
// recorded here with their token names.
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#0f5132', // --color-brand
    colorText: '#1c2420', // --color-ink
    colorTextSecondary: '#55625b', // --color-text-muted
    colorBackground: '#ffffff', // --color-surface
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', // --font-sans
    borderRadius: '6px', // --radius-control
  },
};

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <div className={styles.intro}>
        <h1 className={styles.title}>Sign in to FieldSync</h1>
        <p className={styles.product}>
          Offline-first dispatch and job tracking for field service teams.
        </p>
        <p className={styles.rules}>
          How access works: first create an account (sign up), then a company admin must invite you and link your
          account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.
        </p>
        <p className={styles.switchLink}>
          New to FieldSync? <Link href="/sign-up">Create an account</Link>
        </p>
      </div>
      <SignIn appearance={CLERK_APPEARANCE} />
    </main>
  );
}
