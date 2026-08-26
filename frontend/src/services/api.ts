import axios from 'axios'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE })

export interface IncidentEvent {
  id: string
  incident_id: string
  event_type: string
  message: string
  ts: string
}

export interface AgentRun {
  id: string
  incident_id: string
  agent_name: string
  status: 'running' | 'done' | 'failed'
  input_json: Record<string, unknown> | null
  output_json: Record<string, unknown> | null
  duration_ms: number | null
  ts: string
}

export interface RemediationAction {
  id: string
  incident_id: string
  runbook_name: string
  status: string
  executed_at: string | null
  response_json: Record<string, unknown> | null
}

export interface VerificationResult {
  id: string
  incident_id: string
  recovered: boolean
  health_status: string | null
  error_rate_before: number | null
  error_rate_after: number | null
  details: Record<string, unknown> | null
  ts: string
}

export interface Incident {
  id: string
  service: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  status: string
  title: string
  summary: string | null
  root_cause: string | null
  created_at: string
  resolved_at: string | null
  events: IncidentEvent[]
  agent_runs: AgentRun[]
  remediation_actions: RemediationAction[]
  verification_results: VerificationResult[]
}

export interface LogEntry {
  id: string
  incident_id: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG'
  source: string
  message: string
  data?: Record<string, unknown> | null
  timestamp: string
}

export const listIncidents = () => api.get<Incident[]>('/incidents').then(r => r.data)
export const getIncident = (id: string) => api.get<Incident>(`/incidents/${id}`).then(r => r.data)
export const simulateIncident = (service = 'kartify') =>
  api.post<Incident>('/incidents/simulate', { service, trigger_kartify: true }).then(r => r.data)
export const getIncidentLogs = (id: string) =>
  api.get<{ incident_id: string; logs: LogEntry[] }>(`/incidents/${id}/logs`).then(r => r.data.logs)
export const getAllLogs = () =>
  api.get<{ logs: LogEntry[] }>('/incidents/logs/all').then(r => r.data.logs)
