import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../index.css';

export const metadata: Metadata = {
  title: 'Campus Ride Pooling | IIT Kanpur',
  description:
    'A CS455 Software Engineering course project for safer, simpler ride pooling within the IIT Kanpur community.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
