'use client';

import { use } from 'react';
import CabinetEventWorkspaceView from '@/components/cabinet/events/CabinetEventWorkspaceView';

export default function CabinetEventEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <CabinetEventWorkspaceView slug={slug} />;
}
