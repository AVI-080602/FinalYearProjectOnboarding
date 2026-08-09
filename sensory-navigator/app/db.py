"""Database layer — SQLAlchemy 2.0 models, 3NF per the Data Management Plan.

Engine selection: set DATABASE_URL for PostgreSQL, e.g.
    postgresql+psycopg2://user:pass@localhost:5432/sensory
Defaults to a local SQLite file so the prototype runs with zero setup.
The schema is identical on both.
"""
import os
from datetime import date, datetime

from dotenv import load_dotenv
from sqlalchemy import (
    Date, DateTime, Float, ForeignKey, Integer, String, create_engine, delete,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from .config import PROJECT_ROOT

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{PROJECT_ROOT / 'sensory.db'}"
)

_pg_args = (
    {"keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10,
     "keepalives_count": 5}
    if DATABASE_URL.startswith("postgresql") else {}
)
engine = create_engine(
    DATABASE_URL, future=True, pool_pre_ping=True, connect_args=_pg_args
)


class Base(DeclarativeBase):
    pass


# ---------- Pedestrian counting (composite PKs per the DMP's 1NF/2NF fixes) ----------

class SensorLocation(Base):
    __tablename__ = "sensor_location"
    location_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_description: Mapped[str | None] = mapped_column(String(120))
    sensor_name: Mapped[str | None] = mapped_column(String(60))
    installation_date: Mapped[date | None] = mapped_column(Date)
    location_type: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str | None] = mapped_column(String(10))   # 'A' = active
    direction_1: Mapped[str | None] = mapped_column(String(30))
    direction_2: Mapped[str | None] = mapped_column(String(30))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)


class PedestrianMinuteCount(Base):
    """Live rolling window. Per 2NF: no sensing_date/sensing_time columns —
    they depend only on sensing_datetime, not the full composite key."""
    __tablename__ = "pedestrian_minute_count"
    location_id: Mapped[int] = mapped_column(
        ForeignKey("sensor_location.location_id"), primary_key=True
    )
    sensing_datetime: Mapped[datetime] = mapped_column(DateTime, primary_key=True)
    direction_1: Mapped[int | None] = mapped_column(Integer)
    direction_2: Mapped[int | None] = mapped_column(Integer)
    total_of_directions: Mapped[int | None] = mapped_column(Integer)


class PedestrianHourCount(Base):
    """Historical hourly counts (windowed extract used to build profiles)."""
    __tablename__ = "pedestrian_hour_count"
    location_id: Mapped[int] = mapped_column(
        ForeignKey("sensor_location.location_id"), primary_key=True
    )
    sensing_date: Mapped[date] = mapped_column(Date, primary_key=True)
    hour: Mapped[int] = mapped_column(Integer, primary_key=True)
    direction_1: Mapped[int | None] = mapped_column(Integer)
    direction_2: Mapped[int | None] = mapped_column(Integer)
    pedestrian_count: Mapped[int | None] = mapped_column(Integer)


class HourlyProfile(Base):
    """Typical crowd level per sensor x weekday x hour — the forecast model."""
    __tablename__ = "hourly_profile"
    location_id: Mapped[int] = mapped_column(
        ForeignKey("sensor_location.location_id"), primary_key=True
    )
    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)  # 0=Mon
    hour: Mapped[int] = mapped_column(Integer, primary_key=True)
    avg_count: Mapped[float] = mapped_column(Float)
    sample_days: Mapped[int] = mapped_column(Integer)


# ---------- Refuges & sensory sources ----------

class Refuge(Base):
    """Tier 1 destination (library/gallery/worship), Tier 2 green (park),
    Tier 3 micro (seat, picnic setting, drinking fountain, toilet)."""
    __tablename__ = "refuge"
    refuge_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tier: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(80))
    source_dataset: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    wheelchair: Mapped[str | None] = mapped_column(String(10))


class VenueHours(Base):
    """Curated opening hours for Tier 1 refuges (collection method documented)."""
    __tablename__ = "venue_hours"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    refuge_id: Mapped[int] = mapped_column(ForeignKey("refuge.refuge_id"))
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0=Mon
    open_time: Mapped[str | None] = mapped_column(String(5))   # "10:00"
    close_time: Mapped[str | None] = mapped_column(String(5))  # "17:00"
    source: Mapped[str | None] = mapped_column(String(200))
    verified_date: Mapped[date | None] = mapped_column(Date)


class SensorySource(Base):
    """Point sources feeding the static SLI layers (noise/light/construction proxies)."""
    __tablename__ = "sensory_source"
    source_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(30))  # music_venue | bar | light | construction
    name: Mapped[str | None] = mapped_column(String(200))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    weight: Mapped[float] = mapped_column(Float)   # kind-specific intensity


# Note: there is deliberately no user/profile table. Sensory settings
# (weights + threshold, AC 1.3.1) live in the user's browser (localStorage)
# and are sent with each request. The database holds no user data at all.


class CalmPlaceSuggestion(Base):
    """Community-suggested calm places (AC 2.1.5). Anonymous by design:
    no submitter identity is stored. Nothing publishes without review."""
    __tablename__ = "calm_place_suggestion"
    suggestion_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(String(200))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|approved|rejected
    created_at: Mapped[datetime] = mapped_column(DateTime)


# ---------- helpers ----------

def init_db() -> None:
    Base.metadata.create_all(engine)


def upsert_dataframe(df, model, pk_cols: list[str], chunk: int = 500) -> int:
    """Dialect-aware bulk INSERT ... ON CONFLICT DO NOTHING. Returns rows attempted.

    One transaction per chunk: long single transactions over pooled cloud
    connections (Neon) get dropped mid-flight; per-chunk commits are resumable."""
    if engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    table = model.__table__
    rows = df.to_dict("records")
    for i in range(0, len(rows), chunk):
        with engine.begin() as conn:
            stmt = insert(table).values(rows[i : i + chunk])
            stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
            conn.execute(stmt)
    return len(rows)


def replace_table(df, model, chunk: int = 2000) -> int:
    """Full refresh for rebuilt-on-ingest tables (refuge, sensory_source, profiles)."""
    table = model.__table__
    rows = df.to_dict("records")
    with engine.begin() as conn:
        conn.execute(delete(table))
        for i in range(0, len(rows), chunk):
            conn.execute(table.insert(), rows[i : i + chunk])
    return len(rows)


def session() -> Session:
    return Session(engine)
