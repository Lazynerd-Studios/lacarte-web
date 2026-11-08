'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthService } from '@/lib/services/api-services';
import { useAuth, useFeedback } from '@/providers/app-providers';
import { ApiException } from '@/lib/api-client';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { profile, refreshProfile, setSessionDirect } = useAuth();
  const { showToast } = useFeedback();

  const [newEmail, setNewEmail] = useState(
    typeof profile?.user?.email === 'string' ? profile.user.email : '',
  );
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    try {
      await AuthService.changeEmail(newEmail.trim());
      await refreshProfile();
      showToast('Email update requested! Check your inbox if verification is required.', 'success');
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to change email.', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const current = currentPassword.trim();
    const next = newPassword.trim();

    if (!current) {
      showToast('Please enter your current password', 'warning');
      return;
    }
    if (!next) {
      showToast('Please enter a new password', 'warning');
      return;
    }
    // Same password policy as sign-up: 8-128 characters.
    if (next.length < 8) {
      showToast('New password must be at least 8 characters', 'warning');
      return;
    }
    if (next.length > 128) {
      showToast('New password must be at most 128 characters', 'warning');
      return;
    }
    if (current === next) {
      showToast('New password must be different from current password', 'warning');
      return;
    }
    if (next !== confirmPassword) {
      showToast('New passwords do not match.', 'warning');
      return;
    }
    setSavingPassword(true);
    try {
      // The server rotates the token: the session continues on it, the user
      // is NOT signed out.
      const session = await AuthService.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions,
      });
      await setSessionDirect(session.token, session.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully!', 'success');
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to change password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Account Security</h1>
          <p className="text-xs text-gray-500">Manage your sign-in email and password</p>
        </div>
      </div>

      {/* Change Email */}
      <form
        onSubmit={handleUpdateEmail}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4"
      >
        <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#307224]" /> Email Address
        </h2>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
            New Email Address
          </label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={savingEmail}
          className="px-5 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Email'}
        </button>
      </form>

      {/* Change Password */}
      <form
        onSubmit={handleUpdatePassword}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4"
      >
        <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#307224]" /> Change Password
        </h2>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
            />
          </div>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={revokeOtherSessions}
            onChange={(e) => setRevokeOtherSessions(e.target.checked)}
            className="w-4 h-4 accent-[#307224]"
          />
          <span className="text-xs font-semibold text-gray-700">
            Sign out from all other devices
          </span>
        </label>
        <button
          type="submit"
          disabled={savingPassword}
          className="px-5 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          {savingPassword ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Update Password
            </>
          )}
        </button>
      </form>
    </div>
  );
}

