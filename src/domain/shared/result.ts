/** Explicit success/failure value, so domain rules never throw for expected outcomes. */
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export type DomainErrorCode =
  | 'invalid-amount'
  | 'not-enough-coins'
  | 'item-not-owned'
  | 'item-already-owned'
  | 'mission-already-finished'
  | 'not-found';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export const domainError = (code: DomainErrorCode, message: string): DomainError => ({
  code,
  message,
});
