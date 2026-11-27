'use client';

import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { Download, Moon, Sun } from 'lucide-react';
import { useId } from 'react';

const appearances = [{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }];

export function AppearanceControl({ label, appearance, onChange, disabled, compact = false }) {
  const id = useId();
  return (
    <fieldset className={compact ? 'mode-control mode-compact' : 'mode-control'} disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {appearances.map(({ value, label: mode, Icon }) => (
        <label key={value} title={compact ? mode + ' site appearance' : undefined}>
          <input
            type="radio"
            name={id}
            value={value}
            aria-label={compact ? mode + ' site appearance' : undefined}
            checked={appearance === value}
            onChange={() => onChange(value)}
          />
          <span><Icon size={15} aria-hidden="true" />{!compact && mode}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function DownloadAction({ href, disabled, form }) {
  const content = <><Download size={16} aria-hidden="true" /> Download JSON</>;
  return href ? (
    <a className="download" href={href} download>{content}</a>
  ) : (
    <button className="download" type="submit" form={form} disabled={disabled}>{content}</button>
  );
}

export function RangeField({ name, label, value, onChange, disabled, min = 0, max = 100, unit = '%' }) {
  const id = useId();
  return (
    <div className="range-field">
      <span id={id}>{label}</span>
      <output aria-hidden="true">{value}{unit}</output>
      <Slider.Root className="range" min={min} max={max} value={[value]} disabled={disabled} onValueChange={([next]) => onChange(name, next)}>
        <Slider.Track className="range-track"><Slider.Range className="range-fill" /></Slider.Track>
        <Slider.Thumb className="range-thumb" aria-labelledby={id} aria-valuetext={value + unit} />
      </Slider.Root>
    </div>
  );
}

export function SwitchField({ label, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="switch-field">
      <label htmlFor={id}>{label}</label>
      <Switch.Root className="switch" id={id} checked={checked} onCheckedChange={onChange} disabled={disabled}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}
