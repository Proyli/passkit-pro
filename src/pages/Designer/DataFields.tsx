// src/pages/Designer/DataFields.tsx
type Row = { key: string; usage: string; type: string; label: string };

const rows: Row[] = [
  { key: "members.program.name", usage: "G", type: "Protocol Field", label: "Points" },
  { key: "members.member.points", usage: " G", type: "Protocol Field", label: "Points" },
  { key: "person.displayName", usage: " G ▦", type: "PII Field", label: "Name" },
  { key: "members.tier.name", usage: " G", type: "Protocol Field", label: "Tier" },
  { key: "universal.info", usage: " G", type: "Universal Field", label: "Information" },
];

export default function DesignerDataFields() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl rounded-2xl border bg-white">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Data Fields</h3>
          <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">ADD DATA FIELD</button>
        </div>
        <div className="divide-y">
          <div className="grid grid-cols-[1.5fr,1fr,1fr,1fr] px-4 py-2 text-xs text-slate-500">
            <div>Field Key</div><div>Usage</div><div>Field Type</div><div>Label</div>
          </div>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[1.5fr,1fr,1fr,1fr] px-4 py-3">
              <div className="font-mono text-sm">{r.key}</div>
              <div className="text-sm">{r.usage}</div>
              <div className="text-sm">{r.type}</div>
              <div className="text-sm">{r.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
