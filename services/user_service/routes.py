from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from typing import Optional
from schemas import (
    ProfileResponse, ProfileBase, PortfolioItemCreate, PortfolioItemResponse,
    PackageCreate, PackageUpdate, PackageResponse, ServiceResponse,
    FreelancerFilter, ReviewCreate, ReviewResponse,
    ArticleCreate, ArticleResponse, FavoriteCreate, FavoriteResponse
)
from crud import (
    get_profile_by_user_id, get_profile_by_id, create_profile, update_profile,
    get_portfolio_items, create_portfolio_item,
    get_packages, get_package_by_id, create_package, update_package,
    search_freelancers, search_service_packages,
    create_review, get_reviews, create_article, get_articles,
    add_favorite, remove_favorite, list_favorites,
    count_packages_by_status, count_total_packages, calculate_service_limit
)
from models import PackageStatus, Review
from storage import upload_file, MINIO_BUCKET
from leveling import UserStats, evaluate_user_level_and_badges
from datetime import datetime, timezone
from sqlalchemy import text
import httpx
import os
import uuid


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

    # Calculate total_projects dynamically from projects table (completed only)
    try:
        result = db.execute(
            text("""
                SELECT COUNT(*)::int AS cnt
                FROM projects
                WHERE freelancer_id = :uid AND LOWER(CAST(status AS TEXT)) = 'completed'
            """),
            {"uid": profile.user_id},
        )
        row = result.first()
        dynamic_completed = int(row.cnt) if row else 0
        setattr(profile, "total_projects", dynamic_completed)
    except Exception as exc:
        # If cross-service schema or permission issue, keep existing value
        print(f"enrich_profile: failed to compute total_projects dynamically for user {profile.user_id}: {exc}")

    # Auto-calculate badges when đủ điều kiện:
    # - level >= 10
    # - có trên 10 dự án hoàn thành (total_projects > 10)
    try:
        completed_projects = getattr(profile, "total_projects", 0) or 0
        if level >= 10 and completed_projects > 10:
            # account age (ngày)
            created_at = getattr(profile, "created_at", None)
            if isinstance(created_at, datetime):
                now = datetime.now(timezone.utc) if created_at.tzinfo else datetime.utcnow()
                age_days = max(0, (now - created_at).days)
            else:
                age_days = 0

            stats = UserStats(
                user_id=profile.user_id,
                role="freelancer",
                total_revenue=float(getattr(profile, "total_revenue", 0.0) or 0.0),
                completed_projects=int(completed_projects),
                rating=float(profile.rating or 0.0),
                total_reviews=int(profile.total_reviews or 0),
                on_time_delivery_rate=float(getattr(profile, "on_time_delivery_rate", 0.0) or 0.0),
                cancel_rate=float(getattr(profile, "cancel_rate", 0.0) or 0.0),
                dispute_rate=float(getattr(profile, "dispute_rate", 0.0) or 0.0),
                repeat_client_ratio=float(getattr(profile, "repeat_client_ratio", 0.0) or 0.0),
                account_age_days=int(age_days),
                response_time_label=getattr(profile, "response_time_label", None) or None,
                total_stars=float(total_stars),
                level=int(level),
            )
            evaluation = evaluate_user_level_and_badges(stats)
            new_badges = evaluation.get("badges", []) or []

            # Gộp danh hiệu mới với danh hiệu cũ (không trùng lặp)
            existing = profile.badges or []
            merged = list(dict.fromkeys(list(existing) + new_badges))
            
            # Sắp xếp badges theo độ ưu tiên (Top Rated luôn đầu tiên)
            BADGE_PRIORITY = {
                "perfect_rating": 1,
                "top_rated": 2,
                "star_master_legend": 3,
                "project_master_legend": 4,
                "level_champion_legend": 5,
                "review_king_legend": 6,
                "high_earner": 7,
                "client_favorite": 8,
                "super_fast_response": 9,
                "fast_response": 10,
                "fast_delivery": 11,
                "reliable_partner": 12,
                "star_master_expert": 13,
                "project_master_expert": 14,
                "level_champion_expert": 15,
                "review_king_expert": 16,
                "star_master_pro": 17,
                "project_master_pro": 18,
                "level_champion_pro": 19,
                "star_master": 20,
                "project_master": 21,
                "level_champion": 22,
                "star_achiever": 23,
                "review_king": 24,
                "rising_star": 25,
                "veteran": 26,
                "rising_talent": 27,
            }
            
            # Extract level badges và sort riêng
            level_badges = [b for b in merged if b.startswith("level_")]
            other_badges = [b for b in merged if not b.startswith("level_")]
            
            # Sort other badges by priority
            other_badges.sort(key=lambda b: BADGE_PRIORITY.get(b, 999))
            
            # Level badges sort by level number (level_5 > level_4 > ...)
            level_badges.sort(key=lambda b: int(b.split("_")[1]) if b.split("_")[1].isdigit() else 0, reverse=True)
            
            # Combine: other badges first, then level badges
            profile.badges = other_badges + level_badges
            db.commit()
            db.refresh(profile)
    except Exception as exc:
        # Không crash nếu có lỗi, chỉ log nhẹ
        print(f"enrich_profile leveling error for profile {profile.id}: {exc}")

    return profile


def package_to_response(package, db: Session, include_profile: bool = False):
    if not package:
        return None

    data = {
        "id": package.id,
        "profile_id": package.profile_id,
        "name": package.name,
        "description": package.description,
        "price": package.price,
        "deliverables": package.deliverables or [],
        "revisions": package.revisions,
        "delivery_days": package.delivery_days,
        "category": package.category,
        "tags": package.tags or [],
        "requirements": package.requirements or [],
        "faq": package.faq or [],
        "cover_image": package.cover_image,
        "gallery": package.gallery or [],
        "is_active": package.status == PackageStatus.APPROVED.value,
        "status": package.status,
        "rejection_reason": package.rejection_reason,
        "created_at": package.created_at,
        "updated_at": package.updated_at,
        "rating": package.rating or 0.0,
        "total_reviews": package.total_reviews or 0,
    }

    if include_profile and package.profile:
        enriched = enrich_profile(db, package.profile)
        data["profile"] = ProfileResponse.model_validate(enriched)

    return data


def ensure_package_ready_for_submission(package):
    missing = []
    if not package.name:
        missing.append("name")
    if not package.description:
        missing.append("description")
    if package.price is None or package.price <= 0:
        missing.append("price")
    if not package.delivery_days or package.delivery_days <= 0:
        missing.append("delivery_days")
    if not package.deliverables:
        missing.append("deliverables")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gói dịch vụ thiếu thông tin: {', '.join(missing)}"
        )


router = APIRouter(prefix="/api/v1/users", tags=["users"])
services_router = APIRouter(prefix="/api/v1/services", tags=["services"])

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
        # Auto-create profile - lấy name từ auth service
        default_name = None
        if account and account.get("id") == user_id:
            default_name = account.get("name") or account.get("display_name")
        
        # Nếu không có từ account, lấy từ auth service
        if not default_name:
            try:
                auth_response = httpx.get(
                    f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}",
                    timeout=5.0
                )
                if auth_response.status_code == 200:
                    auth_user = auth_response.json()
                    default_name = auth_user.get("name")
            except Exception as exc:
                print(f"Warning: failed to get auth data for user {user_id}: {exc}")
        
        profile = create_profile(db, user_id, display_name=default_name)
    
    # Sync dữ liệu từ auth service nếu profile thiếu thông tin hoặc có tên mặc định
    needs_sync = (
        not profile.email or 
        not profile.phone or 
        not profile.headline or 
        not profile.display_name or
        (profile.display_name and (profile.display_name.startswith("Freelancer #") or profile.display_name.startswith("User #")))
    )
    if needs_sync:
        try:
            auth_response = httpx.get(
                f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}",
                timeout=5.0
            )
            if auth_response.status_code == 200:
                auth_user = auth_response.json()
                updated = False
                # Cập nhật nếu thiếu
                if not profile.email and auth_user.get("email"):
                    profile.email = auth_user.get("email")
                    updated = True
                if not profile.phone and auth_user.get("phone"):
                    profile.phone = auth_user.get("phone")
                    updated = True
                if not profile.headline and auth_user.get("headline"):
                    profile.headline = auth_user.get("headline")
                    updated = True
                # Cập nhật display_name nếu thiếu hoặc là tên mặc định
                auth_name = auth_user.get("name")
                if auth_name and (
                    not profile.display_name or 
                    profile.display_name.startswith("Freelancer #") or 
                    profile.display_name.startswith("User #")
                ):
                    profile.display_name = auth_name
                    updated = True
                if updated:
                    db.commit()
                    db.refresh(profile)
        except Exception as exc:
            # Không crash nếu không lấy được dữ liệu từ auth service
            print(f"Warning: failed to sync auth data for user {user_id}: {exc}")
    
    # Lấy role từ auth service để thêm vào response
    user_role = None
    try:
        auth_response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}",
            timeout=5.0
        )
        if auth_response.status_code == 200:
            auth_user = auth_response.json()
            user_role = auth_user.get("role")
    except Exception as exc:
        # Fallback to account role if available
        if account and account.get("id") == user_id:
            user_role = account.get("role")
    
    enriched = enrich_profile(db, profile)
    # Thêm role vào response
    if user_role:
        setattr(enriched, "role", user_role)
    
    return enriched


@router.put("/{user_id}", response_model=ProfileResponse)
def update_user_profile(
    user_id: int,
    profile_data: ProfileBase,
    db: Session = Depends(get_db),
    account: dict = Depends(resolve_account)
):
    # Nếu profile chưa tồn tại, cho phép tạo mà không cần auth (để auth service có thể tạo khi signup)
    existing_profile = get_profile_by_user_id(db, user_id)
    if not existing_profile:
        # Tạo profile mới - lấy name từ profile_data hoặc auth service
        display_name = profile_data.display_name
        if not display_name:
            # Lấy từ auth service
            try:
                auth_response = httpx.get(
                    f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}",
                    timeout=5.0
                )
                if auth_response.status_code == 200:
                    auth_user = auth_response.json()
                    display_name = auth_user.get("name")
            except Exception as exc:
                print(f"Warning: failed to get auth data for user {user_id}: {exc}")
        
        profile = create_profile(
            db,
            user_id,
            display_name=display_name
        )
        # Cập nhật các field từ profile_data
        for key, value in profile_data.dict(exclude_unset=True).items():
            if value is not None:
                setattr(profile, key, value)
        db.commit()
        db.refresh(profile)
    else:
        # Nếu profile đã tồn tại, cần auth và kiểm tra quyền
        ensure_owner_or_admin(account, user_id)
        profile = update_profile(
            db,
            user_id,
            default_display_name=account.get("name") if account else None,
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


@router.post("/{user_id}/packages/media", status_code=status.HTTP_201_CREATED)
def upload_package_media(
    user_id: int,
    file: UploadFile = File(...),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File upload is empty")
    safe_name = file.filename or "upload.bin"
    object_name = f"service-packages/{user_id}/{uuid.uuid4().hex}_{safe_name}"
    url = upload_file(MINIO_BUCKET, object_name, file_bytes, file.content_type or "application/octet-stream")
    return {"url": url}


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
        profile = create_profile(db, user_id, display_name=account.get("name") if account else None)
    
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


# Backward compatibility route
@router.post("/{user_id}/package", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{user_id}/services", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
def create_service_package(
    user_id: int,
    package: PackageCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        profile = create_profile(db, user_id, display_name=account.get("name") if account else None)
    
    # Tính level và total_stars (tương tự như trong enrich_profile)
    packages = get_packages(db, profile.id, active_only=False)
    total_stars = (profile.rating or 0) * (profile.total_reviews or 0)
    level = max(1, int(total_stars // 100) + 1)
    
    # Tính giới hạn service
    service_limit = calculate_service_limit(level, total_stars)
    
    # Đếm số service hiện tại (không bao gồm draft)
    current_service_count = count_total_packages(db, profile.id, include_draft=False)
    
    # Kiểm tra giới hạn
    if current_service_count >= service_limit:
        # Tính next tier để hiển thị thông báo hấp dẫn
        next_level_tier = ((level // 5) + 1) * 5
        next_star_tier = ((int(total_stars) // 25) + 1) * 25
        next_limit = calculate_service_limit(next_level_tier, next_star_tier)
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": f"Bạn đã đạt giới hạn số gói dịch vụ ({current_service_count}/{service_limit}).",
                "current_limit": service_limit,
                "current_count": current_service_count,
                "level": level,
                "total_stars": total_stars,
                "next_tier": {
                    "level": next_level_tier,
                    "stars": next_star_tier,
                    "new_limit": next_limit,
                    "bonus": next_limit - service_limit
                },
                "hint": f"Đạt level {next_level_tier} hoặc {next_star_tier} sao để được thêm {next_limit - service_limit} slot gói dịch vụ!"
            }
        )
    
    package_obj = create_package(
        db,
        profile.id,
        **package.dict()
    )
    return package_to_response(package_obj, db)


@router.get("/{user_id}/packages", response_model=list[PackageResponse])
def get_user_packages(
    user_id: int,
    include_all: bool = False,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    profile = get_profile_by_user_id(db, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    normalized_status = None
    if status_filter:
        normalized_status = status_filter.lower()
        valid_values = {status.value for status in PackageStatus}
        if normalized_status not in valid_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
    if include_all or (normalized_status and normalized_status != PackageStatus.APPROVED.value):
        ensure_owner_or_admin(account, user_id)
    packages = get_packages(
        db,
        profile.id,
        active_only=not include_all,
        status=normalized_status
    )
    return [package_to_response(pkg, db) for pkg in packages]


@router.put("/{user_id}/packages/{package_id}", response_model=PackageResponse)
def update_service_package(
    user_id: int,
    package_id: int,
    payload: PackageUpdate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    package_obj = get_package_by_id(db, package_id)
    if not package_obj or package_obj.profile is None or package_obj.profile.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    updated = update_package(db, package_obj, **payload.dict(exclude_unset=True))
    return package_to_response(updated, db)


@router.post("/{user_id}/packages/{package_id}/submit", response_model=PackageResponse)
def submit_package_for_review(
    user_id: int,
    package_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    ensure_owner_or_admin(account, user_id)
    package_obj = get_package_by_id(db, package_id)
    if not package_obj or package_obj.profile is None or package_obj.profile.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    if package_obj.status == PackageStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Package is already published"
        )
    if package_obj.status == PackageStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Package is already pending review"
        )
    ensure_package_ready_for_submission(package_obj)
    updated = update_package(
        db,
        package_obj,
        status=PackageStatus.PENDING.value,
        rejection_reason=None,
        is_active=False
    )
    return package_to_response(updated, db)


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
    sort: str = "recent",
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
            offset=offset,
            sort=sort
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


PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://project-service:8000")
@router.post("/{user_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review_endpoint(
    user_id: int,
    review: ReviewCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    # Ensure authenticated and path user_id matches logged in user
    if not account or account.get("id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản chủ dự án mới được gửi đánh giá."
        )

    project_id = review.project_id
    if project_id:
        # Verify project belongs to this client and is completed
        try:
            resp = httpx.get(
                f"{PROJECT_SERVICE_URL}/api/v1/projects/{project_id}",
                timeout=5.0
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không thể kiểm tra thông tin dự án: {exc}"
            )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dự án không tồn tại."
            )
        project = resp.json()
        if project.get("client_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn chỉ có thể đánh giá các dự án của chính mình."
            )
        status_value = str(project.get("status") or "").upper()
        if status_value != "COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chỉ có thể đánh giá sau khi dự án đã hoàn thành."
            )

        # Prevent duplicate reviews for the same project & reviewee
        existing = db.query(Review).filter(
            Review.reviewer_id == user_id,
            Review.reviewee_id == review.reviewee_id,
            Review.project_id == project_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn đã đánh giá freelancer cho dự án này rồi."
            )

    if review.reviewee_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự đánh giá chính mình."
        )

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
        profile = create_profile(db, user_id, display_name=account.get("name") if account else None)
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


@services_router.get("", response_model=list[ServiceResponse])
def list_service_packages(
    status_filter: str = PackageStatus.APPROVED.value,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    max_delivery_days: Optional[int] = None,
    min_rating: Optional[float] = None,
    tags: Optional[str] = None,
    query: Optional[str] = None,
    sort: str = "recent",
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    categories = None
    if category:
        categories = [c.strip() for c in category.split(",") if c.strip()]
    normalized_tags = None
    if tags:
        normalized_tags = [t.strip() for t in tags.split(",") if t.strip()]
    packages = search_service_packages(
        db,
        status=status_filter,
        categories=categories,
        min_price=min_price,
        max_price=max_price,
        max_delivery_days=max_delivery_days,
        min_rating=min_rating,
        tags=normalized_tags,
        sort=sort,
        query_text=query,
        limit=limit,
        offset=offset
    )
    return [package_to_response(pkg, db, include_profile=True) for pkg in packages]


@services_router.get("/{service_id}", response_model=ServiceResponse)
def get_service_detail(service_id: int, db: Session = Depends(get_db)):
    package = get_package_by_id(db, service_id)
    if not package or package.status != PackageStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    return package_to_response(package, db, include_profile=True)


@services_router.post("/{service_id}/approve", response_model=ServiceResponse)
def approve_service_package(
    service_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account or account.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    package = get_package_by_id(db, service_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    approved_count = count_packages_by_status(db, package.profile_id, PackageStatus.APPROVED.value)
    if package.status != PackageStatus.APPROVED.value and approved_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Freelancer đã có tối đa 3 gói đang xuất bản"
        )
    ensure_package_ready_for_submission(package)
    updated = update_package(
        db,
        package,
        status=PackageStatus.APPROVED.value,
        rejection_reason=None,
        is_active=True
    )
    return package_to_response(updated, db, include_profile=True)


@services_router.post("/{service_id}/reject", response_model=ServiceResponse)
def reject_service_package(
    service_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account or account.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    package = get_package_by_id(db, service_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    updated = update_package(
        db,
        package,
        status=PackageStatus.REJECTED.value,
        rejection_reason=reason or "Gói không đạt yêu cầu",
        is_active=False
    )
    return package_to_response(updated, db, include_profile=True)


@services_router.post("/{service_id}/hide", response_model=ServiceResponse)
def hide_service_package(
    service_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account or account.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    package = get_package_by_id(db, service_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    updated = update_package(
        db,
        package,
        status=PackageStatus.HIDDEN.value,
        rejection_reason=reason,
        is_active=False
    )
    return package_to_response(updated, db, include_profile=True)

