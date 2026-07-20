import type { JSX } from "react";
import { Button } from "../ui";
import { Check, Plus, Trash2 } from "lucide-react";

/**
 * V100 Issue #39: Button presets catalog.
 *
 * Visual reference showing every Button variant × size combination so
 * designers/devs can see the design language at a glance. Used by:
 * - Devs looking for the right button for a context
 * - QA verifying all variants render correctly
 * - Designers proposing new variants (add to Button.tsx first, then here)
 *
 * Like IconCatalog, this is a dev reference — NOT user-facing.
 */

const VARIANTS = ["primary", "accent", "ghost", "outline"] as const;
const SIZES = ["sm", "md", "lg"] as const;

const VARIANT_DESCRIPTIONS: Record<string, string> = {
  primary: "Solid pitch-green — default action (confirm, save, submit)",
  accent: "Solid brass — secondary CTA (highlight, feature)",
  ghost: "Transparent — tertiary actions (cancel, dismiss)",
  outline: "Bordered — neutral actions (filter, toggle)",
};

const SIZE_DESCRIPTIONS: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs — inline / table rows",
  md: "px-5 py-2.5 text-sm — default / most contexts",
  lg: "px-7 py-3.5 text-base — hero / modal primary",
};

export default function ButtonPresetsCatalog(): JSX.Element {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-heading text-2xl font-bold uppercase tracking-wider text-accent-500">
          Button Presets Catalog
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          {VARIANTS.length} variants × {SIZES.length} sizes = {VARIANTS.length * SIZES.length} combinations.
          Plus icon-left / icon-right / disabled states.
        </p>
      </header>

      <section>
        <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-[0.22em] text-ink-faint">
          Variant × Size matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-slate-line">
            <thead>
              <tr className="bg-carbon-2">
                <th className="border-b border-slate-line px-3 py-2 text-left text-[10px] font-heading font-bold uppercase tracking-wider text-ink-faint">
                  Variant
                </th>
                {SIZES.map((size) => (
                  <th
                    key={size}
                    className="border-b border-l border-slate-line px-3 py-2 text-left text-[10px] font-heading font-bold uppercase tracking-wider text-ink-faint"
                  >
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((variant) => (
                <tr key={variant}>
                  <td className="border-b border-slate-line px-3 py-3 align-top">
                    <div className="font-heading text-xs font-bold uppercase tracking-wider text-ink">
                      {variant}
                    </div>
                    <p className="mt-0.5 text-[10px] text-ink-faint">
                      {VARIANT_DESCRIPTIONS[variant]}
                    </p>
                  </td>
                  {SIZES.map((size) => (
                    <td
                      key={size}
                      className="border-b border-l border-slate-line px-3 py-3"
                    >
                      <Button variant={variant} size={size}>
                        {variant}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-[0.22em] text-ink-faint">
          With icons
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon={<Plus />}>
            Add Player
          </Button>
          <Button variant="accent" icon={<Check />}>
            Confirm
          </Button>
          <Button variant="outline" iconRight={<Trash2 />}>
            Delete
          </Button>
          <Button variant="ghost" icon={<Plus />} size="sm">
            Quick Add
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-[0.22em] text-ink-faint">
          Disabled state
        </h3>
        <div className="flex flex-wrap gap-3">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {variant} (disabled)
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-[0.22em] text-ink-faint">
          Size reference
        </h3>
        <div className="space-y-2">
          {SIZES.map((size) => (
            <div key={size} className="flex items-center gap-3">
              <span className="w-32 text-[10px] font-heading font-bold uppercase tracking-wider text-ink-faint">
                {size}
              </span>
              <Button variant="primary" size={size}>
                {size} button
              </Button>
              <span className="text-[10px] text-ink-faint">
                {SIZE_DESCRIPTIONS[size]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-line pt-4 text-[10px] text-ink-faint">
        <p>
          All buttons: font-heading, bold, uppercase, tracking-wider,
          rounded-lg, focus:ring-2. Add new variants to{" "}
          <code className="rounded bg-carbon-2 px-1">
            src/components/ui/Button.tsx
          </code>{" "}
          and register here.
        </p>
      </footer>
    </div>
  );
}
