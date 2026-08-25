import React, { useState } from 'react';
import { UserRole } from '../types';
import { apiUrl } from '../utils/api';

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


export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'otp' | 'password'>('otp');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) { setErrorMessage('Please enter your email address.'); return; }
    if (activeMethod === 'password' && !cleanPass) { setErrorMessage('Please enter your password.'); return; }
    if (activeMethod === 'otp' && otpRequested && !otp.trim()) { setErrorMessage('Please enter the verification code.'); return; }

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
        setErrorMessage(data?.error || 'Unable to sign in. Please check your credentials and try again.');
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
        designation: user.role === 'Super Admin' ? 'Super Admin' : 'Cluster Admin (College SPOC)',
        avatarText: (user.name || 'U').split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase(),
        mustChangePassword: Boolean(data.mustChangePassword || user.mustChangePassword),
      };

      if (session.mustChangePassword) setPendingSession(session);
      else onLoginSuccess(session);
      setIsLoading(false);
    } catch {
      setErrorMessage('Unable to connect to the backend. Please try again.');
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
    } catch { setErrorMessage('Unable to connect to the backend. Please try again.'); }
    setIsLoading(false);
  };

  // Shared brand panel (left side on desktop)
  const BrandPanel = (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-500 p-12 text-white lg:flex">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 opacity-90" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-theme-xs">
          <img src="/logo.png" alt="TQI Logo" className="h-8 w-8 object-contain" />
        </div>
        <div className="leading-tight">
          <div className="text-base font-bold">Talent Quest for India</div>
          <div className="text-xs uppercase tracking-widest text-white/70">Academic ERP System</div>
        </div>
      </div>

      <div className="relative max-w-md space-y-4">
        <h2 className="text-title-md font-bold leading-tight tracking-tight">
          Rural education operations, run from one place.
        </h2>
        <p className="text-sm leading-relaxed text-white/80">
          Attendance cycles, volunteer rosters, finance verification, and governance approvals &mdash; unified across every cluster and panchayat.
        </p>
        <div className="pt-4 flex items-center gap-3 text-xs font-semibold text-white/90">
          <span className="tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full">connect</span>
          <span className="tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full">explore</span>
          <span className="tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full">share</span>
          <span className="tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full">lead</span>
        </div>
      </div>

      <div className="relative text-xs text-white/60">
        &copy; 2026 Talent Quest for India Trust. All rights reserved.
      </div>
    </div>
  );

  if (pendingSession) {
    return (
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 font-outfit">
        {BrandPanel}
        <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex flex-col items-center text-center">
              <img src="/logo.png" alt="TQI Logo" className="mb-4 h-14 w-14 object-contain lg:hidden" />
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400 mb-3">
                First-time onboarding
              </span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Set your new password</h1>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Welcome, <strong className="text-gray-800 dark:text-white">{pendingSession.name}</strong>. Replace your temporary credentials with a secure personal password.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-xl border border-error-200 bg-error-50 p-3 text-xs text-error-600 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-400">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  New password (8+ characters) *
                </label>
                <input
                  aria-label="New password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setErrorMessage(null); }}
                  placeholder="Enter a strong password"
                  className="tqi-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Confirm new password *
                </label>
                <input
                  aria-label="Confirm password"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrorMessage(null); }}
                  placeholder="Re-enter new password"
                  className="tqi-input"
                />
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs font-medium text-error-600 dark:text-error-400">Passwords do not match.</p>
              )}

              <button
                type="submit"
                disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full tqi-btn-primary py-3"
              >
                {isLoading ? 'Saving password...' : 'Save password & enter ERP'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingSession(null);
                  setPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setErrorMessage(null);
                }}
                className="w-full py-1 text-center text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                Cancel & return to sign-in
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 font-outfit">
      {BrandPanel}

      <main className="flex flex-1 flex-col justify-center p-6 sm:p-10">
        <header className="flex h-16 items-center justify-between px-6 lg:hidden mb-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="TQI Logo" className="h-9 w-9 object-contain" />
            <span className="text-base font-bold text-gray-900 dark:text-white">Talent Quest for India</span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 text-center">
            <h1 className="text-title-sm font-bold text-gray-900 dark:text-white">Sign In</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Secure access to the TQI Academic ERP</p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="mb-6 grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => { setActiveMethod('otp'); setOtpRequested(false); setOtp(''); setErrorMessage(null); }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                activeMethod === 'otp'
                  ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-gray-900 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => { setActiveMethod('password'); setOtpRequested(false); setOtp(''); setErrorMessage(null); }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                activeMethod === 'password'
                  ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-gray-900 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Password
            </button>
          </div>

          {errorMessage && (
            <div className="mb-5 rounded-xl border border-error-200 bg-error-50 p-3.5 text-xs font-medium text-error-600 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-400">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5" htmlFor="login-email">
                Registered email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setErrorMessage(null); }}
                placeholder="you@organisation.org"
                className="tqi-input"
              />
            </div>

            {activeMethod === 'password' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5" htmlFor="login-password">
                  Account password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMessage(null); }}
                    placeholder="Enter your password"
                    className="tqi-input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="text-xs font-semibold">{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
              </div>
            )}

            {activeMethod === 'otp' && otpRequested && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" htmlFor="login-otp">
                    Email verification code
                  </label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-500 hover:underline dark:text-brand-400"
                    onClick={() => { setOtpRequested(false); setOtp(''); setErrorMessage(null); }}
                  >
                    Send again
                  </button>
                </div>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setErrorMessage(null); }}
                  placeholder="000000"
                  className="tqi-input text-center tracking-[0.5em] font-bold text-lg"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">The code expires in 10 minutes.</p>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <span>Remember this device</span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full tqi-btn-primary py-3 text-sm font-semibold"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                activeMethod === 'password' ? 'Sign in with password' : (otpRequested ? 'Verify and sign in' : 'Send verification code')
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            Authorised TQI personnel only. Backend RBAC protects every module.
          </p>
        </div>
      </main>
    </div>
  );
};
