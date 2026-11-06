import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FormRunner from "@/components/FormRunner";
import { blankField, type FormField } from "@/lib/form-fields";

const field: FormField = {
  ...blankField(),
  id: "nome",
  label: "Como você se chama?",
  description: "Informe seu nome completo.",
  required: true,
};

function render(fields: FormField[]) {
  return renderToStaticMarkup(
    <FormRunner formId="preview" title="Agende uma conversa" intro="Conte um pouco sobre você." thankYou="Obrigado!" fields={fields} preview />,
  );
}

describe("prévia do formulário", () => {
  it("mantém o título abaixo do cabeçalho da prévia e identifica a pergunta", () => {
    const html = render([field, { ...field, id: "email", type: "email" }]);
    expect(html).toContain('<h3 class="bf-title">Agende uma conversa</h3>');
    expect(html).not.toContain("<h1");
    expect(html).toContain("Pergunta 1 de 2");
    expect(html).toContain("(obrigatória)");
    expect(html).toContain("Continuar</button>");
  });

  it("associa a descrição ao campo e diferencia a ação de envio", () => {
    const html = render([field]);
    expect(html).toContain('id="nome-hint"');
    expect(html).toContain('aria-describedby="nome-hint"');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain("Enviar respostas</button>");
    expect(html).not.toContain('class="bf-privacy"');
  });
});
