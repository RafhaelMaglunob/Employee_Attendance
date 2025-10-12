import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Employees from '../Employees';

jest.mock('../component/ui/button', () => ({
  Button: ({ children }) => <button>{children}</button>
}));
jest.mock('../component/ui/card', () => ({
  Card: ({ children }) => <div>{children}</div>
}));
jest.mock('../component/data/table', () => ({
  Table: () => <div>Mock Table</div>
}));
jest.mock('../component/ui/search', () => ({
  Search: ({ value, onChange }) => <input value={value} onChange={e => onChange(e.target.value)} />,
  Filter: () => <div>Mock Filter</div>
}));
jest.mock('../component/hooks/useFetchData', () => ({
  useFetchData: () => ({ data: [], loading: false })
}));

test('renders Employees component', () => {
  render(<Employees />);
  expect(screen.getByText('Employee Records')).toBeInTheDocument();
  expect(screen.getByText('+ Add Employee')).toBeInTheDocument();
  expect(screen.getByText('Mock Table')).toBeInTheDocument();
});
