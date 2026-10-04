import sys
from pathlib import Path

# Ensure backend root is on sys.path for direct script execution
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.niche import Niche


def run_seed() -> None:
    db = SessionLocal()
    try:
        seeds = [
            ("Tech & Gadgets", "Consumer tech products, gadgets, and smart accessories."),
            ("Home & Kitchen", "Home utility, appliances, kitchen tools, and decor."),
            ("Fitness", "Fitness gear, routines, and active lifestyle products."),
        ]
        existing = {row[0] for row in db.execute(select(Niche.name)).all()}
        for name, description in seeds:
            if name not in existing:
                db.add(Niche(name=name, description=description))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
    print("Seeded default niches.")

