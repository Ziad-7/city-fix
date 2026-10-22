import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Drawer } from '../Drawer';
import { describe, it, expect, vi } from 'vitest';

describe('Drawer', () => {
  it('renders when open', () => {
    render(
      <Drawer
        open={true}
        onClose={() => {}}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <p>Drawer content</p>
        <button>Action</button>
      </Drawer>,
    );

    expect(screen.getByText('Drawer Title')).toBeInTheDocument();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Drawer
        open={false}
        onClose={() => {}}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <p>Drawer content</p>
      </Drawer>,
    );

    expect(document.body.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('has proper aria attributes', () => {
    render(
      <Drawer
        open={true}
        onClose={() => {}}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <p>Drawer content</p>
      </Drawer>,
    );

    const drawer = document.body.querySelector('[role="dialog"]');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveAttribute('aria-labelledby', 'drawer-title');
    expect(drawer).toHaveAttribute('aria-label', 'Test Drawer');
  });

  it('calls onClose when scrim is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Drawer
        open={true}
        onClose={onClose}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
      </Drawer>,
    );

    const scrim = document.body.querySelector('.ftc-scrim') as HTMLElement;
    fireEvent.click(scrim);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn();
    render(
      <Drawer
        open={true}
        onClose={onClose}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <button>Action</button>
      </Drawer>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('focus moves to first focusable element on open', () => {
    render(
      <Drawer
        open={true}
        onClose={() => {}}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <button>Action</button>
      </Drawer>,
    );

    const btn = screen.getByText('Action') as HTMLElement;
    expect(document.activeElement).toBe(btn);
  });

  it('tabs from last focusable to first', () => {
    render(
      <Drawer
        open={true}
        onClose={() => {}}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <button>First Button</button>
        <button>Last Button</button>
      </Drawer>,
    );

    const lastBtn = screen.getByText('Last Button') as HTMLElement;
    lastBtn.focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    const firstBtn = screen.getByText('First Button') as HTMLElement;
    expect(document.activeElement).toBe(firstBtn);
  });

  it('shift+tabs from first focusable to last', () => {
    render(
      <Drawer
        open={true}
        onClose={() => {}}
        titleId="drawer-title"
        ariaLabel="Test Drawer"
      >
        <h2 id="drawer-title">Drawer Title</h2>
        <button>First Button</button>
        <button>Last Button</button>
      </Drawer>,
    );

    const firstBtn = screen.getByText('First Button') as HTMLElement;
    firstBtn.focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    const lastBtn = screen.getByText('Last Button') as HTMLElement;
    expect(document.activeElement).toBe(lastBtn);
  });
});
