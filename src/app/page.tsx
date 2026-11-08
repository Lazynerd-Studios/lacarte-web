'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/app-providers';
import { Loader2 } from 'lucide-react';

export default function RootSplashPage() {
  const router = useRouter();
  const { status, needsLocation, needsSubscription } = useAuth();

  useEffect(() => {
    if (status === 'initial' || status === 'loading') return;

    if (status === 'authenticated') {
      if (needsLocation) {
        router.replace('/onboarding/location');
      } else if (needsSubscription) {
        router.replace('/subscription');
      } else {
        router.replace('/dashboard');
      }
    } else {
      router.replace('/sign-in');
    }
  }, [status, needsLocation, needsSubscription, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="LaCarte"
        className="w-52 h-auto object-contain mb-6"
      />
      <Loader2 className="w-8 h-8 animate-spin text-[#FFB400]" />
      <p className="text-xs text-[#6A7282] mt-3 font-medium">
        Loading your workspace...
      </p>
    </div>
  );
}

