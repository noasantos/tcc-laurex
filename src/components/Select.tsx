import * as Primitive from "@radix-ui/react-select";
import {
  Children,
  isValidElement,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

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
      <Primitive.Root
        value={selected || emptyValue}
        onValueChange={(next) => {
          const result = next === emptyValue ? "" : next;
          setLocalValue(result);
          onValueChange?.(result);
        }}
        required={required}
        disabled={disabled}
      >
        <Primitive.Trigger
          {...triggerProps}
          className={"select-trigger " + className}
        >
          <Primitive.Value />
          <Primitive.Icon asChild>
            <ChevronDown />
          </Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            data-select-content=""
            className="select-content"
            position="popper"
            sideOffset={5}
            collisionPadding={10}
          >
            <Primitive.ScrollUpButton className="select-scroll">
              <ChevronUp />
            </Primitive.ScrollUpButton>
            <Primitive.Viewport className="select-viewport">
              <Primitive.Group>
                {options.map((option) => (
                  <Primitive.Item
                    key={option.value}
                    value={option.value || emptyValue}
                    disabled={option.disabled}
                    className="select-item"
                  >
                    <Primitive.ItemText>{option.label}</Primitive.ItemText>
                    <Primitive.ItemIndicator className="select-indicator">
                      <Check />
                    </Primitive.ItemIndicator>
                  </Primitive.Item>
                ))}
              </Primitive.Group>
            </Primitive.Viewport>
            <Primitive.ScrollDownButton className="select-scroll">
              <ChevronDown />
            </Primitive.ScrollDownButton>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </>
  );
}
