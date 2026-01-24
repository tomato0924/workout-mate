'use client';

import { Container, Stack, Tabs, Title, Group, Text } from '@mantine/core';
import { IconChartBar, IconList } from '@tabler/icons-react';
import { MyWorkoutTab } from '@/components/dashboard/MyWorkoutTab';
import { FeedTab } from '@/components/dashboard/FeedTab';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'my_workout');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (value: string | null) => {
        if (value) {
            setActiveTab(value);
            router.push(`/dashboard?tab=${value}`, { scroll: false });
        }
    };

    return (
        <Container size="md">
            <Stack>
                <Title order={2}>운동 피드</Title>


                <Tabs value={activeTab} onChange={handleTabChange} keepMounted={false}>
                    <Tabs.List>
                        <Tabs.Tab value="my_workout" leftSection={<IconChartBar size={16} />}>
                            내 운동
                        </Tabs.Tab>
                        <Tabs.Tab value="feed" leftSection={<IconList size={16} />}>
                            전체 운동 피드
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="my_workout">
                        <MyWorkoutTab />
                    </Tabs.Panel>

                    <Tabs.Panel value="feed">
                        <FeedTab />
                    </Tabs.Panel>
                </Tabs>
            </Stack>
        </Container>
    );
}
