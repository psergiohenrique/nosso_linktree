const STEPS = ["Seus dados", "Confirmar e-mail", "Criar sua página"];

/** Passo a passo do cadastro: dados → confirmação do e-mail → criação da página. `current` começa em 1. */
export default function SignupSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="signup-steps" aria-label="Etapas do cadastro">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        return (
          <li key={label} className={`signup-step signup-step-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="signup-step-dot">{state === "done" ? "✓" : n}</span>
            <span className="signup-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
