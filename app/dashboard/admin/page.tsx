'use client';

import { Container, Title, Tabs, Paper, Text } from '@mantine/core';
import { IconChartBar, IconUsers, IconBuildingCommunity } from '@tabler/icons-react';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminGroups } from '@/components/admin/AdminGroups';

export default function AdminPage() {
    return (
        <Container size="xl">
            <Title order={2} mb="lg">관리자 대시보드</Title>

            <Tabs defaultValue="stats" variant="outline" radius="md">
                <Tabs.List mb="md">
                    <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>
                        시스템 현황
                    </Tabs.Tab>
                    <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
                        사용자 관리
                    </Tabs.Tab>
                    <Tabs.Tab value="groups" leftSection={<IconBuildingCommunity size={16} />}>
                        크루 관리
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="stats">
                    <AdminStats />
                </Tabs.Panel>

                <Tabs.Panel value="users">
                    <AdminUsers />
                </Tabs.Panel>

                <Tabs.Panel value="groups">
                    <AdminGroups />
                </Tabs.Panel>
            </Tabs>
        </Container>
    );
}
