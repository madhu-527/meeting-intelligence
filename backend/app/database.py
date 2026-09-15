import json
from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./meetings.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class MeetingRecord(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Completed")
    summary = Column(Text)
    key_topics = Column(Text)       # JSON string
    decisions = Column(Text)        # JSON string
    action_items = Column(Text)     # JSON string
    blockers = Column(Text)         # JSON string
    open_questions = Column(Text)   # JSON string
    follow_up_notes = Column(Text)  # JSON string
    reviewer_audit_log = Column(Text)

# Auto-generate table schemas
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()