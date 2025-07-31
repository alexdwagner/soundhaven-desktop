import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Simple Test', () => {
  it('should render a simple component', () => {
    const TestComponent = () => <div>Hello Test</div>;
    const { getByText } = render(<TestComponent />);
    expect(getByText('Hello Test')).toBeInTheDocument();
  });

  it('should perform basic math', () => {
    expect(1 + 1).toBe(2);
  });
});