'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Button, Input, Typography, Layout, Space, Alert, Divider, Spin, Modal } from 'antd';
import { LogoutOutlined, ExclamationCircleFilled } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Content, Header } = Layout;
const { confirm } = Modal;

// Define a type for our Shift data for better type safety
type Shift = {
  id: string;
  clockIn: string;
  clockInNote?: string;
};

export default function DashboardPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [note, setNote] = useState('');
  const [apiMessage, setApiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  // This function fetches the current shift status from our GraphQL query
  const fetchShiftStatus = async () => {
    setIsStatusLoading(true);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query MyCurrentShift { myCurrentShift { id, clockIn, clockInNote } }`,
        }),
      });
      const result = await response.json();
      if (result.data?.myCurrentShift) {
        setActiveShift(result.data.myCurrentShift);
      } else {
        setActiveShift(null);
      }
    } catch (error) {
      console.error("Failed to fetch shift status", error);
    } finally {
      setIsStatusLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchShiftStatus();
    }
  }, [user]);

  const handleClockIn = async () => {
    setIsSubmitting(true);
    setApiMessage(null);

    // 1. Get location from the browser
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // 2. Send location to the backend API
        try {
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `mutation ClockIn($note: String, $lat: Float, $lon: Float) { 
                clockIn(note: $note, latitude: $lat, longitude: $lon) { 
                  id, clockIn 
                } 
              }`,
              variables: { 
                note,
                lat: latitude,
                lon: longitude,
              },
            }),
          });
          const result = await response.json();
          if (result.errors) throw new Error(result.errors[0].message);
          
          setApiMessage({ type: 'success', text: `Successfully clocked in!` });
          setNote('');
          fetchShiftStatus(); // Refresh status after clocking in
        } catch (error: any) {
          setApiMessage({ type: 'error', text: `Error: ${error.message}` });
        } finally {
          setIsSubmitting(false);
        }
      },
      // 3. Handle errors if the user denies location permission
      (error) => {
        setApiMessage({ type: 'error', text: `Location Error: ${error.message}` });
        setIsSubmitting(false);
      }
    );
  };

  const handleClockOut = async () => {
    if (!activeShift) return;
    setIsSubmitting(true);
    setApiMessage(null);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation ClockOut($shiftId: String!, $note: String) { clockOut(shiftId: $shiftId, note: $note) { id } }`,
          variables: { shiftId: activeShift.id, note },
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      setApiMessage({ type: 'success', text: `Successfully clocked out!` });
      setNote('');
      fetchShiftStatus(); // Refresh status after clocking out
    } catch (error: any) {
      setApiMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const showLogoutConfirm = () => {
    confirm({
      title: 'Are you sure you want to log out?',
      icon: <ExclamationCircleFilled />,
      content: 'You will be returned to the homepage.',
      okText: 'Yes, Log Out',
      okType: 'danger',
      cancelText: 'No',
      onOk() {
        window.location.href = '/api/auth/logout';
      },
    });
  };
  
  if (isUserLoading) return <div style={{ padding: '20px', textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <Layout style={{ minHeight: '100vh', background: 'rgba(0, 175, 170, 1)' }}>
      <Header style={{ background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={4} style={{ margin: 0 }}>Lief Shift Tracker</Title>
        {user && (
          <Button icon={<LogoutOutlined />} onClick={showLogoutConfirm}>
            Log Out
          </Button>
        )}
      </Header>
      <Content style={{ padding: '40px' }}>
        <div style={{ background: '#fafafa', padding: '24px', borderRadius: '8px', maxWidth: '600px', margin: '0 auto', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)' }}>
          <Title level={2}>Care Worker Dashboard</Title>
          {user ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>Welcome, {user.name}!</Text>
              <Divider />

            {isStatusLoading ? <div style={{ textAlign: 'center', padding: '50px' }}><Spin /></div> : (
              <>
                {activeShift ? (
                  // ---- CLOCKED IN VIEW ----
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert 
                      message={`You are currently clocked in. Started at ${new Date(activeShift.clockIn).toLocaleTimeString()}`}
                      type="info"
                      showIcon
                    />
                    <Title level={4}>End Your Shift</Title>
                    <Input.TextArea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional: Add a clock-out note..."
                      rows={4}
                      disabled={isSubmitting}
                    />
                    <Button type="primary" danger onClick={handleClockOut} loading={isSubmitting}>
                      Clock Out
                    </Button>
                  </Space>
                ) : (
                  // ---- CLOCKED OUT VIEW ----
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={4}>Start Your Shift</Title>
                    <Input.TextArea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional: Add a clock-in note..."
                      rows={4}
                      disabled={isSubmitting}
                    />
                    <Button type="primary" onClick={handleClockIn} loading={isSubmitting}>
                      Clock In
                    </Button>
                  </Space>
                )}
              </>
            )}

            {apiMessage && (
              <Alert 
                message={apiMessage.text} 
                type={apiMessage.type} 
                showIcon 
                closable
                onClose={() => setApiMessage(null)}
                style={{ marginTop: '20px' }}
              />
            )}
          </Space>
        ) : (
          <Alert message="Please log in to view your dashboard." type="warning" />
        )}
        </div>
      </Content>
    </Layout>
  );
}