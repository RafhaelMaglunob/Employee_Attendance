import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';

// Mock Card component
jest.mock('../component/ui/card', () => ({
  Card: ({ children, title }) => (
    <div>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  )
}));

// Mock Table component with data-testid
jest.mock('../component/data/table', () => ({
  Table: ({ data }) => (
    <div data-testid="mock-table">
      {data.map((row, i) => (
        <div key={i} data-testid={`row-${i}`}>{row.type}</div>
      ))}
    </div>
  )
}));

test('renders Dashboard component', () => {
  render(<Dashboard />);

  // Main headings
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
  expect(screen.getByText('Welcome to the Employee Management System')).toBeInTheDocument();

  // Mocked Cards using role/heading
  expect(screen.getByRole('heading', { name: 'Attendance Summary' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pending Request' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Upcoming Schedules' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Recent Activities' })).toBeInTheDocument();

  // Mocked Table rows using data-testid
  expect(screen.getByTestId('row-0')).toHaveTextContent('Leave Request');
  expect(screen.getByTestId('row-1')).toHaveTextContent('Overtime');
  expect(screen.getByTestId('row-2')).toHaveTextContent('Schedule Change');
  expect(screen.getByTestId('row-3')).toHaveTextContent('Attendance');
});
