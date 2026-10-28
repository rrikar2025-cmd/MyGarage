import { useId } from 'react';
import { useTheme, radius } from '@/shared/theme';
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  disabled?: boolean;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const id = useId();
  return (
    <fieldset
      aria-label={label}
      style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 4, minWidth: 0 }}
    >
      {options.map((option) => (
        <label
          key={option.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 50,
            padding: 14,
            borderRadius: radius.sm,
            color: colors.text,
            backgroundColor: value === option.value ? colors.inset : 'transparent',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 16,
            lineHeight: '24px',
            fontWeight: value === option.value ? 600 : 400,
          }}
        >
          {option.label}
          <input
            type="radio"
            name={id}
            value={option.value}
            disabled={disabled}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            style={{
              accentColor: colors.primary,
              width: 20,
              height: 20,
              margin: 0,
              flexShrink: 0,
              cursor: disabled ? 'default' : 'pointer',
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
