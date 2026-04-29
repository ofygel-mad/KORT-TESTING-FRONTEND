import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchableSelect } from './SearchableSelect';

describe('SearchableSelect', () => {
  it('commits the highlighted option with keyboard navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        ariaLabel="Товар"
        options={['Чапан deluxe', 'Чапан classic']}
        value=""
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText('Товар');
    await user.click(input);
    await user.type(input, 'Чап');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('Чапан deluxe');
    expect(input).toHaveValue('Чапан deluxe');
  });
});
