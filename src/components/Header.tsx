'use client';

import React from 'react';
import { Layout, Button, Typography } from 'antd';
import Link from 'next/link';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

export default function Header() {
  return (
    <AntHeader
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
        <Title level={3} style={{ color: '#1890ff', margin: 0 }}>
          Lief Shift Tracker
        </Title>
      </Link>
      <a href="/api/auth/logout">
        <Button>Log Out</Button>
      </a>
    </AntHeader>
  );
}