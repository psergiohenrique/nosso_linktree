const STEPS = ["Seus dados", "Confirmar e-mail", "Criar sua página"];

/** Passo a passo do cadastro: dados → confirmação do e-mail → criação da página. `current` começa em 1. */
export default function SignupSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="steps" aria-label="Etapas do cadastro">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        return (
          <li key={label} className={`step step-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-dot">{state === "done" ? "✓" : n}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
