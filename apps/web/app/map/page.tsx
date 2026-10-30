import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import MapView from '../../components/MapView';

export default async function MapPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <p><Link href="/sign-in">Sign in</Link> to view the map.</p>
      </main>
    );
  }
  return <MapView />;
}
