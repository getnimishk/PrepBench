// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * One place that turns a failed request into a sentence a person can read.
 *
 * This existed 44 times, hand-written, across 19 files, as some spelling of
 * `err?.response?.data?.detail || 'Something failed.'`. Two problems with that
 * ladder, beyond the copying:
 *
 * 1. FastAPI does not always put a string in `detail`. A 422 -- any request
 *    that fails schema validation -- returns an *array* of error objects. An
 *    array is truthy, so it went straight into component state and React threw
 *    "Objects are not valid as a React child" while rendering it. The user got
 *    a blank screen instead of "passing percentage must be between 1 and 100".
 *
 * 2. A network failure has no `response` at all, so every one of them fell
 *    through to the generic fallback and said nothing useful about the server
 *    being unreachable.
 */

interface ValidationItem {
  msg?: unknown;
  loc?: unknown[];
}

interface ErrorShape {
  response?: { data?: { detail?: unknown }; status?: number };
  request?: unknown;
  isAxiosError?: boolean;
  code?: string;
  message?: string;
}

/**
 * Whether this is a request that failed, as opposed to any other thrown value.
 *
 * Needed because "has no .response" is true of absolutely everything that is
 * not an axios error -- a string, a plain object, a TypeError from our own
 * code -- and reporting all of those as "the server is unreachable" would be a
 * confident lie about something we did not check.
 */
function isRequestFailure(error: ErrorShape | undefined): boolean {
  if (!error || typeof error !== 'object') return false;
  return error.isAxiosError === true || Boolean(error.code) || 'request' in error;
}

/**
 * Pydantic prefixes anything raised from a custom validator, so a message
 * written to be read by a person arrives as "Value error, Say what you would
 * ask." The prefix is an implementation detail of the validation library and
 * means nothing to the user, so it is dropped.
 */
const PYDANTIC_PREFIX = /^(value error|assertion failed|type error),\s*/i;

/** Turn one FastAPI validation entry into "field: message". */
function formatValidationItem(item: ValidationItem): string | null {
  if (typeof item?.msg !== 'string') return null;

  // loc is like ["body", "default_passing_percentage"]; the last entry is the
  // field, and "body" alone carries no information worth showing.
  const location = Array.isArray(item.loc) ? item.loc.filter((p) => typeof p === 'string') : [];
  const field = location.length > 1 ? String(location[location.length - 1]) : null;

  const message = item.msg.replace(PYDANTIC_PREFIX, '');
  if (!message.trim()) return null;

  return field ? `${field}: ${message}` : message;
}

/**
 * The message to show for a failed request.
 *
 * `fallback` is used whenever the server did not say anything more specific --
 * always pass one that makes sense for the action being attempted.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const error = (typeof err === 'object' && err !== null ? err : undefined) as ErrorShape | undefined;
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => formatValidationItem(item as ValidationItem))
      .filter((m): m is string => Boolean(m));
    if (messages.length) return messages.join('; ');
  }

  // Some endpoints raise with a structured detail carrying its own message --
  // the import validators do this so they can attach a row number alongside.
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }

  // No response at all means the request never landed -- the backend being
  // down is by far the most common cause, and it is worth saying so rather
  // than blaming whatever the user just clicked.
  if (!error?.response && isRequestFailure(error)) {
    return 'Could not reach the PrepBench server. Check that the backend is running, then try again.';
  }

  return fallback;
}
