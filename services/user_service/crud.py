from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import Profile, PortfolioItem, Package, Review
from models import Article, Favorite
from typing import List, Optional


def get_profile_by_user_id(db: Session, user_id: int):
    return db.query(Profile).filter(Profile.user_id == user_id).first()

def get_profile_by_id(db: Session, profile_id: int):
    return db.query(Profile).filter(Profile.id == profile_id).first()


def create_profile(db: Session, user_id: int):
    profile = Profile(
        user_id=user_id,
        display_name=f"Freelancer #{user_id}",
        categories=[],
        badges=[],
        languages=[]
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_profile(db: Session, user_id: int, **kwargs):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        profile = create_profile(db, user_id)
    for key, value in kwargs.items():
        if value is not None:
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


def get_portfolio_items(db: Session, profile_id: int):
    return db.query(PortfolioItem).filter(PortfolioItem.profile_id == profile_id).all()


def create_portfolio_item(db: Session, profile_id: int, **kwargs):
    item = PortfolioItem(profile_id=profile_id, **kwargs)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_packages(db: Session, profile_id: int, active_only: bool = True):
    query = db.query(Package).filter(Package.profile_id == profile_id)
    if active_only:
        query = query.filter(Package.is_active == True)
    return query.all()


def create_package(db: Session, profile_id: int, **kwargs):
    package = Package(profile_id=profile_id, **kwargs)
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


def search_freelancers(
    db: Session,
    skills: Optional[List[str]] = None,
    rating_min: Optional[float] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    location: Optional[str] = None,
    query_text: Optional[str] = None,
    categories: Optional[List[str]] = None,
    badges: Optional[List[str]] = None,
    experience_level: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    try:
        from sqlalchemy import cast, String

        # Start with base query - only join Package if we need price filtering
        has_price_filter = price_min is not None or price_max is not None
        has_query_text = query_text is not None
        
        if has_price_filter or has_query_text:
            query = db.query(Profile).outerjoin(Package)
        else:
            query = db.query(Profile)

        if skills:
            for skill in skills:
                pattern = f"%{skill.lower()}%"
                query = query.filter(cast(Profile.skills, String).ilike(pattern))

        if query_text:
            pattern = f"%{query_text.lower()}%"
            # Only search in Package if we joined it
            if has_price_filter or has_query_text:
                query = query.filter(
                    cast(Profile.display_name, String).ilike(pattern)
                    | cast(Profile.headline, String).ilike(pattern)
                    | cast(Profile.bio, String).ilike(pattern)
                    | cast(Package.name, String).ilike(pattern)
                    | cast(Package.description, String).ilike(pattern)
                )
            else:
                query = query.filter(
                    cast(Profile.display_name, String).ilike(pattern)
                    | cast(Profile.headline, String).ilike(pattern)
                    | cast(Profile.bio, String).ilike(pattern)
                )

        if categories:
            for category in categories:
                pattern = f"%{category.lower()}%"
                query = query.filter(cast(Profile.categories, String).ilike(pattern))

        if badges:
            for badge in badges:
                pattern = f"%{badge.lower()}%"
                query = query.filter(cast(Profile.badges, String).ilike(pattern))

        if rating_min:
            query = query.filter(Profile.rating >= rating_min)

        if experience_level:
            query = query.filter(Profile.experience_level == experience_level)

        if location:
            query = query.filter(Profile.location.ilike(f"%{location}%"))

        if price_min or price_max:
            if not has_price_filter:
                query = query.outerjoin(Package)
            if price_min:
                query = query.filter(Package.price >= price_min)
            if price_max:
                query = query.filter(Package.price <= price_max)

        # Use distinct only if we joined with Package
        if has_price_filter or (has_query_text and query_text):
            results = query.distinct(Profile.id).order_by(Profile.rating.desc()).offset(offset).limit(limit).all()
        else:
            results = query.order_by(Profile.rating.desc()).offset(offset).limit(limit).all()
        
        return results
    except Exception as e:
        import traceback
        print(f"Error in search_freelancers: {e}")
        print(traceback.format_exc())
        return []


def create_review(db: Session, **kwargs):
    review = Review(**kwargs)
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # Update profile rating
    profile = get_profile_by_user_id(db, review.reviewee_id)
    if profile:
        # Recalculate average rating
        reviews = db.query(Review).filter(Review.reviewee_id == review.reviewee_id).all()
        if reviews:
            avg_rating = sum(r.rating_overall for r in reviews) / len(reviews)
            profile.rating = avg_rating
            profile.total_reviews = len(reviews)
            db.commit()
    
    return review


def get_reviews(db: Session, user_id: int):
    return db.query(Review).filter(Review.reviewee_id == user_id).all()


def create_article(db: Session, profile_id: int, **kwargs):
    article = Article(profile_id=profile_id, **kwargs)
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def get_articles(db: Session, profile_id: int, limit: int = 20, offset: int = 0):
    return (
        db.query(Article)
        .filter(Article.profile_id == profile_id)
        .order_by(Article.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def add_favorite(db: Session, user_id: int, freelancer_profile_id: int, notes: Optional[str] = None):
    existing = db.query(Favorite).filter(
        Favorite.user_id == user_id,
        Favorite.freelancer_profile_id == freelancer_profile_id
    ).first()
    if existing:
        if notes is not None:
            existing.notes = notes
            db.commit()
            db.refresh(existing)
        return existing

    favorite = Favorite(
        user_id=user_id,
        freelancer_profile_id=freelancer_profile_id,
        notes=notes
    )
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


def remove_favorite(db: Session, user_id: int, favorite_id: int):
    favorite = db.query(Favorite).filter(
        Favorite.id == favorite_id,
        Favorite.user_id == user_id
    ).first()
    if favorite:
        db.delete(favorite)
        db.commit()
    return favorite


def list_favorites(db: Session, user_id: int):
    return db.query(Favorite).filter(Favorite.user_id == user_id).order_by(Favorite.created_at.desc()).all()

