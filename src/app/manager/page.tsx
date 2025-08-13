'use client';

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/components/AppProvider';
import { Button, Form, Input, InputNumber, Typography, Layout, Space, Alert, Spin, Table, Divider, Row, Col, Statistic, Modal } from 'antd';
import { LogoutOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title as ChartTitle, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ChartTitle, Tooltip, Legend);

const { Title } = Typography;
const { Content, Header } = Layout;
const { confirm } = Modal;

// Define TypeScript interfaces for our data shapes for type safety
interface User {
  id: string;
  email: string;
  role: string;
}
interface Shift {
  id: string;
  clockIn: string;
  clockOut?: string;
  clockInNote?: string;
  clockOutNote?: string;
}
interface DashboardStats {
  dailyStats: { date: string; avgHours: number; clockInCount: number }[];
  staffWeeklyHours: { email: string; totalHours: number }[];
}

export default function ManagerPage() {
  const { user, isLoading: isUserLoading } = useAppContext();
  const [form] = Form.useForm();
  const [apiMessage, setApiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeStaff, setActiveStaff] = useState<User[]>([]); 
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

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

  // Fetch all necessary data for the manager dashboard in one go
  const fetchData = async () => {
    setIsDataLoading(true);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query ManagerDashboardData { 
            organizationUsers { id, email, role }
            activeStaff { id, email, role }
            dashboardStats {
              dailyStats { date, avgHours, clockInCount }
              staffWeeklyHours { email, totalHours }
            }
          }` 
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      setUsers(result.data.organizationUsers);
      setActiveStaff(result.data.activeStaff); // Set the new state
      setStats(result.data.dashboardStats);
    } catch (error: any) {
      setApiMessage({ type: 'error', text: `Failed to load dashboard data: ${error.message}` });
    } finally {
      setIsDataLoading(false);
    }
  };

  // Fetch shifts for a specific user when one is selected
  const fetchShifts = async (userId: string) => {
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query UserShifts($userId: String!) { userShifts(userId: $userId) { id, clockIn, clockOut, clockInNote, clockOutNote } }`,
          variables: { userId },
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      setShifts(result.data.userShifts);
    } catch (error: any) {
      setApiMessage({ type: 'error', text: `Failed to load shifts: ${error.message}` });
    }
  };

  // Helper function to parse different coordinate formats into decimal degrees
const parseCoordinates = (coordString: string): { latitude: number; longitude: number } | null => {
  coordString = coordString.trim();
  // Match format like "17.5868, 78.0736"
  let match = coordString.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (match) {
    return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
  }
  // Match format like "17°35'12.7"N 78°04'25.0"E"
  match = coordString.match(/(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)"\s*([NS])\s*(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)"\s*([EW])/i);
  if (match) {
    const latDeg = parseInt(match[1], 10);
    const latMin = parseInt(match[2], 10);
    const latSec = parseFloat(match[3]);
    const latDir = match[4].toUpperCase();
    let latitude = latDeg + (latMin / 60) + (latSec / 3600);
    if (latDir === 'S') latitude *= -1;

    const lonDeg = parseInt(match[5], 10);
    const lonMin = parseInt(match[6], 10);
    const lonSec = parseFloat(match[7]);
    const lonDir = match[8].toUpperCase();
    let longitude = lonDeg + (lonMin / 60) + (lonSec / 3600);
    if (lonDir === 'W') longitude *= -1;
    
    return { latitude, longitude };
  }
  return null;
};

  // Handle saving the organization's location settings
  // Updated save location handler
const handleSaveLocation = async (values: { coordinates: string; perimeterRadius: number; }) => {
  // We no longer need the apiMessage state for this form
  // setApiMessage(null); 
  const parsed = parseCoordinates(values.coordinates);

  if (!parsed) {
    Modal.error({
        title: 'Invalid Format',
        content: 'The coordinate format is invalid. Please use "lat, lon" or DMS format.',
    });
    return;
  }

  try {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation UpdateOrg($lat: Float!, $lon: Float!, $rad: Float!) { updateOrganizationLocation(latitude: $lat, longitude: $lon, perimeterRadius: $rad) { id } }`,
        variables: {
          lat: parsed.latitude,
          lon: parsed.longitude,
          rad: values.perimeterRadius,
        },
      }),
    });
    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    
    // This is the new success dialog box
    Modal.success({
      title: 'Settings Updated Successfully',
      content: `The organization's location has been saved. New coordinates: Latitude ${parsed.latitude.toFixed(4)}, Longitude ${parsed.longitude.toFixed(4)}.`,
    });

  } catch (error: any) {
    // This is the new error dialog box
    Modal.error({
      title: 'Update Failed',
      content: `An error occurred: ${error.message}`,
    });
  }
};

  // This is the corrected useEffect hook
  useEffect(() => {
    // Only fetch data if the user has loaded and is a manager
    if (user && user.role === 'MANAGER') {
      fetchData();
    }
  // The dependency array now uses stable values
  }, [user]);

  const activeStaffColumns: TableProps<User>['columns'] = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
  ];
  // Define columns for the users table
  const userColumns: TableProps<User>['columns'] = [
  { title: 'Email', dataIndex: 'email', key: 'email', fixed: 'left', width: 250 },
  { title: 'Role', dataIndex: 'role', key: 'role', width: 150 },
  { title: 'Action', key: 'action', render: (_, record) => (<Button onClick={() => { setSelectedUser(record); fetchShifts(record.id); }}>View Shifts</Button>), fixed: 'right', width: 120 },
];

  // Define columns for the shifts table
  const shiftColumns: TableProps<Shift>['columns'] = [
  { title: 'Clock In', dataIndex: 'clockIn', key: 'clockIn', render: (text) => new Date(text).toLocaleString(), width: 200 },
  { title: 'Clock Out', dataIndex: 'clockOut', key: 'clockOut', render: (text) => text ? new Date(text).toLocaleString() : 'Active', width: 200 },
  { title: 'Clock-In Note', dataIndex: 'clockInNote', key: 'clockInNote', width: 250 },
  { title: 'Clock-Out Note', dataIndex: 'clockOutNote', key: 'clockOutNote', width: 250 },
];

  // Configure the data for the bar chart
  const chartData = {
    labels: stats?.staffWeeklyHours.map(s => s.email) || [],
    datasets: [
      {
        label: 'Total Hours Clocked (Last 7 Days)',
        data: stats?.staffWeeklyHours.map(s => s.totalHours) || [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
    ],
  };

  const barChartData = {
    labels: stats?.staffWeeklyHours.map(s => s.email) || [],
    datasets: [ { label: 'Total Hours Clocked (Last 7 Days)', data: stats?.staffWeeklyHours.map(s => s.totalHours) || [], backgroundColor: 'rgba(54, 162, 235, 0.6)' } ],
  };

  const lineChartData = {
    labels: stats?.dailyStats.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })) || [],
    datasets: [
      {
        label: 'Daily Clock-Ins (Last 7 Days)',
        data: stats?.dailyStats.map(d => d.clockInCount) || [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  if (isUserLoading || (user && isDataLoading)) return <div style={{ padding: '20px', textAlign: 'center' }}><Spin size="large" /></div>;
  
  // We need to check the role from the user object provided by our API, not Auth0's
  // @ts-ignore
  if (user && user.role !== 'MANAGER') return <Layout style={{ padding: '40px' }}><Alert message="Access Denied" /></Layout>;

  // Show a loading spinner while the manager-specific data is being fetched
   if (!user && !isUserLoading) return <Layout style={{ padding: '40px' }}><Alert message="Please log in to continue." type="info" /></Layout>;

  return (
  <Layout style={{ minHeight: '100vh', background: 'rgba(29, 147, 141, 1)' }}>
    <Header style={{ background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
      <Title level={4} style={{ margin: 0 }}>Manager Dashboard</Title>
      {user && (
        <Button icon={<LogoutOutlined />} onClick={showLogoutConfirm}>
          Log Out
        </Button>
      )}
    </Header>
    <Content style={{ padding: '40px' }}>
      <div style={{ background: '#fafafa', padding: '24px', borderRadius: '8px', maxWidth: '1200px', margin: '0 auto', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)' }}>
        <Title level={2}>Manager Dashboard</Title>
        {user ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {apiMessage && <Alert message={apiMessage.text} type={apiMessage.type} showIcon closable onClose={() => setApiMessage(null)} />}
            
            <Title level={4}>Weekly Analytics</Title>
            <Row gutter={[16, 24]}>
              <Col xs={24} lg={12}>
                <Title level={5} style={{textAlign: 'center'}}>Daily Clock-In Trends</Title>
                <Line data={lineChartData} options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      ticks: {
                        stepSize: 1, // This forces the steps to be whole numbers
                        precision: 0 // This ensures no decimal points are shown
                      },
                      beginAtZero: true
                    }
                  }
                }} />
              </Col>
              <Col xs={24} lg={12}>
                <Title level={5} style={{textAlign: 'center'}}>Total Hours per Staff</Title>
                <Bar data={barChartData} options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      ticks: {
                        stepSize: 1, // This forces the steps to be whole numbers
                        precision: 0 // This ensures no decimal points are shown
                      },
                      beginAtZero: true
                    }
                  }
                }} />
              </Col>
            </Row>

            <Divider />

            <Title level={4}>Currently Clocked-In Staff</Title>
            <Table columns={activeStaffColumns} dataSource={activeStaff} rowKey="id" />
            
            <Divider />
            
            <Title level={4}>All Staff & Shift History</Title>
            <Table columns={userColumns} dataSource={users} rowKey="id" />

            {selectedUser && (
              <>
                <Divider />
                <Title level={4}>Shift History for {selectedUser.email}</Title>
                <Table columns={shiftColumns} dataSource={shifts} rowKey="id" />
              </>
            )}

            <Divider />

            <Title level={4}>Organization Settings</Title>
            <Form form={form} layout="vertical" onFinish={handleSaveLocation} initialValues={{ perimeterRadius: 2 }}>
              <Form.Item
                name="coordinates"
                label="Center Coordinates"
                rules={[{ required: true, message: 'Please input coordinates!' }]}
                // The paragraph is now passed as the 'extra' prop
                extra="Enter coordinates in decimal format (latitude, longitude) or Degrees-Minutes-Seconds (DMS) format."
              >
                <Input placeholder="e.g., 17.5868, 78.0736 or 17°35'12.7 N 78°04'25.0 E" />
              </Form.Item>
              <Form.Item name="perimeterRadius" label="Perimeter Radius (in km)" rules={[{ required: true, message: 'Please input a radius!' }]}>
                <InputNumber style={{ width: '100%' }} min={0.1} />
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit">Save Settings</Button></Form.Item>
            </Form>
          </Space>
        ) : (
          <Alert message="Please log in to continue." type="info" />
        )}
      </div>
    </Content>
  </Layout>
);
}
