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

