import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';
import { useUIStore } from '@/stores/uiStore';

// Mock the zustand store
jest.mock('@/stores/uiStore');

const mockUseUIStore = useUIStore as jest.Mock;

describe('ThemeToggle', () => {
  it('should render the correct icon for the current theme and cycle themes on click', () => {
    const setTheme = jest.fn();

    // --- Test 1: Initial state is 'light' ---
    mockUseUIStore.mockReturnValue({ theme: 'light', setTheme });

    const { rerender } = render(<ThemeToggle />);

    // The button's title attribute is descriptive
    expect(screen.getByTitle('Switch to Dark theme')).toBeInTheDocument();

    // Simulate a click
    fireEvent.click(screen.getByRole('button'));

    // Check if setTheme was called with 'dark'
    expect(setTheme).toHaveBeenCalledWith('dark');

    // --- Test 2: Rerender with 'dark' theme ---
    mockUseUIStore.mockReturnValue({ theme: 'dark', setTheme });
    rerender(<ThemeToggle />);

    // Check for MoonIcon
    expect(screen.getByTitle('Switch to System theme')).toBeInTheDocument();

    // Simulate a click
    fireEvent.click(screen.getByRole('button'));

    // Check if setTheme was called with 'system'
    expect(setTheme).toHaveBeenCalledWith('system');

    // --- Test 3: Rerender with 'system' theme ---
    mockUseUIStore.mockReturnValue({ theme: 'system', setTheme });
    rerender(<ThemeToggle />);

    // Check for ComputerDesktopIcon
    expect(screen.getByTitle('Switch to Light theme')).toBeInTheDocument();

    // Simulate a click
    fireEvent.click(screen.getByRole('button'));

    // Check if setTheme was called with 'light'
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
