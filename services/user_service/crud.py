from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from models import Profile, PortfolioItem, Package, Review, PackageStatus
from models import Article, Favorite
from typing import List, Optional


def get_profile_by_user_id(db: Session, user_id: int):
    return db.query(Profile).filter(Profile.user_id == user_id).first()

def get_profile_by_id(db: Session, profile_id: int):
    return db.query(Profile).filter(Profile.id == profile_id).first()


def create_profile(db: Session, user_id: int, display_name: Optional[str] = None):
    # Không dùng default "Freelancer #X" nữa, để None nếu không có display_name
    # display_name sẽ được set từ auth service khi signup
    profile = Profile(
        user_id=user_id,
        display_name=display_name,  # Có thể là None, sẽ được sync từ auth service
        categories=[],
        badges=[],
        languages=[]
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_profile(db: Session, user_id: int, default_display_name: Optional[str] = None, **kwargs):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        initial_display_name = kwargs.get("display_name") or default_display_name
        profile = create_profile(db, user_id, display_name=initial_display_name)
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


def get_packages(db: Session, profile_id: int, active_only: bool = True, status: Optional[str] = None):
    query = db.query(Package).filter(Package.profile_id == profile_id)
    if active_only:
        query = query.filter(Package.status == PackageStatus.APPROVED.value)
    if status:
        query = query.filter(Package.status == status)
    return query.order_by(Package.created_at.desc()).all()


def get_package_by_id(db: Session, package_id: int):
    return db.query(Package).filter(Package.id == package_id).first()


def create_package(db: Session, profile_id: int, **kwargs):
    package = Package(profile_id=profile_id, **kwargs)
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


def update_package(db: Session, package: Package, **kwargs):
    for key, value in kwargs.items():
        if value is None:
            continue
        if hasattr(package, key):
            setattr(package, key, value)
    db.commit()
    db.refresh(package)
    return package


def count_packages_by_status(db: Session, profile_id: int, status: str) -> int:
    return db.query(Package).filter(
        Package.profile_id == profile_id,
        Package.status == status
    ).count()


def count_total_packages(db: Session, profile_id: int, include_draft: bool = False) -> int:
    """Đếm tổng số package của freelancer (có thể bao gồm hoặc không bao gồm draft)"""
    query = db.query(Package).filter(Package.profile_id == profile_id)
    if not include_draft:
        query = query.filter(Package.status != PackageStatus.DRAFT.value)
    return query.count()


def calculate_service_limit(level: int, total_stars: float) -> int:
    """
    Tính giới hạn số service có thể đăng dựa trên level và số sao.
    
    Quy tắc:
    - Mặc định: 1 service
    - Level 5 hoặc 25 sao: +1 service (tổng 2)
    - Level 10 hoặc 50 sao: +2 service (tổng 3)
    - Level 15 hoặc 75 sao: +3 service (tổng 4)
    - Level 20 hoặc 100 sao: +4 service (tổng 5)
    - Level 25 hoặc 125 sao: +5 service (tổng 6)
    - Level 30 hoặc 150 sao: +6 service (tổng 7)
    - Tối đa: 10 services
    
    Lấy giá trị cao hơn giữa level-based và star-based limit.
    """
    base_limit = 1
    
    # Tính limit dựa trên level (mỗi 5 level = +1 service)
    level_bonus = (level // 5) * 1
    level_limit = base_limit + level_bonus
    
    # Tính limit dựa trên số sao (mỗi 25 sao = +1 service)
    star_bonus = int(total_stars // 25) * 1
    star_limit = base_limit + star_bonus
    
    # Lấy giá trị cao hơn
    calculated_limit = max(level_limit, star_limit)
    
    # Giới hạn tối đa 10 services
    return min(calculated_limit, 10)


def search_service_packages(
    db: Session,
    status: Optional[str] = None,
    categories: Optional[List[str]] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    query_text: Optional[str] = None,
    max_delivery_days: Optional[int] = None,
    min_rating: Optional[float] = None,
    tags: Optional[List[str]] = None,
    sort: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    from sqlalchemy import cast, String

    query = db.query(Package).join(Profile)

    if status:
        try:
            status_enum = PackageStatus(status)
            query = query.filter(Package.status == status_enum.value)
        except ValueError:
            query = query.filter(Package.status == status)

    if categories:
        category_patterns = [f"%{c.lower()}%" for c in categories]
        for pattern in category_patterns:
            query = query.filter(cast(Package.category, String).ilike(pattern))

    if min_price is not None:
        query = query.filter(Package.price >= min_price)

    if max_price is not None:
        query = query.filter(Package.price <= max_price)

    if max_delivery_days is not None:
        query = query.filter(Package.delivery_days <= max_delivery_days)

    if tags:
        for tag in tags:
            pattern = f"%{tag.lower()}%"
            query = query.filter(cast(Package.tags, String).ilike(pattern))

    if query_text:
        pattern = f"%{query_text.lower()}%"
        query = query.filter(
            cast(Package.name, String).ilike(pattern)
            | cast(Package.description, String).ilike(pattern)
            | cast(Profile.display_name, String).ilike(pattern)
        )

    if min_rating is not None:
        query = query.filter(func.coalesce(Package.rating, Profile.rating, 0) >= min_rating)

    sort_key = (sort or "recent").lower()
    if sort_key == "price_asc":
        query = query.order_by(Package.price.asc(), Package.created_at.desc())
    elif sort_key == "price_desc":
        query = query.order_by(Package.price.desc(), Package.created_at.desc())
    elif sort_key == "rating":
        query = query.order_by(func.coalesce(Package.rating, Profile.rating, 0).desc())
    elif sort_key == "fastest":
        query = query.order_by(Package.delivery_days.asc(), Package.price.asc())
    else:
        query = query.order_by(Package.created_at.desc())

    return (
        query.offset(offset)
        .limit(limit)
        .all()
    )


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
    offset: int = 0,
    sort: Optional[str] = None
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

        sort_key = (sort or "recent").lower()
        if sort_key == "rating":
            order_column = Profile.rating.desc()
        else:
            order_column = Profile.created_at.desc()

        # Use distinct only if we joined with Package
        if has_price_filter or (has_query_text and query_text):
            results = (
                query.distinct(Profile.id)
                .order_by(Profile.id, order_column)
                .offset(offset)
                .limit(limit)
                .all()
            )
        else:
            results = query.order_by(order_column).offset(offset).limit(limit).all()
        
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

