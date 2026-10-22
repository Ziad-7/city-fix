import { Icon } from '../Icon';

interface FieldBase {
  id: string;
  label: string;
  help?: string;
  error?: string;
  hideLabel?: boolean;
  disabled?: boolean;
}

export interface TextFieldProps extends FieldBase {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password' | 'date';
  placeholder?: string;
  autoComplete?: string;
  readOnly?: boolean;
  dir?: 'ltr' | 'rtl';
  required?: boolean;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  readOnly,
  dir,
  required,
  help,
  error,
  hideLabel,
  disabled,
}: TextFieldProps) {
  return (
    <div className={`ftc-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'ftc-label'}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        readOnly={readOnly}
        dir={dir}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-msg` : help ? `${id}-help` : undefined}
        className="ftc-input"
      />
      {error ? (
        <span className="ftc-error" id={`${id}-msg`} role="alert">
          <Icon name="alert-triangle" size={14} />
          {error}
        </span>
      ) : (
        help && <span className="ftc-help" id={`${id}-help`}>{help}</span>
      )}
    </div>
  );
}

export interface SelectFieldProps extends FieldBase {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  variant?: 'field' | 'pill';
  required?: boolean;
  readOnly?: boolean;
  dir?: 'ltr' | 'rtl';
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  variant = 'field',
  help,
  error,
  hideLabel,
  disabled,
  required,
  readOnly,
  dir,
}: SelectFieldProps) {
  if (variant === 'pill') {
    return (
      <>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readOnly}
          required={required}
          dir={dir}
          className="ftc-select"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      </>
    );
  }

  return (
    <div className={`ftc-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'ftc-label'}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || readOnly}
        required={required}
        dir={dir}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-msg` : help ? `${id}-help` : undefined}
        className="ftc-select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="ftc-error" id={`${id}-msg`} role="alert">
          <Icon name="alert-triangle" size={14} />
          {error}
        </span>
      ) : (
        help && <span className="ftc-help" id={`${id}-help`}>{help}</span>
      )}
    </div>
  );
}

export interface TextAreaProps extends FieldBase {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  maxLength,
  placeholder,
  help,
  error,
  hideLabel,
  disabled,
}: TextAreaProps) {
  return (
    <div className={`ftc-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'ftc-label'}>
        {label}
      </label>
      <div className="textarea-wrap">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-msg` : help ? `${id}-help` : undefined}
          className="ftc-textarea"
        />
        {maxLength && <span className="ftc-count num">{value.length} / {maxLength}</span>}
      </div>
      {error ? (
        <span className="ftc-error" id={`${id}-msg`} role="alert">
          <Icon name="alert-triangle" size={14} />
          {error}
        </span>
      ) : (
        help && <span className="ftc-help" id={`${id}-help`}>{help}</span>
      )}
    </div>
  );
}

export interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ id, label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label htmlFor={id} className="chk">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
