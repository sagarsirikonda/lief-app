'use client';

import { useAppContext } from '@/components/AppProvider';
import { Button, Typography, Space, Spin, Modal } from 'antd';
import { LogoutOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Paragraph } = Typography;
const { confirm } = Modal;

export default function HomePage() {
  const { user, isLoading } = useAppContext();

  const getDashboardLink = () => {
    if (user && user.role === 'MANAGER') {
      return '/manager';
    }
    return '/dashboard';
  };

  // Function to show the logout confirmation modal
  const showLogoutConfirm = () => {
    confirm({
      title: 'Are you sure you want to log out?',
      icon: <ExclamationCircleFilled />,
      okText: 'Yes, Log Out',
      okType: 'danger',
      cancelText: 'No',
      onOk() {
        window.location.href = '/api/auth/logout';
      },
    });
  };

  return (
    // This parent div now uses flexbox to center its child
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#f0f2f5',
      backgroundImage: 'radial-gradient(circle,rgba(0, 175, 170, 1) 29%, rgba(29, 147, 141, 1) 84%)',
      backgroundAttachment: 'fixed',
      padding: '20px', // Adjusted padding for mobile
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        maxWidth: '600px',
        width: '100%', // Ensure it takes up available width on small screens
        textAlign: 'center'
      }}>
        <Space direction="vertical" size="large">
          <img
            src="https://home.lief.care/wp-content/uploads/2023/05/lief-main-logo.svg"
            alt="Lief Care"
            style={{ 
              width: '72px', 
              height: '72px', 
              margin: '0 auto'
            }}
          />

          <Title>Lief Shift Tracker</Title>
          <Paragraph>Welcome to the simple and efficient way to track your work shifts.</Paragraph>

          {isLoading && <Spin />}

          {!isLoading && !user && (
            <Button type="primary" size="large" href="/api/auth/login">
              Log In or Sign Up
            </Button>
          )}

          {!isLoading && user && (
            <Space>
              <Link href={getDashboardLink()}>
                <Button type="primary" size="large">
                  Go to Your Dashboard
                </Button>
              </Link>
              <Button size="large" icon={<LogoutOutlined />} onClick={showLogoutConfirm}>
                Log Out
              </Button>
            </Space>
          )}
        </Space>
      </div>
    </div>
  );
}