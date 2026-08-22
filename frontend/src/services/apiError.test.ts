import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from './apiError';

function axiosLike(status: number, data: unknown) {
  return { response: { status, data }, message: 'Request failed' };
}

describe('apiErrorMessage', () => {
  it('uses the server detail when it is a plain string', () => {
    const err = axiosLike(400, { detail: 'Passing percentage must be between 1 and 100.' });
    expect(apiErrorMessage(err, 'fallback')).toBe('Passing percentage must be between 1 and 100.');
  });

  it('reads a FastAPI validation array instead of handing React an object', () => {
    // The bug this replaced: `detail || fallback` passed this array straight
    // into component state, and React threw rendering it -- a blank screen
    // instead of the reason the save was rejected.
    const err = axiosLike(422, {
      detail: [
        { loc: ['body', 'default_passing_percentage'], msg: 'Input should be less than or equal to 100', type: 'less_than_equal' },
        { loc: ['body', 'daily_practice_goal'], msg: 'Input should be greater than 0', type: 'greater_than' },
      ],
    });

    const message = apiErrorMessage(err, 'fallback');
    expect(message).toContain('default_passing_percentage: Input should be less than or equal to 100');
    expect(message).toContain('daily_practice_goal: Input should be greater than 0');
    expect(message).not.toContain('[object Object]');
  });

  it('says the server is unreachable when the request never got a response', () => {
    // Every one of these used to fall through to a generic fallback that
    // blamed the action rather than the connection.
    const message = apiErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' }, 'Failed to save.');
    expect(message).toMatch(/could not reach/i);
    expect(message).toMatch(/backend is running/i);
  });

  it('reads a structured detail that carries its own message', () => {
    // The import validators raise this shape so they can attach a row number.
    const err = axiosLike(400, { detail: { message: 'Row 12: missing a title.', row: 12 } });
    expect(apiErrorMessage(err, 'fallback')).toBe('Row 12: missing a title.');
  });

  it('falls back when the server responded but said nothing usable', () => {
    expect(apiErrorMessage(axiosLike(500, {}), 'Failed to delete.')).toBe('Failed to delete.');
    expect(apiErrorMessage(axiosLike(500, { detail: '   ' }), 'Failed to delete.')).toBe('Failed to delete.');
    expect(apiErrorMessage(axiosLike(500, { detail: [] }), 'Failed to delete.')).toBe('Failed to delete.');
  });

  it('survives things that are not errors at all', () => {
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(apiErrorMessage('a string', 'fallback')).toBe('fallback');
  });

  it('drops a bare "body" location rather than prefixing a field name with it', () => {
    const err = axiosLike(422, { detail: [{ loc: ['body'], msg: 'Field required' }] });
    expect(apiErrorMessage(err, 'fallback')).toBe('Field required');
  });
});
