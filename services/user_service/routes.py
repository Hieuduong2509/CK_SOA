from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    ProfileResponse, ProfileBase, PortfolioItemCreate, PortfolioItemResponse,
    PackageCreate, PackageResponse, FreelancerFilter, ReviewCreate, ReviewResponse,
    ArticleCreate, ArticleResponse, FavoriteCreate, FavoriteResponse
)
from crud import (
    get_profile_by_user_id, get_profile_by_id, create_profile, update_profile,
    get_portfolio_items, create_portfolio_item,
    get_packages, create_package, search_freelancers,
    create_review, get_reviews, create_article, get_articles,
    add_favorite, remove_favorite, list_favorites
)
from storage import upload_file, MINIO_BUCKET
import httpx
import os


def enrich_profile(db: Session, profile):
    if not profile:
        return None

    packages = get_packages(db, profile.id, active_only=False)
    starting_price = None
    if packages:
        prices = [pkg.price for pkg in packages if pkg.price is not None]
        if prices:
            starting_price = min(prices)

    total_stars = (profile.rating or 0) * (profile.total_reviews or 0)
    level = max(1, int(total_stars // 100) + 1)

    if profile.badges is None:
        profile.badges = []
    if profile.categories is None:
        profile.categories = []
    if profile.languages is None:
        profile.languages = []

    setattr(profile, "starting_price", starting_price)
    setattr(profile, "total_stars", total_stars)
    setattr(profile, "level", level)

    return profile


router = APIRouter(prefix="/api/v1/users", tags=["users"])

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")
http_bearer = HTTPBearer(auto_error=False)


def resolve_account(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    if not credentials:
        return None
    try:
        response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
            timeout=5.0
        )
        if response.status_code == 200:
            return response.json()
    except Exception as exc:
        print(f"resolve_account error: {exc}")
    # Return None instead of raising exception for optional auth
    return None


def ensure_owner_or_admin(account: dict, user_id: int):
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if account.get("role") == "admin":
        return
    if account.get("id") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


@router.get("/{user_id}", response_model=ProfileResponse)
def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    account: dict = Depends(resolve_account)
):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        # Auto-create profile if user is accessing their own profile
        if account and account.get("id") == user_id:
            profile = create_profile(db, user_id)
            db.refresh(profile)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
    return enrich_profile(db, profile)


@router.put("/{user_id}", response_model=ProfileResponse)
def update_user_profile(
    user_id: int,
    profile_data: ProfileBase,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    profile = update_profile(
        db,
        user_id,
        **profile_data.dict(exclude_unset=True)
    )
    return enrich_profile(db, profile)


@router.post("/{user_id}/avatar")
def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_data = file.file.read()
    object_name = f"avatars/{user_id}/{file.filename}"
    url = upload_file(MINIO_BUCKET, object_name, file_data, file.content_type)
    
    profile = update_profile(db, user_id, avatar_url=url)
    return {"avatar_url": url}


@router.post("/{user_id}/portfolio", response_model=PortfolioItemResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio_item_endpoint(
    user_id: int,
    item: PortfolioItemCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        profile = create_profile(db, user_id)
    
    portfolio_item = create_portfolio_item(
        db,
        profile.id,
        **item.dict()
    )
    return portfolio_item


@router.get("/{user_id}/portfolio", response_model=list[PortfolioItemResponse])
def get_user_portfolio(user_id: int, db: Session = Depends(get_db)):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    items = get_portfolio_items(db, profile.id)
    return items


@router.post("/{user_id}/package", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
def create_service_package(
    user_id: int,
    package: PackageCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        profile = create_profile(db, user_id)
    
    package_obj = create_package(
        db,
        profile.id,
        **package.dict()
    )
    return package_obj


@router.get("/{user_id}/packages", response_model=list[PackageResponse])
def get_user_packages(user_id: int, db: Session = Depends(get_db)):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    packages = get_packages(db, profile.id)
    return packages


@router.get("", response_model=list[ProfileResponse])
def list_freelancers(
    skills: str = None,
    rating_min: float = None,
    price_min: float = None,
    price_max: float = None,
    location: str = None,
    query: str = None,
    categories: str = None,
    badges: str = None,
    experience_level: str = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    try:
        skill_list = skills.split(",") if skills else None
        if skill_list:
            skill_list = [s.strip() for s in skill_list if s.strip()]
        category_list = categories.split(",") if categories else None
        if category_list:
            category_list = [c.strip() for c in category_list if c.strip()]
        badge_list = badges.split(",") if badges else None
        if badge_list:
            badge_list = [b.strip() for b in badge_list if b.strip()]
 
        freelancers = search_freelancers(
            db,
            skills=skill_list,
            rating_min=rating_min,
            price_min=price_min,
            price_max=price_max,
            location=location,
            query_text=query,
            categories=category_list,
            badges=badge_list,
            experience_level=experience_level,
            limit=limit,
            offset=offset
        )
        return [enrich_profile(db, f) for f in freelancers]
    except Exception as e:
        import traceback
        print(f"Error in list_freelancers: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/{user_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review_endpoint(
    user_id: int,
    review: ReviewCreate,
    db: Session = Depends(get_db)
):
    review_obj = create_review(
        db,
        reviewer_id=user_id,
        **review.dict()
    )
    return review_obj


@router.get("/{user_id}/reviews", response_model=list[ReviewResponse])
def get_user_reviews(user_id: int, db: Session = Depends(get_db)):
    reviews = get_reviews(db, user_id)
    return reviews


@router.get("/{user_id}/articles", response_model=list[ArticleResponse])
def list_user_articles(user_id: int, limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    return get_articles(db, profile.id, limit=limit, offset=offset)


@router.post("/{user_id}/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_user_article(
    user_id: int,
    article: ArticleCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        profile = create_profile(db, user_id)
    article_obj = create_article(db, profile.id, **article.dict())
    return article_obj


@router.get("/{user_id}/favorites", response_model=list[FavoriteResponse])
def list_user_favorites(
    user_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    favorites = list_favorites(db, user_id)
    result = []
    for fav in favorites:
        profile = enrich_profile(db, fav.freelancer)
        fav_dict = FavoriteResponse(
            id=fav.id,
            freelancer_profile_id=fav.freelancer_profile_id,
            notes=fav.notes,
            created_at=fav.created_at,
            freelancer=ProfileResponse.model_validate(profile)
        )
        result.append(fav_dict)
    return result


@router.post("/{user_id}/favorites", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_user_favorite(
    user_id: int,
    payload: FavoriteCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    # freelancer_profile_id is profile.id, not user_id
    profile = get_profile_by_id(db, payload.freelancer_profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Freelancer profile not found")
    favorite = add_favorite(db, user_id, payload.freelancer_profile_id, notes=payload.notes)
    profile = enrich_profile(db, favorite.freelancer)
    return FavoriteResponse(
        id=favorite.id,
        freelancer_profile_id=favorite.freelancer_profile_id,
        notes=favorite.notes,
        created_at=favorite.created_at,
        freelancer=ProfileResponse.model_validate(profile)
    )


@router.delete("/{user_id}/favorites/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_favorite(
    user_id: int,
    favorite_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    favorite = remove_favorite(db, user_id, favorite_id)
    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    return None

