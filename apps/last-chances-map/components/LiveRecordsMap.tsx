"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LastChancesRecord } from "@maps-lab/core-schema";

type Props = {
  records: LastChancesRecord[];
  height?: number;
};

function FitToRecords({ records }: { records: LastChancesRecord[] }) {
  const map = useMap();

  useEffect(() => {
    if (records.length === 0) return;
    const bounds = records.map((record) => [record.lat, record.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, records]);

  return null;
}

function getColor(record: LastChancesRecord): string {
  if (record.stillAccessible === false) return "#6f6257";
  if (record.urgency === "critical" || record.urgency === "high") return "#9d2f25";
  if (record.urgency === "medium") return "#9a6a1d";
  return "#4b6b4e";
}

export default function LiveRecordsMap({ records, height = 640 }: Props) {
  const fallbackCenter: [number, number] = [35.0, 10.0];

  return (
    <div style={{ height, width: "100%", border: "1px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
      <MapContainer center={fallbackCenter} zoom={2} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToRecords records={records} />
        {records.map((record) => (
          <CircleMarker
            key={record.id}
            center={[record.lat, record.lng]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: getColor(record),
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div style={{ minWidth: 220 }}>
                <strong>{record.title}</strong>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  {record.city} · {record.area}
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  {record.stillAccessible === false ? "Recently lost" : "Still accessible"} · {record.urgency}
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <a href={`/record/${record.slug}`}>View detail</a>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
