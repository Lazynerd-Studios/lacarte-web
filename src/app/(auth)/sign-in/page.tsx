'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, ShieldCheck, Truck, MapPin } from 'lucide-react';
import { useAuth, useFeedback } from '@/providers/app-providers';
import { ApiException } from '@/lib/api-client';
import { AuthService } from '@/lib/services/api-services';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { showToast, showStatusModal } = useFeedback();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signIn(trimmedEmail, password);
      showToast('Signed in successfully!', 'success');

      // Derive onboarding flags from the freshly returned profile (landing order
      // mirrors auth_provider.dart: location -> subscription -> payment -> dashboard).
      const customer = profile?.customer ?? null;
      const paymentPlan = customer?.subscriptionInfo.paymentPlan;
      const needsLocation = Boolean(customer && !customer.hasLocation);
      const needsSubscription = Boolean(
        customer && paymentPlan !== 'pay_as_you_go' && !customer.hasSubscription,
      );
      const subscription = customer?.subscriptionInfo.subscription;
      const payment = subscription?.payment as Record<string, unknown> | undefined;
      const needsPayment = Boolean(
        customer &&
          paymentPlan !== 'pay_as_you_go' &&
          subscription &&
          payment?.paidAt == null,
      );

      if (needsLocation) {
        router.replace('/onboarding/location');
      } else if (needsSubscription) {
        router.replace('/subscription');
      } else {
        if (needsPayment) {
          showToast('Your subscription payment is pending. Please check your phone or retry payment.', 'warning');
        }
        router.replace('/dashboard');
      }
    } catch (e) {
      if (e instanceof ApiException) {
        if (e.code === 'EMAIL_NOT_VERIFIED' || e.message.toLowerCase().includes('not verified')) {
          showToast('Please verify your email address first.', 'info');
          try {
            await AuthService.sendOtp(trimmedEmail);
          } catch {
            // ignore sendOtp failure if already sent
          }
          router.push(`/verify-otp?email=${encodeURIComponent(trimmedEmail)}`);
          return;
        }
        if (e.code === 'USER_BANNED' || e.message.toLowerCase().includes('banned')) {
          showStatusModal({
            type: 'error',
            title: 'Account Restricted',
            message: e.message || 'Your account has been suspended. Please contact LaCarte customer support for assistance.',
          });
          setLoading(false);
          return;
        }
        setErrorMsg(e.message);
      } else {
        setErrorMsg('Unable to sign in. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAFBFA]">
      {/* Left Brand Hero (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1B4332] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <img src="/images/logo-icon.png" alt="LaCarte" className="w-10 h-10 rounded-xl bg-white p-1.5 object-contain" />
          <span className="text-xl font-bold tracking-tight">LaCarte Waste & Eco Store</span>
        </div>

        <div className="relative z-10 max-w-lg my-auto py-12">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold tracking-wide uppercase mb-6">
            <ShieldCheck className="w-4 h-4" /> Smart Waste Management
          </span>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Cleaner neighborhoods, effortless pickups & real-time tracking.
          </h1>
          <p className="text-emerald-100/80 text-base leading-relaxed mb-8">
            Schedule residential or commercial waste collection, watch your collection truck arrive live on the map, manage per-bin or full-truck subscriptions, and shop eco-friendly waste bins.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Truck className="w-6 h-6 text-emerald-300 mb-2" />
              <div className="font-bold text-sm">Live Truck Tracking</div>
              <div className="text-xs text-emerald-100/75 mt-1">Real-time GPS updates & accurate arrival ETAs.</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <MapPin className="w-6 h-6 text-emerald-300 mb-2" />
              <div className="font-bold text-sm">Flexible Plans</div>
              <div className="text-xs text-emerald-100/75 mt-1">Pay-As-You-Go, Prepaid, or Postpaid subscriptions.</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-emerald-200/60">
          © {new Date().getFullYear()} LaCarte Waste Management. All rights reserved.
        </div>
      </div>

      {/* Right Sign-In Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/images/logo-icon.png" alt="LaCarte" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-none">LaCarte</h2>
              <p className="text-xs text-gray-500 mt-0.5">Customer Portal</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            Sign in to manage your pickups, subscriptions, and orders.
          </p>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224] focus:ring-2 focus:ring-[#307224]/15 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/reset-password"
                  className="text-xs font-semibold text-[#307224] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224] focus:ring-2 focus:ring-[#307224]/15 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Don&apos;t have an account yet?{' '}
            <Link href="/sign-up" className="font-semibold text-[#307224] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

