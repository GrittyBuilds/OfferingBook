import { el, clear } from './util.js';

let escHandler = null;

function close() {
  const root = document.getElementById('modal-root');
  clear(root);
  root.classList.remove('open');
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
}

function openShell(title, contentNode, { wide = false } = {}) {
  const root = document.getElementById('modal-root');
  clear(root);
  const dialog = el('div', { class: `modal ${wide ? 'modal-wide' : ''}` },
    el('div', { class: 'modal-head' },
      el('h2', {}, title),
      el('button', { class: 'modal-close', onclick: close, title: 'Close' }, '✕')
    ),
    contentNode
  );
  root.appendChild(el('div', { class: 'modal-backdrop', onclick: (e) => {
    if (e.target === e.currentTarget) close();
  } }, dialog));
  root.classList.add('open');
  escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);
  return dialog;
}

export { close as closeModal };

/** Simple yes/no confirmation. Resolves true/false. */
export function confirmDialog(message, { danger = false, confirmLabel = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    const body = el('div', { class: 'modal-body' },
      el('p', { class: 'confirm-text' }, message),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-ghost', onclick: () => { close(); resolve(false); } }, 'Cancel'),
        el('button', {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          onclick: () => { close(); resolve(true); },
        }, confirmLabel)
      )
    );
    openShell(danger ? 'Please confirm' : 'Confirm', body);
  });
}

/**
 * Build a form modal from field descriptors.
 * fields: [{ name, label, type, options, required, help, placeholder, half, rows, min, step }]
 * type: text | textarea | number | money | date | email | tel | select
 * values: initial values keyed by field name (money fields expect a dollar string)
 * onSubmit(values) -> Promise; throw to show an inline error and keep the modal open.
 */
export function formModal({ title, fields, values = {}, submitLabel = 'Save', onSubmit, wide = false }) {
  const inputs = {};
  const errorBox = el('div', { class: 'form-error', style: 'display:none' });

  const rows = fields.map((f) => {
    let input;
    const common = {
      id: `f_${f.name}`,
      name: f.name,
      placeholder: f.placeholder || '',
    };
    if (f.type === 'textarea') {
      input = el('textarea', { ...common, rows: f.rows || 3 }, values[f.name] ?? '');
    } else if (f.type === 'select') {
      input = el('select', common,
        ...(f.options || []).map((o) => {
          const val = typeof o === 'object' ? o.value : o;
          const label = typeof o === 'object' ? o.label : o;
          return el('option', { value: val, selected: String(values[f.name] ?? '') === String(val) }, label);
        })
      );
    } else {
      const type = f.type === 'money' ? 'text' : (f.type || 'text');
      input = el('input', {
        ...common,
        type,
        value: values[f.name] ?? '',
        min: f.min,
        step: f.step,
        inputmode: f.type === 'money' || f.type === 'number' ? 'decimal' : undefined,
      });
      if (f.type === 'money') input.classList.add('money-input');
    }
    inputs[f.name] = input;

    return el('div', { class: `form-row ${f.half ? 'half' : ''}` },
      el('label', { for: `f_${f.name}` }, f.label, f.required ? el('span', { class: 'req' }, ' *') : null),
      f.type === 'money'
        ? el('div', { class: 'money-wrap' }, el('span', { class: 'money-prefix' }, '$'), input)
        : input,
      f.help ? el('div', { class: 'field-help' }, f.help) : null
    );
  });

  const submitBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel);

  const form = el('form', {
    class: 'modal-body form-grid',
    onsubmit: async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      const collected = {};
      for (const f of fields) {
        let v = inputs[f.name].value;
        if (typeof v === 'string') v = v.trim();
        collected[f.name] = v === '' ? null : v;
      }
      // Required check
      const missing = fields.find((f) => f.required && !collected[f.name]);
      if (missing) {
        errorBox.textContent = `${missing.label} is required.`;
        errorBox.style.display = 'block';
        inputs[missing.name].focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      try {
        await onSubmit(collected);
        close();
      } catch (err) {
        errorBox.textContent = err.message || 'Something went wrong.';
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
    },
  },
    ...rows,
    errorBox,
    el('div', { class: 'modal-actions' },
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: close }, 'Cancel'),
      submitBtn
    )
  );

  openShell(title, form, { wide });
  const first = fields[0] && inputs[fields[0].name];
  if (first) setTimeout(() => first.focus(), 50);
}
