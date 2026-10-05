// Personal técnico y tarifas de hora hombre (por persona, con historial de vigencia).
// Información sensible: solo la ve quien tiene mantenimiento.costos.ver (el servidor no envía tarifas a nadie más).
import { staff, rates, labor } from '../services/operations.js';
import * as catalogs from '../services/catalogs.js';
import { PERSON_FORM, RATE_FORM } from '../domain/schema.js';
import { esc, dataTable, badge, fmtMoney, fmtNumber } from './components.js';
import { openForm } from './form.js';
import { perms, changeState } from './actions.js';
import { personOptions } from './options.js';
import { toast } from '../../ui.js';

const today = () => new Date().toISOString().slice(0, 10);
const currentRate = id => rates.active().filter(r => r.ID_PERSONA === id && String(r.VIGENTE_DESDE).slice(0, 10) <= today()).sort((a, b) => String(b.VIGENTE_DESDE).localeCompare(String(a.VIGENTE_DESDE)))[0];

export function staffPanel(user) {
  const p = perms(user);
  const people = staff.all();
  return `<div class="panel" data-staff><div class="mt-panel-head"><div><h3>Personal y tarifas de hora hombre</h3><div class="metric-note">Las horas hombre de cada OT se valoran con la tarifa vigente de la persona en la fecha del trabajo. Cambiar una tarifa no altera costos pasados.</div></div>
    <div class="toolbar">${p.configCostos ? '<button class="btn btn-secondary btn-sm" data-add-person>+ Persona</button><button class="btn btn-secondary btn-sm" data-add-rate>+ Tarifa</button>' : ''}</div></div>
    ${dataTable(people, [
      { label: 'Nombre', html: x => `<b>${esc(x.NOMBRE)}</b><div class="metric-note">${esc(x.CARGO || '')}</div>` },
      { label: 'Tipo', html: x => esc(catalogs.label('TIPO_PERSONAL', x.TIPO_PERSONAL)) },
      ...(p.verCostos ? [{ label: 'Tarifa vigente', html: x => { const r = currentRate(x.ID_PERSONA); return r ? `${esc(fmtMoney(r.VALOR_HORA))}/h<div class="metric-note">desde ${esc(String(r.VIGENTE_DESDE).slice(0, 10))}</div>` : '<span class="status warn">sin tarifa</span>'; } },
        { label: 'Historial', html: x => esc(rates.active().filter(r => r.ID_PERSONA === x.ID_PERSONA).length + ' tarifa(s)') }] : []),
      { label: 'HH registradas', html: x => esc(fmtNumber(labor.active().filter(m => m.ID_PERSONA === x.ID_PERSONA).reduce((s, m) => s + Number(m.HORAS || 0), 0), 1)) },
      { label: 'Estado', html: x => badge(x.ESTADO_REGISTRO) },
      { label: '', html: x => p.configCostos && x.ESTADO_REGISTRO !== 'ANULADO' ? `<div class="toolbar mt-row-actions"><button class="btn btn-secondary btn-sm" data-edit-person="${esc(x.ID_PERSONA)}">Editar</button><button class="btn btn-secondary btn-sm" data-toggle-person="${esc(x.ID_PERSONA)}">${x.ESTADO_REGISTRO === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button></div>` : '' }
    ], { empty: 'Sin personal registrado. Registre técnicos internos y contratistas para valorar las horas hombre de las OT.' })}
    ${p.verCostos && rates.all().length ? `<details><summary>Historial de tarifas</summary>${dataTable(rates.all().sort((a, b) => String(b.VIGENTE_DESDE).localeCompare(String(a.VIGENTE_DESDE))), [
      { label: 'Persona', html: r => esc(staff.get(r.ID_PERSONA)?.NOMBRE || r.ID_PERSONA) }, { label: 'Valor hora', html: r => esc(fmtMoney(r.VALOR_HORA)) },
      { label: 'Vigente desde', html: r => esc(String(r.VIGENTE_DESDE).slice(0, 10)) }, { label: 'Observación', key: 'OBSERVACION' }, { label: 'Estado', html: r => badge(r.ESTADO_REGISTRO) },
      { label: '', html: r => p.configCostos && r.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-void-rate="${esc(r.ID_TARIFA)}">Anular</button>` : '' }
    ])}</details>` : ''}</div>`;
}

export function bindStaff(root, user) {
  root.querySelector('[data-add-person]')?.addEventListener('click', () => openForm({ title: 'Nueva persona', form: PERSON_FORM, values: { TIPO_PERSONAL: 'INTERNO' }, onSubmit: async d => { await staff.create(d, user); toast('Persona registrada'); } }));
  root.querySelector('[data-add-rate]')?.addEventListener('click', () => openForm({ title: 'Nueva tarifa de hora hombre', form: RATE_FORM, values: { VIGENTE_DESDE: today() }, optionsFor: { ID_PERSONA: personOptions }, onSubmit: async d => { await rates.create(d, user); toast('Tarifa registrada'); } }));
  root.querySelectorAll('[data-edit-person]').forEach(b => b.onclick = () => { const x = staff.get(b.dataset.editPerson); openForm({ title: 'Editar persona', form: PERSON_FORM, editing: true, values: x, onSubmit: async d => { await staff.update(x.ID_PERSONA, d, user); toast('Persona actualizada'); } }); });
  root.querySelectorAll('[data-toggle-person]').forEach(b => b.onclick = () => { const x = staff.get(b.dataset.togglePerson); changeState(user, staff, x.ID_PERSONA, x.ESTADO_REGISTRO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO', x.NOMBRE); });
  root.querySelectorAll('[data-void-rate]').forEach(b => b.onclick = () => changeState(user, rates, b.dataset.voidRate, 'ANULADO', 'la tarifa'));
}
