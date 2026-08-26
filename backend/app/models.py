"""
models.py — SQLAlchemy ORM models for AegisOps.
All tables use SQLite-compatible types; upgrade to PostgreSQL via DATABASE_URL change only.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Text, Float, Boolean, Integer,
    DateTime, ForeignKey, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    service: Mapped[str] = mapped_column(String(128), nullable=False, default="kartify")
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="UNKNOWN")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DETECTED")
    title: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    events: Mapped[list["IncidentEvent"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by="IncidentEvent.ts"
    )
    agent_runs: Mapped[list["AgentRun"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by="AgentRun.ts"
    )
    remediation_actions: Mapped[list["RemediationAction"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    verification_results: Mapped[list["VerificationResult"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )


class IncidentEvent(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(64))   # e.g. status_change, agent_started
    message: Mapped[str] = mapped_column(Text)
    ts: Mapped[datetime] = mapped_column(DateTime, default=_now)

    incident: Mapped["Incident"] = relationship(back_populates="events")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    agent_name: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="running")  # running | done | failed
    input_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=_now)

    incident: Mapped["Incident"] = relationship(back_populates="agent_runs")


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    runbook_name: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending | executed | failed
    executed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    response_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    incident: Mapped["Incident"] = relationship(back_populates="remediation_actions")


class VerificationResult(Base):
    __tablename__ = "verification_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    recovered: Mapped[bool] = mapped_column(Boolean, default=False)
    health_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    error_rate_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_rate_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=_now)

    incident: Mapped["Incident"] = relationship(back_populates="verification_results")


class KnowledgeIncident(Base):
    __tablename__ = "knowledge_incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    service: Mapped[str] = mapped_column(String(128))
    severity: Mapped[str] = mapped_column(String(32))
    root_cause: Mapped[str] = mapped_column(Text)
    runbook_used: Mapped[str] = mapped_column(String(128))
    resolution_summary: Mapped[str] = mapped_column(Text)
    tags: Mapped[str | None] = mapped_column(String(256), nullable=True)  # comma-separated keywords
    ts: Mapped[datetime] = mapped_column(DateTime, default=_now)
