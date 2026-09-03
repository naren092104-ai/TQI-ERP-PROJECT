import React, { useId } from 'react';
import { AlertCircle, CheckCircle2 } from './icons';

type FieldState = 'default' | 'error' | 'success';

interface BaseFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
}

interface InputFieldProps
  extends BaseFieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leadingIcon?: React.ReactNode;
  trailingAction?: React.ReactNode;
}

interface TextAreaFieldProps
  extends BaseFieldProps,
    React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

interface SelectFieldProps
  extends BaseFieldProps,
    React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

const stateClass = (state: FieldState) => {
  if (state === 'error') return 'is-error';
  return '';
};

const FieldShell: React.FC<
  BaseFieldProps & { id: string; state: FieldState; children: React.ReactNode }
> = ({ id, label, hint, error, success, required, optional, state, children }) => (
  <div className="tqi-field">
    {label && (
      <label className="tqi-field-label" htmlFor={id}>
        {label}
        {required && <span className="tqi-required">*</span>}
        {optional && (
          <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--text-placeholder)', fontWeight: 500 }}>
            optional
          </span>
        )}
      </label>
    )}
    {children}
    {state === 'error' && error && (
      <span className="tqi-field-error" role="alert">
        <AlertCircle className="h-3 w-3" />
        {error}
      </span>
    )}
    {state === 'success' && success && (
      <span className="tqi-field-error" style={{ color: 'var(--success)' }} role="status">
        <CheckCircle2 className="h-3 w-3" />
        {success}
      </span>
    )}
    {state === 'default' && hint && <span className="tqi-field-hint">{hint}</span>}
  </div>
);

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    { label, hint, error, success, required, optional, disabled, className, leadingIcon, trailingAction, id, ...rest },
    ref
  ) => {
    const auto = useId();
    const fieldId = id ?? `tqi-in-${auto}`;
    const state: FieldState = error ? 'error' : success ? 'success' : 'default';

    return (
      <FieldShell
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        success={success}
        required={required}
        optional={optional}
        state={state}
      >
        <div className={`tqi-input-with-icon ${trailingAction ? 'tqi-input-with-action' : ''}`}>
          {leadingIcon && <span className="tqi-input-icon">{leadingIcon}</span>}
          <input
            ref={ref}
            id={fieldId}
            disabled={disabled}
            className={`tqi-input-premium ${stateClass(state)} ${className ?? ''}`}
            {...rest}
          />
          {trailingAction && <span className="tqi-input-action">{trailingAction}</span>}
        </div>
      </FieldShell>
    );
  }
);
InputField.displayName = 'InputField';

export const TextAreaField = React.forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, hint, error, success, required, optional, className, id, ...rest }, ref) => {
    const auto = useId();
    const fieldId = id ?? `tqi-ta-${auto}`;
    const state: FieldState = error ? 'error' : success ? 'success' : 'default';

    return (
      <FieldShell
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        success={success}
        required={required}
        optional={optional}
        state={state}
      >
        <textarea
          ref={ref}
          id={fieldId}
          className={`tqi-input-premium tqi-textarea-premium ${stateClass(state)} ${className ?? ''}`}
          {...rest}
        />
      </FieldShell>
    );
  }
);
TextAreaField.displayName = 'TextAreaField';

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    { label, hint, error, success, required, optional, options, placeholder, className, id, ...rest },
    ref
  ) => {
    const auto = useId();
    const fieldId = id ?? `tqi-sl-${auto}`;
    const state: FieldState = error ? 'error' : success ? 'success' : 'default';

    return (
      <FieldShell
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        success={success}
        required={required}
        optional={optional}
        state={state}
      >
        <div className="tqi-input-with-icon" style={{ position: 'relative' }}>
          <select
            ref={ref}
            id={fieldId}
            className={`tqi-input-premium tqi-select-premium ${stateClass(state)} ${className ?? ''}`}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            <path d="M5 8l5 5 5-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </FieldShell>
    );
  }
);
SelectField.displayName = 'SelectField';
