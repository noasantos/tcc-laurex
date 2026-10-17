import * as RadioGroup from "@radix-ui/react-radio-group";
import { Sun, Moon, Monitor, Check } from "lucide-react";

function Preview({ dark = false }: { dark?: boolean }) {
  return (
    <span className={"theme-mini " + (dark ? "theme-mini-dark" : "")}>
      <span className="theme-mini-sidebar">
        <i />
        <i />
        <i />
      </span>
      <span className="theme-mini-main">
        <i />
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
export function Appearance({
  theme,
  onTheme,
}: {
  theme: string;
  onTheme: (theme: string) => void;
}) {
  return (
    <section
      className="appearance-section"
      aria-labelledby="appearance-heading"
    >
      <div className="appearance-heading">
        <h3 id="appearance-heading">Aparência</h3>
        <p>Escolha o ambiente mais confortável para sua leitura.</p>
      </div>
      <RadioGroup.Root
        className="theme-options"
        aria-label="Aparência"
        value={theme}
        onValueChange={onTheme}
        orientation="horizontal"
      >
        {[
          { value: "light", label: "Claro", Icon: Sun },
          { value: "dark", label: "Escuro", Icon: Moon },
          { value: "system", label: "Sistema", Icon: Monitor },
        ].map(({ value, label, Icon }) => (
          <RadioGroup.Item
            key={value}
            value={value}
            className="theme-option"
            aria-label={label}
          >
            <span
              className={
                "theme-preview " +
                (value === "system" ? "theme-preview-system" : "")
              }
              aria-hidden="true"
            >
              {value === "system" ? (
                <>
                  <Preview />
                  <Preview dark />
                </>
              ) : (
                <Preview dark={value === "dark"} />
              )}
            </span>
            <span className="theme-option-label">
              <Icon size={14} />
              <span>{label}</span>
              <span className="theme-option-check">
                <RadioGroup.Indicator>
                  <Check size={12} />
                </RadioGroup.Indicator>
              </span>
            </span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <p className="appearance-hint">
        {theme === "system"
          ? "Acompanha automaticamente a aparência do seu computador."
          : "Você também pode alternar pelo ícone no topo do workspace."}
      </p>
    </section>
  );
}
