'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Lock,
  Building2,
  MapPin,
  Users,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { CustomerService, AuthService } from '@/lib/services/api-services';
import { CustomerType, Zone } from '@/types/models';
import { ApiException } from '@/lib/api-client';
import { useFeedback } from '@/providers/app-providers';

export default function SignUpPage() {
  const router = useRouter();
  const { showToast } = useFeedback();

  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customerTypeId, setCustomerTypeId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMetadata = async () => {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const [typesList, zonesList] = await Promise.all([
        CustomerService.getCustomerTypes(),
        CustomerService.getActiveZones(),
      ]);
      setCustomerTypes(typesList);
      setZones(zonesList);
      if (typesList.length > 0 && !customerTypeId) {
        setCustomerTypeId(typesList[0].id);
      }
      if (zonesList.length > 0 && !zoneId) {
        setZoneId(zonesList[0].id);
      }
    } catch (e) {
      setOptionsError(e instanceof ApiException ? e.message : 'Unable to load registration options.');
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  const selectedCustomerType = customerTypes.find((t) => t.id === customerTypeId);
  const requiresEntityName = Boolean(selectedCustomerType?.requiresEntityName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedEntity = entityName.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !customerTypeId || !zoneId) {
      setErrorMsg('Please fill out all required fields.');
      return;
    }
    if (requiresEntityName && !trimmedEntity) {
      setErrorMsg(`Please enter your ${selectedCustomerType?.name || 'organization'} name.`);
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await CustomerService.signUp({
        name: trimmedName,
        email: trimmedEmail,
        phoneNumber: trimmedPhone,
        password,
        zoneId,
        customerTypeId,
        // IMPORTANT: only pass entityName when requiresEntityName is true
        ...(requiresEntityName ? { entityName: trimmedEntity } : {}),
      });

      try {
        await AuthService.sendOtp(trimmedEmail);
      } catch {
        // Backend may have already sent the verification OTP during sign-up
      }

      showToast('Account created! Please enter the verification code sent to your email.', 'success');
      router.push(`/verify-otp?email=${encodeURIComponent(trimmedEmail)}`);
    } catch (e) {
      setErrorMsg(e instanceof ApiException ? e.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFA] p-4 sm:p-8">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src="/images/logo-icon.png" alt="LaCarte" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Create your LaCarte Account</h1>
              <p className="text-xs text-gray-500">Smart residential & commercial waste collection</p>
            </div>
          </div>
          <Link href="/sign-in" className="text-xs font-semibold text-[#307224] hover:underline">
            Sign in instead
          </Link>
        </div>

        {optionsError && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
            <span className="text-xs text-amber-800 font-medium">{optionsError}</span>
            <button
              type="button"
              onClick={loadMetadata}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kwame Mensah"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="024 123 4567"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Customer Category
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={customerTypeId}
                  onChange={(e) => setCustomerTypeId(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#307224]"
                >
                  {customerTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name} ({ct.isFullTruck ? 'Full Truck' : 'Per Bin'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Service Zone
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#307224]"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {requiresEntityName && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Organization / Business Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder={`Enter ${selectedCustomerType?.name || 'organization'} name`}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#307224]"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || loadingOptions}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

