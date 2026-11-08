'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { AuthService } from '@/lib/services/api-services';
import { ApiException } from '@/lib/api-client';
import { useAuth, useFeedback } from '@/providers/app-providers';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const { setSessionDirect, refreshProfile } = useAuth();
  const { showToast } = useFeedback();

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();
    if (!trimmedEmail || trimmedOtp.length < 4) {
      setErrorMsg('Please enter your email and the verification code.');
      return;
    }

    setVerifying(true);
    try {
      const valid = await AuthService.checkOtp(trimmedEmail, trimmedOtp);
      if (!valid) {
        throw new Error('Invalid or expired verification code.');
      }
      const session = await AuthService.verifyEmail(trimmedEmail, trimmedOtp);

      if (session && session.token) {
        await setSessionDirect(session.token, session.user);
        showToast('Email verified! Welcome to LaCarte.', 'success');
        const profile = await refreshProfile();
        const customer = profile?.customer ?? null;
        if (!customer || !customer.hasLocation) {
          router.replace('/onboarding/location');
        } else {
          router.replace('/dashboard');
        }
      } else {
        showToast('Email verified! Please sign in to continue.', 'success');
        router.replace('/sign-in');
      }
    } catch (e) {
      setErrorMsg(e instanceof ApiException ? e.message : 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim() || cooldown > 0) return;
    setResending(true);
    setErrorMsg(null);
    try {
      await AuthService.sendOtp(email.trim());
      setCooldown(60);
      showToast('A new verification code has been sent to your email.', 'info');
    } catch (e) {
      setErrorMsg(e instanceof ApiException ? e.message : 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFA] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>

        <div className="w-12 h-12 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Enter the 6-digit verification code sent to{' '}
          <span className="font-semibold text-gray-800">{email || 'your email'}</span>.
        </p>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          {!emailParam && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Verification Code (OTP)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-center text-2xl font-bold tracking-[0.4em] text-gray-900 focus:outline-none focus:border-[#307224]"
            />
          </div>

          <button
            type="submit"
            disabled={verifying}
            className="w-full py-3.5 px-5 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Continue'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={resending || cooldown > 0}
            onClick={handleResend}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#307224] disabled:text-gray-400 hover:underline cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend verification code'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}

