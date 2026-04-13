"""Domain CRUD endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.focus_area import FocusArea
from app.api.schemas import DomainCreate, DomainUpdate, DomainOut

router = APIRouter(prefix="/api/domains", tags=["domains"])


@router.get("", response_model=List[DomainOut])
async def list_domains(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FocusArea).order_by(FocusArea.position, FocusArea.id))
    return result.scalars().all()


@router.post("", response_model=DomainOut, status_code=201)
async def create_domain(body: DomainCreate, db: AsyncSession = Depends(get_db)):
    # Auto-assign position if not provided
    if body.position is None:
        result = await db.execute(select(func.coalesce(func.max(FocusArea.position), -1)))
        body.position = result.scalar() + 1

    fa = FocusArea(**body.model_dump())
    db.add(fa)
    await db.commit()
    await db.refresh(fa)
    return fa


@router.put("/{domain_id}", response_model=DomainOut)
async def update_domain(domain_id: int, body: DomainUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FocusArea).where(FocusArea.id == domain_id))
    fa = result.scalar_one_or_none()
    if not fa:
        raise HTTPException(404, "Domain not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(fa, field, value)

    await db.commit()
    await db.refresh(fa)
    return fa


@router.delete("/{domain_id}", status_code=204)
async def delete_domain(domain_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FocusArea).where(FocusArea.id == domain_id))
    fa = result.scalar_one_or_none()
    if not fa:
        raise HTTPException(404, "Domain not found")

    await db.delete(fa)
    await db.commit()
