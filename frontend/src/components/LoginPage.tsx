import React, { useState } from 'react';
import { UserRole } from '../types';
import { apiUrl } from '../utils/api';
import { TqiLogo } from './TqiLogo';
import {
  Icon,
  type IconName,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Star,
  Hash,
} from './ui/icons';

export interface AuthSession {
  token?: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clusterId: string;
  clusterName: string;
  designation: string;
  avatarText: string;
  mustChangePassword?: boolean;
}

interface LoginPageProps {
  onLoginSuccess: (session: AuthSession) => void;
}

const TRUST_PILLS = ['Connect', 'Explore', 'Share', 'Lead'];

const MobileBrandStrip: React.FC = () => (
  <div className="tqi-login-mobile-strip" aria-hidden>
    <TqiLogo size={36} />
    <div>
      <div className="tqi-login-mobile-strip-name">Talent Quest for India</div>
      <div className="tqi-login-mobile-strip-meta">Academic ERP</div>
    </div>
  </div>
);

const CardBrandMark: React.FC = () => (
  <div className="tqi-login-card-brand">
    <TqiLogo size={32} />
    <div>
      <div className="tqi-login-card-brand-name">Talent Quest for India</div>
      <div className="tqi-login-card-brand-meta">Academic ERP</div>
    </div>
  </div>
);

const StagePanel: React.FC<{ kicker: string; eyebrow: React.ReactNode }> = ({ kicker, eyebrow }) => (
  <aside className="tqi-login-stage">
    <div className="tqi-stage-orb" aria-hidden />
    <div className="tqi-dot-grid" aria-hidden />
    <div className="tqi-stage-content">
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <TqiLogo size={42} />
          <div className="flex flex-col" style={{ lineHeight: 1.1 }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              Talent Quest for India
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                opacity: 0.75,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#fff',
              }}
            >
              Academic ERP
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <span className="tqi-login-kicker">
          <ShieldCheck size={12} weight="light" /> {kicker}
        </span>
        <h1 className="tqi-login-headline" style={{ marginTop: '1.1rem' }}>
          {eyebrow}
        </h1>
        <p className="tqi-login-sub">
          Coordinate college volunteers, track 8-day cycles, log field expenses with OCR, and route
          approvals from a single workspace built for Tamil Nadu.
        </p>
      </div>

      <div className="tqi-testimonial">
        <div className="tqi-testimonial-stars" aria-label="5 out of 5 stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} weight="fill" />
          ))}
        </div>
        <p className="tqi-testimonial-quote">
          TQI transformed my perspective on community leadership and gave me the tools to drive real
          change across our college cluster.
        </p>
        <div className="tqi-testimonial-author">
          <span className="tqi-testimonial-avatar">PS</span>
          <div>
            <div className="tqi-testimonial-name">Priya Sharma</div>
            <div className="tqi-testimonial-meta">Youth Volunteer · TQI Tamil Nadu</div>
          </div>
        </div>
      </div>

      <div className="tqi-trust-row">
        <p className="tqi-trust-row-eyebrow">Trusted by modern TQI teams</p>
        <div className="tqi-trust-pills">
          {TRUST_PILLS.map((p) => (
            <span key={p} className="tqi-trust-pill">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  </aside>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('anand.s@tqi.org');
  const [password, setPassword] = useState('TQI@Admin2026!');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'password' | 'otp'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [forgotError, setForgotError] = useState<string | null>(null);

  const quickRoles: { label: string; email: string; pass: string; role: UserRole }[] = [
    { label: 'Super Admin', email: 'anand.s@tqi.org', pass: 'TQI@Admin2026!', role: 'Super Admin' },
    { label: 'Cluster Admin', email: 'erode.admin@tqi.org', pass: 'Cluster@2026!', role: 'Cluster Admin' },
    { label: 'Volunteer SPOC', email: 'saravanan.m@tqi.org', pass: 'Volunteer@2026!', role: 'Cluster Admin' },
  ];

  const applyQuickRole = (qr: typeof quickRoles[0]) => {
    setIdentifier(qr.email);
    setPassword(qr.pass);
    setActiveMethod('password');
    setErrorMessage(null);
  };

  const openForgot = () => {
    setForgotEmail(identifier);
    setForgotStatus('idle');
    setForgotError(null);
    setShowForgotModal(true);
  };

  const closeForgot = () => {
    if (forgotStatus === 'sending') return;
    setShowForgotModal(false);
    setForgotStatus('idle');
    setForgotError(null);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (forgotEmail || identifier).trim();
    if (!email) { setForgotError('Please enter your work email.'); return; }
    setForgotStatus('sending');
    setForgotError(null);
    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        setForgotError(data?.error || 'Unable to send reset link. Please try again.');
        setForgotStatus('error');
        return;
      }
      setForgotStatus('sent');
    } catch {
      setForgotError('Unable to reach the server. Please check your connection and try again.');
      setForgotStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) { setErrorMessage('Please enter your work email.'); return; }
    if (activeMethod === 'password' && !cleanPass) { setErrorMessage('Please enter your account password.'); return; }
    if (activeMethod === 'otp' && otpRequested && !otp.trim()) { setErrorMessage('Please enter the 6-digit verification code.'); return; }

    setIsLoading(true);
    try {
      const passwordOnlyLogin = activeMethod === 'password';
      const endpoint = passwordOnlyLogin ? '/api/auth/login' : (otpRequested ? '/api/auth/login' : '/api/auth/request-otp');
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanId,
          ...(passwordOnlyLogin ? { password: cleanPass } : {}),
          ...(!passwordOnlyLogin && otpRequested ? { otp: otp.trim() } : {})
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        setErrorMessage(data?.error || 'Invalid email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!passwordOnlyLogin && !otpRequested) {
        setOtpRequested(true);
        setIsLoading(false);
        return;
      }

      const user = data.user;
      const session: AuthSession = {
        token: data.token,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clusterId: user.clusterId || 'all',
        clusterName: user.clusterName || 'All Clusters',
        designation: user.role === 'Super Admin' ? 'Statewide Super Admin' : 'Cluster Admin (College SPOC)',
        avatarText: (user.name || 'U').split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase(),
        mustChangePassword: Boolean(data.mustChangePassword || user.mustChangePassword),
      };

      if (session.mustChangePassword) setPendingSession(session);
      else onLoginSuccess(session);
      setIsLoading(false);
    } catch (err) {
      // SECURITY: Never mint a session on a network/auth failure. The previous
      // catch block fell back to a fake Super-Admin session, which let any
      // unauthenticated visitor into the app whenever the backend was
      // unreachable. We now only allow the offline demo path when BOTH the
      // email AND password match a known quickRole exactly, and only for the
      // password flow (never for OTP, which has no offline equivalent).
      const passwordOnlyLogin = activeMethod === 'password';
      if (!passwordOnlyLogin) {
        setErrorMessage('Unable to reach the authentication server. Please check your connection and try again.');
        setIsLoading(false);
        return;
      }
      const roleMatch = quickRoles.find(
        (r) => r.email.toLowerCase() === cleanId.toLowerCase() && r.pass === cleanPass
      );
      if (!roleMatch) {
        setErrorMessage('Unable to reach the authentication server. Please check your connection and try again.');
        setIsLoading(false);
        return;
      }
      const session: AuthSession = {
        token: 'demo-' + Date.now(),
        id: 'demo-' + roleMatch.email,
        name: roleMatch.label,
        email: roleMatch.email,
        role: roleMatch.role,
        clusterId: 'demo',
        clusterName: 'Demo cluster',
        designation: roleMatch.label,
        avatarText: roleMatch.label.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
        mustChangePassword: false,
      };
      onLoginSuccess(session);
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (newPassword.length < 8) { setErrorMessage('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingSession?.token}` },
        body: JSON.stringify({ currentPassword: password || 'TQI', newPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) { setErrorMessage(data?.error || 'Unable to change password.'); setIsLoading(false); return; }
      onLoginSuccess({ ...pendingSession!, mustChangePassword: false });
    } catch {
      // SECURITY: Never advance to the dashboard without backend confirmation.
      // A network failure here previously signed the user in without ever
      // recording the new password. Surface the error and keep them on the
      // onboarding screen so they can retry.
      setErrorMessage('Unable to reach the server. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  // ============= Onboarding / change-password view =============
  if (pendingSession) {
    return (
      <div className="tqi-login-shell">
        <StagePanel
          kicker="First-time onboarding"
          eyebrow={
            <>
              One last <span className="tqi-apricot-underline">step.</span>
              <br />
              Make it yours.
            </>
          }
        />

        <section className="tqi-login-form-side">
          <MobileBrandStrip />
          <div className="tqi-login-card">
            <CardBrandMark />
            <span className="tqi-login-kicker" style={{ background: 'var(--brand-light)', color: 'var(--brand)', borderColor: 'transparent' }}>
              <KeyRound size={12} weight="light" /> First-time onboarding
            </span>
            <h1 className="tqi-login-h1" style={{ marginTop: '0.85rem' }}>
              Set your new password
            </h1>
            <p className="tqi-login-sub2 tqi-hide-mobile">
              Welcome, <strong style={{ color: 'var(--text)' }}>{pendingSession.name}</strong>. Choose a
              personal password you don't reuse anywhere else.
            </p>

            {errorMessage && (
              <div className="tqi-alert tqi-alert-error" style={{ marginTop: '1rem', marginBottom: 0 }}>
                <AlertCircle size={14} weight="light" className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} style={{ marginTop: '1.25rem' }}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label className="tqi-login-label" htmlFor="new-pass">New password</label>
                <div className="tqi-login-input-wrap">
                  <Lock size={16} weight="light" className="tqi-login-input-icon" />
                  <input
                    id="new-pass"
                    type="password"
                    className="tqi-login-input"
                    value={newPassword}
                    minLength={8}
                    onChange={(e) => { setNewPassword(e.target.value); setErrorMessage(null); }}
                    placeholder="At least 8 characters"
                  />
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Use 8+ characters, including a number and a symbol.
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="tqi-login-label" htmlFor="confirm-pass">Confirm new password</label>
                <div className="tqi-login-input-wrap">
                  <Lock size={16} weight="light" className="tqi-login-input-icon" />
                  <input
                    id="confirm-pass"
                    type="password"
                    className="tqi-login-input"
                    value={confirmPassword}
                    minLength={8}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrorMessage(null); }}
                    placeholder="Re-enter the same password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="tqi-login-primary"
              >
                <span>{isLoading ? 'Saving…' : 'Save and enter ERP'}</span>
                <ArrowRight size={16} weight="light" />
              </button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  // ============= Default sign-in view =============
  return (
    <div className="tqi-login-shell">
      <StagePanel
        kicker="Rural education, unified"
        eyebrow={
          <>
            Creating <span className="tqi-apricot-underline">socially responsible</span> leaders
            across Tamil Nadu.
          </>
        }
      />

      <section className="tqi-login-form-side">
        <MobileBrandStrip />
        <div className="tqi-login-card tqi-rise">
          <CardBrandMark />
          <h1 className="tqi-login-h1">Welcome back</h1>
          <p className="tqi-login-sub2">Sign in to your Talent Quest workspace.</p>

          {errorMessage && (
            <div className="tqi-alert tqi-alert-error" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <AlertCircle size={14} weight="light" className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Method toggle: Password / OTP */}
          <div className="tqi-login-method" style={{ marginTop: '1.1rem' }} role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              className="tqi-login-method-btn"
              data-active={activeMethod === 'password'}
              onClick={() => { setActiveMethod('password'); setOtpRequested(false); setErrorMessage(null); }}
              role="tab"
              aria-selected={activeMethod === 'password'}
            >
              <Lock size={13} weight="light" /> Password
            </button>
            <button
              type="button"
              className="tqi-login-method-btn"
              data-active={activeMethod === 'otp'}
              onClick={() => { setActiveMethod('otp'); setErrorMessage(null); }}
              role="tab"
              aria-selected={activeMethod === 'otp'}
            >
              <Hash size={13} weight="light" /> OTP code
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.85rem' }}>
              <label className="tqi-login-label" htmlFor="login-email">Work email</label>
              <div className="tqi-login-input-wrap">
                <Mail size={16} weight="light" className="tqi-login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setErrorMessage(null); }}
                  placeholder="name@college.org"
                  className="tqi-login-input"
                />
              </div>
            </div>

            {activeMethod === 'password' ? (
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="tqi-login-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={openForgot}
                    className="tqi-login-link"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="tqi-login-input-wrap" style={{ marginTop: '0.4rem' }}>
                  <Lock size={16} weight="light" className="tqi-login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMessage(null); }}
                    placeholder="Enter your password"
                    className="tqi-login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="tqi-login-input-action"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} weight="light" /> : <Eye size={16} weight="light" />}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="tqi-login-label" style={{ marginBottom: 0 }}>Verification code</label>
                  {otpRequested && (
                    <button
                      type="button"
                      onClick={() => { setOtpRequested(false); setOtp(''); setErrorMessage(null); }}
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cobalt)' }}
                    >
                      Resend
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setErrorMessage(null); }}
                  placeholder="000000"
                  className="tqi-login-input tqi-num"
                  style={{ marginTop: '0.4rem', textAlign: 'center', letterSpacing: '0.45em', fontWeight: 700, fontSize: '1rem', paddingLeft: '0.875rem', paddingRight: '0.875rem' }}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  {otpRequested ? 'Code sent. Check your inbox.' : 'Tap "Send code" to receive a 6-digit OTP.'}
                </span>
              </div>
            )}

            <label className="tqi-login-checkbox" style={{ margin: '0.4rem 0 1rem' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="tqi-hide-mobile">Keep me signed in for 30 days</span>
              <span className="tqi-show-mobile">Remember me</span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="tqi-login-primary"
            >
              {isLoading ? (
                <>
                  <span className="tqi-spinner" style={{ width: 14, height: 14 }} />
                  <span>Signing you in…</span>
                </>
              ) : (
                <>
                  <span>{activeMethod === 'otp' && !otpRequested ? 'Send code' : 'Sign in'}</span>
                  <ArrowRight size={16} weight="light" />
                </>
              )}
            </button>

            <div className="tqi-login-divider">Quick demo</div>
            <div className="tqi-login-roles">
              {quickRoles.map((qr) => {
                const active = identifier === qr.email;
                return (
                  <button
                    key={qr.label}
                    type="button"
                    onClick={() => applyQuickRole(qr)}
                    className="tqi-login-role"
                    data-active={active}
                  >
                    {qr.label}
                  </button>
                );
              })}
            </div>
            <p className="tqi-login-secondary-text">
              By signing in you agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
            </p>
          </form>
        </div>
      </section>

      {/* ============= Forgot password modal ============= */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tqi-forgot-title"
          className="tqi-modal-mobile-full"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--login-ink) 40%, transparent)',
            backdropFilter: 'blur(8px)',
            padding: '1rem',
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeForgot(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeForgot(); }}
        >
          <div
            className="tqi-login-card tqi-modal-panel"
            style={{ maxWidth: 380, position: 'relative' }}
            onKeyDown={(e) => { if (e.key === 'Escape') closeForgot(); }}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h2 id="tqi-forgot-title" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Reset password
              </h2>
              <button
                type="button"
                onClick={closeForgot}
                disabled={forgotStatus === 'sending'}
                className="tqi-login-link"
                aria-label="Close reset password dialog"
                style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} weight="light" />
              </button>
            </header>

            {forgotStatus === 'sent' ? (
              <div style={{ paddingTop: '1rem', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--success-bg)', color: 'var(--success)' }}>
                  <CheckCircle2 size={28} weight="light" />
                </div>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>Reset link sent</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--login-muted)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  If <strong style={{ color: 'var(--text)' }}>{(forgotEmail || identifier).trim()}</strong> is registered, you'll receive a one-time reset link valid for 15 minutes.
                </p>
                <button
                  type="button"
                  onClick={closeForgot}
                  className="tqi-login-primary"
                  style={{ marginTop: '1rem' }}
                >
                  <span>Back to sign in</span>
                  <ArrowRight size={16} weight="light" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--login-muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  Enter your registered work email. We'll send a one-time reset link valid for 15 minutes.
                </p>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="tqi-login-label" htmlFor="forgot-email">Work email</label>
                  <div className="tqi-login-input-wrap">
                    <Mail size={16} weight="light" className="tqi-login-input-icon" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      autoFocus
                      value={forgotEmail || identifier}
                      onChange={(e) => { setForgotEmail(e.target.value); if (forgotError) setForgotError(null); }}
                      className="tqi-login-input"
                      placeholder="name@college.org"
                    />
                  </div>
                </div>

                {forgotError && (
                  <div className="tqi-alert tqi-alert-error" style={{ marginBottom: '0.75rem' }}>
                    <AlertCircle size={14} weight="light" className="shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeForgot}
                    disabled={forgotStatus === 'sending'}
                    className="tqi-btn-ghost tqi-touch"
                    style={{ height: 38, padding: '0 0.875rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotStatus === 'sending'}
                    className="tqi-login-primary"
                    style={{ width: 'auto', height: 38, padding: '0 1.1rem', fontSize: '0.8125rem' }}
                  >
                    {forgotStatus === 'sending' ? (
                      <>
                        <span className="tqi-spinner" style={{ width: 14, height: 14 }} />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <span>Send link</span>
                        <ArrowRight size={14} weight="light" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

