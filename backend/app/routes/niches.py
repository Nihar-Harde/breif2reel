from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.niche import Niche

router = APIRouter(prefix="/niches", tags=["niches"])


@router.get("")
def list_niches(db: Session = Depends(get_db)) -> dict:
    niches = db.execute(select(Niche).order_by(Niche.name.asc())).scalars().all()
    return {
        "items": [
            {"id": str(niche.id), "name": niche.name, "description": niche.description}
            for niche in niches
        ]
    }

