import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/dates/styles.css';

import { ColorSchemeScript, MantineProvider, mantineHtmlProps, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { FCMManager } from '@/components/notifications/FCMManager';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
    title: 'Workout Mate - 운동 메이트',
    description: '친구들과 함께하는 소셜 피트니스 플랫폼',
    manifest: '/manifest.json',
};

const theme = createTheme({
    primaryColor: 'blue',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headings: {
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
});

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" {...mantineHtmlProps}>
            <head>
                <ColorSchemeScript defaultColorScheme="auto" />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
            </head>
            <body>
                <MantineProvider theme={theme}>
                    <Notifications position="top-right" />
                    <FCMManager />
                    <InstallPrompt />
                    {children}
                    <Analytics />
                </MantineProvider>
            </body>
        </html>
    );
}
