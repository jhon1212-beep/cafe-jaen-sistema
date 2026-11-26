import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../shared/api/client";
import type { CoffeeType, Cooperative, LocalPriceObservation } from "../../shared/api/types";
import { ConfirmButton } from "../../shared/components/ConfirmButton";
import { StatusMessage } from "../../shared/components/StatusMessage";
import { formatDateTime, formatPercent, formatSoles } from "../../shared/format";
import { useApi } from "../../shared/hooks/useApi";
import { EditIcon, TrashIcon } from "../../shared/motion/icons";
import { texts } from "../../shared/texts/es";
import { AdminTabs } from "./AdminTabs";

const TYPES: CoffeeType[] = ["convencional", "organico", "especial"];

/** HU12: el equipo anota cuánto paga cada cooperativa del catálogo y corrige errores. */
export function AdminPage() {
  const prices = useApi<{ observations: LocalPriceObservation[] }>("/admin/local-prices");
  const catalog = useApi<{ cooperatives: Cooperative[] }>("/admin/cooperatives");
  const active = catalog.data?.cooperatives.filter((c) => c.active) ?? [];

  return (
    <section>
      <AdminTabs />
      <h1>{texts.admin.title}</h1>
      <p className="muted">{texts.admin.intro}</p>
      <NewPriceForm cooperatives={active} onSaved={prices.reload} />

      <h2 className="card__title">{texts.admin.recent}</h2>
      <StatusMessage loading={prices.loading} error={prices.error} onRetry={prices.reload} />
      {prices.data && (
        <ul className="card observations">
          {prices.data.observations.map((o) => (
            <ObservationRow key={o.id} observation={o} onChanged={prices.reload} />
          ))}
        </ul>
      )}
      <ExportPrices />
    </section>
  );
}

const isoDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "America/Lima" });

/** Descarga los precios de cooperativas de un periodo (detalle o promedio por día). */
function ExportPrices() {
  const today = new Date();
  const [start, setStart] = useState(isoDay(new Date(today.getTime() - 29 * 86_400_000)));
  const [end, setEnd] = useState(isoDay(today));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async (summary: boolean) => {
    setBusy(true);
    setError(null);
    const name = summary ? "promedio_diario_cooperativas" : "precios_cooperativas";
    try {
      await api.download(
        `/admin/local-prices/export?start=${start}&end=${end}&summary=${summary}`,
        `${name}_${start}_${end}.csv`,
      );
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="form card">
      <h2 className="card__title">{texts.admin.exportTitle}</h2>
      <p className="muted">{texts.admin.exportIntro}</p>
      <label>
        {texts.admin.exportFrom}
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label>
        {texts.admin.exportTo}
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <button className="button" type="button" disabled={busy} onClick={() => download(false)}>
        {texts.admin.exportDetail}
      </button>
      <button className="button" type="button" disabled={busy} onClick={() => download(true)}>
        {texts.admin.exportSummary}
      </button>
      <StatusMessage error={error} />
    </article>
  );
}

function NewPriceForm({
  cooperatives,
  onSaved,
}: {
  cooperatives: Cooperative[];
  onSaved: () => void;
}) {
  const [cooperative, setCooperative] = useState("");
  const [coffeeType, setCoffeeType] = useState<CoffeeType>("convencional");
  const [paid, setPaid] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.post<LocalPriceObservation>("/admin/local-prices", {
        cooperative,
        coffee_type: coffeeType,
        paid_soles: parseAmount(paid),
      });
      setMessage(texts.admin.saved(formatPercent(saved.ratio_pct)));
      setPaid("");
      onSaved();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form card" onSubmit={save}>
      <label>
        {texts.admin.cooperative}
        <select value={cooperative} onChange={(e) => setCooperative(e.target.value)} required>
          <option value="" disabled>
            {texts.admin.choose}
          </option>
          {cooperatives.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Link to="/equipo/cooperativas" className="form__link">
        {texts.admin.manageCatalog}
      </Link>
      <label>
        {texts.admin.coffeeType}
        <select value={coffeeType} onChange={(e) => setCoffeeType(e.target.value as CoffeeType)}>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {texts.local.coffeeTypes[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {texts.admin.paid}
        <input
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          inputMode="decimal"
          required
        />
      </label>
      <button className="button" disabled={saving}>
        {texts.admin.save}
      </button>
      {message && (
        <p className="up" role="status">
          {message}
        </p>
      )}
      <StatusMessage error={error} />
    </form>
  );
}

/** Un precio anotado: se puede corregir el monto (misma bolsa de ese momento) o borrar. */
function ObservationRow({
  observation: o,
  onChanged,
}: {
  observation: LocalPriceObservation;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [paid, setPaid] = useState(String(o.paid_soles));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(false);
      onChanged();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="observation">
      <div className="observation__head">
        <span>
          <strong>{o.cooperative}</strong> · {texts.local.coffeeTypes[o.coffee_type]}
        </span>
        <span className="observation__actions">
          <button
            type="button"
            className="icon-button"
            aria-label={texts.admin.correct}
            onClick={() => setEditing((value) => !value)}
          >
            <EditIcon />
          </button>
          <ConfirmButton
            label={texts.admin.removePrice}
            disabled={busy}
            onConfirm={() => run(() => api.delete(`/admin/local-prices/${o.id}`))}
          >
            <TrashIcon />
          </ConfirmButton>
        </span>
      </div>
      <span className="muted">
        {formatDateTime(new Date(o.observed_at))} · {texts.admin.paidShort}{" "}
        {formatSoles(o.paid_soles)} · {texts.admin.exchange} {formatSoles(o.exchange_soles)} ·{" "}
        <strong>{formatPercent(o.ratio_pct)}</strong>
      </span>
      {editing && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              api.patch(`/admin/local-prices/${o.id}`, { paid_soles: parseAmount(paid) }),
            );
          }}
        >
          <input
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            inputMode="decimal"
            aria-label={texts.admin.paid}
            required
          />
          <button className="button" disabled={busy}>
            {texts.cooperatives.save}
          </button>
        </form>
      )}
      <StatusMessage error={error} />
    </li>
  );
}

/** Acepta «1100,50» o «1100.50». */
function parseAmount(value: string): number {
  return Number(value.replace(",", "."));
}
