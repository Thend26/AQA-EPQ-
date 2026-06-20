type AoObservationValues = {
  ao1Note: string;
  ao2Note: string;
  ao3Note: string;
  ao4Note: string;
};

type AoObservationsProps = {
  values: AoObservationValues;
  onChange: <K extends keyof AoObservationValues>(
    key: K,
    value: AoObservationValues[K],
  ) => void;
};

const observations = [
  ["ao1Note", "AO1 Manage 当日观察"],
  ["ao2Note", "AO2 Use resources 当日观察"],
  ["ao3Note", "AO3 Develop and realise 当日观察"],
  ["ao4Note", "AO4 Review 当日观察"],
] as const;

export function AoObservations({
  values,
  onChange,
}: AoObservationsProps) {
  return (
    <fieldset className="space-y-4">
      <legend>AQA EPQ 当日观察</legend>
      {observations.map(([key, label]) => (
        <label className="block" key={key}>
          {label}
          <textarea
            name={key}
            value={values[key]}
            onChange={(event) => onChange(key, event.target.value)}
            maxLength={2000}
          />
        </label>
      ))}
    </fieldset>
  );
}
