import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { FeedView } from './feed-view';

export const metadata = { title: 'Feed' };
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <FeedView currentUserId={session.sub} />;
}
