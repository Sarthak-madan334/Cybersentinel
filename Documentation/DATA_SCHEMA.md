# DATA_SCHEMA.md
Documentation of the synthetic dataset and internal data shapes used by CyberSentinel.

## 1. Event dataset — `/data/events.json`

A flat array of event objects. All events share a common envelope plus type-specific fields.

### Common envelope (every event)
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique event id, e.g. `evt_0001` |
| `timestamp` | string (ISO 8601) | When the event occurred |
| `event_type` | string | One of: `auth`, `network`, `dns`, `process`, `file` |
| `source_ip` | string | Originating IP address |
| `dest_ip` | string \| null | Target IP, if applicable |
| `host` | string | Target host/machine name |
| `user` | string \| null | Associated user account, if applicable |

### Type-specific fields

**`auth`**
```json
{ "event_type": "auth", "status": "failed", "method": "password", "attempt_number": 5 }
```

**`network`**
```json
{ "event_type": "network", "dest_port": 445, "protocol": "TCP", "bytes_transferred": 1200, "connection_status": "refused" }
```

**`dns`**
```json
{ "event_type": "dns", "query": "malicious-c2-domain.example", "response_ip": "203.0.113.9", "query_type": "A" }
```

**`process`**
```json
{ "event_type": "process", "process_name": "powershell.exe", "command_line": "-enc <base64>", "parent_process": "winword.exe" }
```

**`file`**
```json
{ "event_type": "file", "file_path": "/etc/shadow", "action": "read", "file_size_bytes": 2048 }
```

### Example benign event
```json
{
  "id": "evt_0042",
  "timestamp": "2026-09-24T09:15:00Z",
  "event_type": "auth",
  "source_ip": "10.0.1.14",
  "dest_ip": null,
  "host": "workstation-14",
  "user": "j.patel",
  "status": "success",
  "method": "password",
  "attempt_number": 1
}
```

### Example malicious event
```json
{
  "id": "evt_0087",
  "timestamp": "2026-09-24T02:41:12Z",
  "event_type": "auth",
  "source_ip": "185.220.101.7",
  "dest_ip": null,
  "host": "vpn-gateway",
  "user": "admin",
  "status": "failed",
  "method": "password",
  "attempt_number": 14
}
```

## 2. Signature library — `/data/signatures.json`

An array of detection rule objects.

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique signature id, e.g. `sig_brute_force` |
| `category` | string | Threat category label (e.g. `Brute Force`, `Port Scan`, `Privilege Escalation`, `Data Exfiltration`, `Suspicious Login Geography/Time`, `C2 Beaconing`, `Malware Execution Pattern`) |
| `applies_to` | string | Which `event_type` this rule evaluates |
| `condition` | object | Matching logic, e.g. `{ "field": "attempt_number", "operator": ">=", "value": 5 }` or a small array of conditions ANDed together |
| `base_severity` | number | 0–100 base weight if matched |
| `mechanism_description` | string | One sentence explaining how this attack works, used as LLM context and as the non-LLM fallback text source |

### Example
```json
{
  "id": "sig_brute_force",
  "category": "Brute Force",
  "applies_to": "auth",
  "condition": { "field": "attempt_number", "operator": ">=", "value": 5 },
  "base_severity": 55,
  "mechanism_description": "Repeated failed authentication attempts from the same source indicate an automated credential-guessing attempt."
}
```

## 3. Detection object (internal, output of `detectEvents()`)

```json
{
  "detection_id": "det_0001",
  "signature_id": "sig_brute_force",
  "category": "Brute Force",
  "severity": 55,
  "matched_event_ids": ["evt_0087"],
  "source_ip": "185.220.101.7",
  "host": "vpn-gateway",
  "evidence": [
    { "event_id": "evt_0087", "field": "attempt_number", "value": 14 }
  ],
  "timestamp": "2026-09-24T02:41:12Z"
}
```

## 4. Incident object (internal, output of `correlateDetections()`, and shape returned by `/api/incidents`)

```json
{
  "incident_id": "inc_0001",
  "category": "Brute Force → Lateral Movement",
  "severity": 82,
  "severity_tier": "Critical",
  "source_ip": "185.220.101.7",
  "host": "vpn-gateway",
  "user": "admin",
  "status": "New",
  "detection_ids": ["det_0001", "det_0002"],
  "evidence": [
    { "event_id": "evt_0087", "field": "attempt_number", "value": 14 },
    { "event_id": "evt_0091", "field": "status", "value": "success" }
  ],
  "narrative": "A source IP made 14 failed login attempts against the VPN gateway before successfully authenticating as admin, consistent with a brute-force attack followed by successful access.",
  "recommended_response": "Isolate the affected account, force an immediate password reset, and review VPN session logs for further activity from this source IP.",
  "created_at": "2026-09-24T02:41:12Z",
  "resolved_at": null
}
```

`status` is one of: `New`, `Investigating`, `Contained`, `Resolved`. `resolved_at` is set when status becomes `Resolved`, and is what drives the historical view's filtering and time-based chart.
