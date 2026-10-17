import {
  Select as SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "./ui/select";
import { cn } from "cn";
import {
  Children,
  isValidElement,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";

type OptionProps = { value?: string; disabled?: boolean; children: ReactNode };
// Declarative options are consumed by Select; the native system menu is never rendered.
export function SelectOption(_props: OptionProps) {
  return null;
}
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? text(child.props.children)
          : "",
    )
    .join("");
}
const emptyValue = "__laura_empty_option__";
type Props = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "id"
  | "className"
  | "aria-label"
  | "aria-labelledby"
  | "disabled"
  | "autoFocus"
> & {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
};
export function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  disabled,
  className = "",
  ...triggerProps
}: Props) {
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map((child) => ({
      value: child.props.value ?? text(child.props.children),
      label: text(child.props.children),
      disabled: child.props.disabled,
    }));
  const [localValue, setLocalValue] = useState(
    defaultValue ?? options[0]?.value ?? "",
  );
  const selected =
    value ??
    (options.some((option) => option.value === localValue)
      ? localValue
      : (options[0]?.value ?? ""));
  return (
    <>
      {name && (
        <input type="hidden" name={name} value={selected} disabled={disabled} />
      )}
      <SelectRoot
        value={selected || emptyValue}
        onValueChange={(next) => {
          const result = next === emptyValue ? "" : next;
          setLocalValue(result);
          onValueChange?.(result);
        }}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          {...triggerProps}
          size="sm"
          className={cn(
            "select-trigger min-w-0 [.field_&]:w-full [.context-panel_&]:w-full",
            className,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          data-select-content=""
          position="popper"
          align="start"
          collisionPadding={10}
        >
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value || emptyValue}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </SelectRoot>
    </>
  );
}
