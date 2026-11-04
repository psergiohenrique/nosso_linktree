"use client";

import { useActionState, useState } from "react";
import { saveForm } from "@/app/dashboard/formularios/actions";
import FormRunner from "@/components/FormRunner";
import { blankField, FIELD_LIMITS, FIELD_TYPES, FIELD_TYPE_LABELS, type FieldType, type FormField } from "@/lib/form-fields";

type Props = {
  id: string; name: string; title: string; slug: string; intro: string; thankYou: string;
  isPublished: boolean; notifyEmail: boolean; fields: FormField[];
};

export default function FormBuilder({ id, fields: initialFields, ...form }: Props) {
  const [fields, setFields] = useState(initialFields);
  const [details, setDetails] = useState(form);
  const setDetail = (key: keyof typeof details, value: string | boolean) => setDetails((current) => ({ ...current, [key]: value }));
  const [state, action, pending] = useActionState(saveForm.bind(null, id), {});
  const update = (index: number, changes: Partial<FormField>) =>
    setFields((current) => current.map((field, i) => i === index ? { ...field, ...changes } : field));
  const move = (index: number, direction: number) => setFields((current) => {
    const next = [...current];
    const target = index + direction;
    if (target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return (
    <>
    <form action={action}>
      <section className="card stat-card">
        <h2 className="card-title">Informações</h2>
        <p><label className="field-label" htmlFor="form-name">Nome interno</label><input className="field" id="form-name" name="name" value={details.name} onChange={(e) => setDetail("name", e.target.value)} maxLength={FIELD_LIMITS.name} required /></p>
        <p><label className="field-label" htmlFor="form-title">Título público</label><input className="field" id="form-title" name="title" value={details.title} onChange={(e) => setDetail("title", e.target.value)} maxLength={FIELD_LIMITS.title} required /></p>
        <p><label className="field-label" htmlFor="form-slug">Endereço do formulário</label><input className="field" id="form-slug" name="slug" value={details.slug} onChange={(e) => setDetail("slug", e.target.value)} maxLength={40} required /></p>
        <p><label className="field-label" htmlFor="form-intro">Texto de apresentação</label><textarea className="field" id="form-intro" name="intro" value={details.intro} onChange={(e) => setDetail("intro", e.target.value)} maxLength={FIELD_LIMITS.intro} /></p>
        <p><label className="field-label" htmlFor="form-thanks">Mensagem de agradecimento</label><textarea className="field" id="form-thanks" name="thankYou" value={details.thankYou} onChange={(e) => setDetail("thankYou", e.target.value)} maxLength={FIELD_LIMITS.thankYou} /></p>
      </section>
      <h2 className="card-title">Perguntas</h2>
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      {fields.map((field, index) => (
        <section className="card stat-card" key={field.id}>
          <h3 className="card-title">Pergunta {index + 1}</h3>
          <p><label className="field-label" htmlFor={`${field.id}-type`}>Tipo</label><select className="field" id={`${field.id}-type`} value={field.type} onChange={(e) => {
            const type = e.target.value as FieldType;
            update(index, { type, options: type === "radio" || type === "checkbox" ? (field.options.length ? field.options : ["Opção 1", "Opção 2"]) : [], allowOther: false });
          }}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>)}</select></p>
          <p><label className="field-label" htmlFor={`${field.id}-label`}>Pergunta</label><input className="field" id={`${field.id}-label`} value={field.label} maxLength={FIELD_LIMITS.label} required onChange={(e) => update(index, { label: e.target.value })} /></p>
          <p><label className="field-label" htmlFor={`${field.id}-description`}>Descrição (opcional)</label><input className="field" id={`${field.id}-description`} value={field.description} maxLength={FIELD_LIMITS.description} onChange={(e) => update(index, { description: e.target.value })} /></p>
          {(field.type === "radio" || field.type === "checkbox") && <>
            <p><label className="field-label" htmlFor={`${field.id}-options`}>Opções (uma por linha)</label><textarea className="field" id={`${field.id}-options`} value={field.options.join("\n")} onChange={(e) => update(index, { options: e.target.value.split("\n") })} /></p>
            <p><label><input type="checkbox" checked={field.allowOther} onChange={(e) => update(index, { allowOther: e.target.checked })} /> Permitir outra resposta</label></p>
          </>}
          <p><label><input type="checkbox" checked={field.required} onChange={(e) => update(index, { required: e.target.checked })} /> Obrigatória</label></p>
          <div className="dash-head-actions">
            <button className="btn btn-outline btn-sm" type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑ Subir</button>
            <button className="btn btn-outline btn-sm" type="button" disabled={index === fields.length - 1} onClick={() => move(index, 1)}>↓ Descer</button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setFields(fields.filter((_, i) => i !== index))}>Remover</button>
          </div>
        </section>
      ))}
      <p><button className="btn btn-outline btn-sm" type="button" disabled={fields.length >= FIELD_LIMITS.fields} onClick={() => setFields([...fields, blankField()])}>Adicionar pergunta</button></p>
      <section className="card stat-card">
        <p><label><input type="checkbox" name="isPublished" checked={details.isPublished} onChange={(e) => setDetail("isPublished", e.target.checked)} /> Publicar formulário</label></p>
        <p><label><input type="checkbox" name="notifyEmail" checked={details.notifyEmail} onChange={(e) => setDetail("notifyEmail", e.target.checked)} /> Receber aviso por e-mail quando houver resposta completa</label></p>
        {state.error && <p className="notice" role="alert">{state.error}</p>}
        {state.saved && <p className="notice notice-ok" role="status">Formulário salvo.</p>}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Salvando..." : "Salvar formulário"}</button>
      </section>
    </form>
    <section className="card stat-card">
      <h2 className="card-title">Prévia</h2>
      <p className="hint">Experimente as alterações atuais. Nenhuma resposta será salva ou enviada.</p>
      {fields.length ? <FormRunner formId={id} title={details.title} intro={details.intro} thankYou={details.thankYou} fields={fields} preview /> : <p>Adicione uma pergunta para ver a prévia.</p>}
    </section>
    </>
  );
}
