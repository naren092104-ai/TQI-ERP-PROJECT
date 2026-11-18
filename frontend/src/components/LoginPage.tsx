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
  AlertCircle,
  CheckCircle2,
  X,
  Hash,
} from './ui/icons';

export interface AuthSession {
  token?: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
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

const TqiLoadingMark: React.FC = () => (
  <span className="tqi-branded-loader" role="status" aria-label="Loading">
    <TqiLogo size={13} />
  </span>
);

const normalizeUserRole = (role?: string): UserRole => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'super_admin' || normalized === 'super admin') return 'Super Admin';
  if (normalized === 'cluster_admin' || normalized === 'cluster admin') return 'Cluster Admin';
  return 'Super Admin';
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'password' | 'otp'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'complete'>('email');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotNotice, setForgotNotice] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('token') || '');

  const openForgot = () => {
    setForgotEmail(identifier);
    setForgotStatus('idle');
    setForgotStep('email');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotNotice('');
    setForgotError(null);
    setShowForgotModal(true);
  };

  const closeForgot = () => {
    if (forgotStatus === 'sending') return;
    setShowForgotModal(false);
    setForgotStatus('idle');
    setForgotStep('email');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotNotice('');
    setForgotError(null);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmail.trim().toLowerCase();
    if (!email) { setForgotError('Please enter your work email.'); return; }
    if (forgotStep === 'otp') {
      if (!/^\d{6}$/.test(forgotOtp)) { setForgotError('Enter the 6-digit code from your email.'); return; }
      if (!passwordStrong(forgotNewPassword)) { setForgotError('Use 8+ characters with uppercase, lowercase, a number, and a special character.'); return; }
      if (forgotNewPassword !== forgotConfirmPassword) { setForgotError('Passwords do not match.'); return; }
    }
    setForgotStatus('sending');
    setForgotError(null);
    setForgotNotice('');
    try {
      const requestingCode = forgotStep === 'email';
      const response = await fetch(apiUrl(requestingCode ? '/api/auth/forgot-password' : '/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestingCode
          ? { email }
          : { email, otp: forgotOtp, newPassword: forgotNewPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        setForgotError(data?.error || (requestingCode ? 'Unable to send a verification code. Please try again.' : 'Unable to reset your password. Please try again.'));
        setForgotStatus('error');
        return;
      }
      if (requestingCode) {
        setForgotStep('otp');
        setForgotNotice('If your account is registered, a 6-digit code was sent. It expires in 5 minutes.');
        setForgotStatus('idle');
      } else {
        setForgotStep('complete');
        setForgotNotice(data.confirmationEmailSent === false
          ? 'Your password was reset. The confirmation email could not be sent; contact your administrator if you did not make this change.'
          : 'Your password was reset. You can now sign in with your new password.');
        setForgotStatus('sent');
      }
    } catch {
      setForgotError('Unable to reach the server. Please check your connection and try again.');
      setForgotStatus('error');
    }
  };

  const handleForgotResend = async () => {
    const email = forgotEmail.trim().toLowerCase();
    setForgotStatus('sending');
    setForgotError(null);
    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to request another code.');
      setForgotNotice('If your account is registered, a code will be sent when the resend cooldown allows it.');
      setForgotStatus('idle');
    } catch (error: any) {
      setForgotError(error?.message || 'Unable to request another code.');
      setForgotStatus('error');
    }
  };

  const handleLoginOtpResend = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(apiUrl('/api/auth/request-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        setErrorMessage(data?.error || 'Unable to request a verification code. Please wait and try again.');
        return;
      }
      setOtp('');
      setOtpRequested(true);
    } catch {
      setErrorMessage('Unable to reach the authentication server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
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

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
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
        role: normalizeUserRole(user.role),
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
      setErrorMessage('Unable to reach the authentication server. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!passwordStrong(newPassword)) { setErrorMessage('Use 8+ characters with uppercase, lowercase, a number, and a special character.'); return; }
    if (newPassword !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingSession?.token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) { setErrorMessage(data?.error || 'Unable to change password.'); setIsLoading(false); return; }
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
  const handleTokenReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!passwordStrong(newPassword) || newPassword !== confirmPassword) { setErrorMessage(!passwordStrong(newPassword) ? 'Use 8+ characters with uppercase, lowercase, a number, and a special character.' : 'Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/reset-password'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword }) });
      const data = await response.json();
      if (!response.ok || !data?.success) { setErrorMessage(data?.error || 'Unable to reset password.'); setIsLoading(false); return; }
      window.history.replaceState({}, '', window.location.pathname);
      setErrorMessage(data.confirmationEmailSent === false
        ? 'Password reset successfully, but the confirmation email could not be sent. You can now sign in.'
        : 'Password reset successfully. You can now sign in.');
      setNewPassword(''); setConfirmPassword(''); setIsLoading(false);
    } catch { setErrorMessage('Unable to reach the server. Please try again.'); setIsLoading(false); }
  };

  if (resetToken) {
    return <div className="tqi-login-shell"><section className="tqi-login-form-side"><div className="tqi-login-card"><CardBrandMark /><h1 className="tqi-login-h1">Create New Password</h1><p className="tqi-login-sub2">Use a new password for your TQI Cluster Admin account.</p>{errorMessage && <div className="tqi-alert tqi-alert-error" style={{ marginTop: '1rem' }}>{errorMessage}</div>}<form onSubmit={handleTokenReset} style={{ marginTop: '1.25rem' }}><label className="tqi-login-label" htmlFor="reset-new-pass">New password</label><input id="reset-new-pass" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="tqi-login-input" placeholder="At least 8 characters" /><label className="tqi-login-label" htmlFor="reset-confirm-pass" style={{ marginTop: '0.85rem' }}>Confirm password</label><input id="reset-confirm-pass" type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="tqi-login-input" placeholder="Re-enter your password" /><button type="submit" disabled={isLoading} className="tqi-login-primary" style={{ marginTop: '1.25rem' }}>{isLoading ? 'Resetting...' : 'Reset Password'}</button></form></div></section></div>;
  }

  // ============= Onboarding / change-password view =============
  if (pendingSession) {
    return (
      <div className="tqi-login-shell">
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
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    minLength={8}
                    onChange={(e) => { setNewPassword(e.target.value); setErrorMessage(null); }}
                    placeholder="At least 8 characters"
                    className="tqi-login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="tqi-login-input-action"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} weight="light" /> : <Eye size={16} weight="light" />}
                  </button>
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Minimum 8 characters, uppercase, lowercase, number, and special character.
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="tqi-login-label" htmlFor="confirm-pass">Confirm new password</label>
                <div className="tqi-login-input-wrap">
                  <Lock size={16} weight="light" className="tqi-login-input-icon" />
                  <input
                    id="confirm-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    minLength={8}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrorMessage(null); }}
                    placeholder="Re-enter the same password"
                    className="tqi-login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="tqi-login-input-action"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} weight="light" /> : <Eye size={16} weight="light" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !passwordStrong(newPassword) || newPassword !== confirmPassword}
                className="tqi-login-primary"
              >
                {isLoading ? <TqiLoadingMark /> : null}
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

          <form onSubmit={handleSubmit} autoComplete="off">
            <div style={{ marginBottom: '0.85rem' }}>
              <label className="tqi-login-label" htmlFor="login-email">Work email</label>
              <div className="tqi-login-input-wrap">
                <Mail size={16} weight="light" className="tqi-login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="off"
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
                    autoComplete="new-password"
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
                      onClick={() => void handleLoginOtpResend()}
                      disabled={isLoading}
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cobalt)' }}
                    >
                      Resend code
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
                  {otpRequested ? 'If your account is registered, check your inbox. The code expires in 5 minutes.' : 'Tap "Send code" to receive a 6-digit OTP.'}
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
                  <TqiLoadingMark />
                  <span>Signing you in…</span>
                </>
              ) : (
                <>
                  <span>{activeMethod === 'otp' && !otpRequested ? 'Send code' : 'Sign in'}</span>
                  <ArrowRight size={16} weight="light" />
                </>
              )}
            </button>

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

            {forgotStep === 'complete' ? (
              <div style={{ paddingTop: '1rem', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--success-bg)', color: 'var(--success)' }}>
                  <CheckCircle2 size={28} weight="light" />
                </div>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>Password reset complete</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--login-muted)', marginTop: '0.25rem', lineHeight: 1.5 }}>{forgotNotice}</p>
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
                  {forgotStep === 'email'
                    ? 'Enter your registered work email. If an account exists, we will send a one-time code valid for 5 minutes.'
                    : `Enter the code sent to ${forgotEmail}, then choose a new password.`}
                </p>
                {forgotStep === 'email' ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label className="tqi-login-label" htmlFor="forgot-email">Work email</label>
                    <div className="tqi-login-input-wrap">
                      <Mail size={16} weight="light" className="tqi-login-input-icon" />
                      <input
                        id="forgot-email"
                        type="email"
                        required
                        autoFocus
                        value={forgotEmail}
                        onChange={(e) => { setForgotEmail(e.target.value); if (forgotError) setForgotError(null); }}
                        className="tqi-login-input"
                        placeholder="name@college.org"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label className="tqi-login-label" htmlFor="forgot-otp">6-digit verification code</label>
                      <input
                        id="forgot-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        required
                        value={forgotOtp}
                        onChange={(e) => { setForgotOtp(e.target.value.replace(/\D/g, '')); if (forgotError) setForgotError(null); }}
                        className="tqi-login-input tqi-num"
                        placeholder="000000"
                        style={{ textAlign: 'center', letterSpacing: '0.45em', fontWeight: 700 }}
                      />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label className="tqi-login-label" htmlFor="forgot-new-password">New password</label>
                      <input
                        id="forgot-new-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={forgotNewPassword}
                        onChange={(e) => { setForgotNewPassword(e.target.value); if (forgotError) setForgotError(null); }}
                        className="tqi-login-input"
                        placeholder="8+ characters with mixed characters"
                      />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label className="tqi-login-label" htmlFor="forgot-confirm-password">Confirm new password</label>
                      <input
                        id="forgot-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={forgotConfirmPassword}
                        onChange={(e) => { setForgotConfirmPassword(e.target.value); if (forgotError) setForgotError(null); }}
                        className="tqi-login-input"
                        placeholder="Re-enter your new password"
                      />
                    </div>
                  </>
                )}

                {forgotNotice && !forgotError && (
                  <div className="tqi-alert" style={{ marginBottom: '0.75rem' }}>
                    <span>{forgotNotice}</span>
                  </div>
                )}

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
                  {forgotStep === 'otp' && (
                    <button
                      type="button"
                      onClick={() => void handleForgotResend()}
                      disabled={forgotStatus === 'sending'}
                      className="tqi-btn-ghost tqi-touch"
                      style={{ height: 38, padding: '0 0.875rem' }}
                    >
                      Resend code
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={forgotStatus === 'sending'}
                    className="tqi-login-primary"
                    style={{ width: 'auto', height: 38, padding: '0 1.1rem', fontSize: '0.8125rem' }}
                  >
                    {forgotStatus === 'sending' ? (
                      <>
                        <TqiLoadingMark />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <span>{forgotStep === 'email' ? 'Send code' : 'Reset password'}</span>
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

function passwordStrong(value: string) {
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

