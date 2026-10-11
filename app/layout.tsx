import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@/components/analytics';
import { measurementId } from '@/lib/analytics';
export const metadata: Metadata = {
  // English by default; components/academy.tsx swaps the title for Chinese readers.
  title: 'cswork · Learning workspace',
  description:
    'From Go backends to system design: learn, practice and get one-on-one feedback.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics id={measurementId(process.env.GA_MEASUREMENT_ID)} />
      </body>
    </html>
  );
}
