from __future__ import annotations

"""
Simple, centralized leveling & badge algorithm for users.

Usage example:

    from leveling import UserStats, evaluate_user_level_and_badges

    stats = UserStats(
        user_id=1,
        role="freelancer",
        total_revenue=50_000_000,
        completed_projects=25,
        rating=4.8,
        total_reviews=18,
        on_time_delivery_rate=0.9,
        cancel_rate=0.03,
        dispute_rate=0.0,
        repeat_client_ratio=0.35,
        account_age_days=220,
    )

    result = evaluate_user_level_and_badges(stats)
    # result = {
    #   "level": 3,
    #   "score": 178,
    #   "badges": ["top_rated", "fast_delivery"],
    #   "meta": {...}
    # }
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class UserStats:
    """Input metrics used for level / badge calculation."""

    user_id: int
    role: str  # "freelancer" | "client" | ...

    total_revenue: float = 0.0              # Tổng doanh thu (freelancer) hoặc tổng chi tiêu (client)
    completed_projects: int = 0
    rating: float = 0.0
    total_reviews: int = 0

    on_time_delivery_rate: float = 0.0      # 0.0–1.0
    cancel_rate: float = 0.0               # 0.0–1.0
    dispute_rate: float = 0.0              # 0.0–1.0
    repeat_client_ratio: float = 0.0       # tỷ lệ khách quay lại

    account_age_days: int = 0
    response_time_label: str = None         # "Phản hồi trong 30 phút", "1 giờ", etc.
    total_stars: float = 0.0                # rating * total_reviews
    level: int = 1                          # Level hiện tại của user


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def calculate_base_score(stats: UserStats) -> int:
    """
    Tính điểm tổng dựa trên nhiều yếu tố.

    Thang điểm tham khảo (~0–250):
      - Doanh thu: tối đa ~80 điểm
      - Số dự án: tối đa ~60 điểm
      - Rating: tối đa 50 điểm
      - Tỷ lệ giao đúng hạn: tối đa 25 điểm
      - Tỷ lệ hủy / tranh chấp: -30 điểm
      - Khách quay lại: tối đa 20 điểm
      - Tuổi tài khoản: tối đa 15 điểm
    """
    score = 0.0

    # 1. Doanh thu / chi tiêu (log scale để không quá thiên vị user cực lớn)
    revenue_millions = stats.total_revenue / 1_000_000.0
    if revenue_millions > 0:
        # log-like but simpler: sqrt + cap
        revenue_score = clamp(revenue_millions ** 0.5 * 10, 0, 80)
        score += revenue_score

    # 2. Số dự án hoàn thành
    project_score = clamp(stats.completed_projects * 2.5, 0, 60)
    score += project_score

    # 3. Rating trung bình
    rating_normalized = clamp(stats.rating, 0, 5) / 5.0  # 0–1
    rating_score = rating_normalized * 50
    score += rating_score

    # 4. Giao đúng hạn
    on_time = clamp(stats.on_time_delivery_rate, 0.0, 1.0)
    score += on_time * 25

    # 5. Tỷ lệ hủy / tranh chấp (phạt điểm)
    cancel_penalty = clamp(stats.cancel_rate, 0.0, 1.0) * 20
    dispute_penalty = clamp(stats.dispute_rate, 0.0, 1.0) * 30
    score -= (cancel_penalty + dispute_penalty)

    # 6. Khách quay lại
    repeat_score = clamp(stats.repeat_client_ratio, 0.0, 1.0) * 20
    score += repeat_score

    # 7. Tuổi tài khoản
    age_score = clamp(stats.account_age_days / 365.0 * 15, 0, 15)
    score += age_score

    # 8. Bonus nhỏ theo số lượng review (chống spam 1 review 5* đã top)
    review_bonus = clamp(stats.total_reviews * 1.5, 0, 25)
    score += review_bonus

    return int(round(score))


def score_to_level(score: int) -> int:
    """
    Map điểm sang level.

    Gợi ý:
      - 0–49   -> level 1
      - 50–99  -> level 2
      - 100–149 -> level 3
      - 150–199 -> level 4
      - 200+   -> level 5
    """
    if score >= 200:
        return 5
    if score >= 150:
        return 4
    if score >= 100:
        return 3
    if score >= 50:
        return 2
    return 1


def assign_badges(stats: UserStats, score: int, level: int) -> List[str]:
    """
    Gán danh hiệu (badge) đơn giản dựa trên stats + level.
    Trả về danh sách mã badge (string) để lưu DB / render front-end.
    """
    badges: List[str] = []

    # Top Rated - Đánh giá cao với đủ reviews và dự án
    if stats.rating >= 4.8 and stats.total_reviews >= 15 and stats.completed_projects >= 10:
        badges.append("top_rated")

    # Perfect Rating - Rating hoàn hảo 5.0 với đủ reviews
    if stats.rating >= 4.95 and stats.total_reviews >= 20:
        badges.append("perfect_rating")

    # Rising Talent - Tài năng mới nổi
    if stats.account_age_days <= 90 and stats.completed_projects >= 3 and stats.rating >= 4.5:
        badges.append("rising_talent")

    # Fast Response - Phản hồi nhanh (dựa trên response_time_label)
    if stats.response_time_label:
        response_lower = stats.response_time_label.lower()
        if "30 phút" in response_lower or "1 giờ" in response_lower:
            if stats.completed_projects >= 5:
                badges.append("fast_response")
        # Super Fast Response - phản hồi trong 30 phút
        if "30 phút" in response_lower and stats.completed_projects >= 10:
            badges.append("super_fast_response")

    # Fast Delivery - Giao hàng đúng hạn
    if stats.on_time_delivery_rate >= 0.9 and stats.completed_projects >= 5:
        badges.append("fast_delivery")

    # Reliable Partner - Đối tác đáng tin cậy
    if stats.cancel_rate <= 0.02 and stats.dispute_rate == 0 and stats.completed_projects >= 8:
        badges.append("reliable_partner")

    # Client's Favorite - Nhiều khách quay lại
    if stats.repeat_client_ratio >= 0.3 and stats.completed_projects >= 10:
        badges.append("client_favorite")

    # High Revenue - Doanh thu cao
    if stats.total_revenue >= 100_000_000:
        badges.append("high_earner")

    # Star Master - Nhiều sao (dựa trên total_stars)
    if stats.total_stars >= 500:
        badges.append("star_master_legend")  # 500+ sao
    elif stats.total_stars >= 300:
        badges.append("star_master_expert")  # 300-499 sao
    elif stats.total_stars >= 200:
        badges.append("star_master_pro")    # 200-299 sao
    elif stats.total_stars >= 100:
        badges.append("star_master")        # 100-199 sao
    elif stats.total_stars >= 50:
        badges.append("star_achiever")      # 50-99 sao

    # Project Master - Nhiều dự án hoàn thành
    if stats.completed_projects >= 200:
        badges.append("project_master_legend")  # 200+ dự án
    elif stats.completed_projects >= 100:
        badges.append("project_master_expert")  # 100-199 dự án
    elif stats.completed_projects >= 50:
        badges.append("project_master_pro")     # 50-99 dự án
    elif stats.completed_projects >= 25:
        badges.append("project_master")         # 25-49 dự án

    # Level Champion - Level cao
    if level >= 50:
        badges.append("level_champion_legend")  # Level 50+
    elif level >= 30:
        badges.append("level_champion_expert")  # Level 30-49
    elif level >= 20:
        badges.append("level_champion_pro")     # Level 20-29
    elif level >= 15:
        badges.append("level_champion")        # Level 15-19

    # Review King - Nhiều review
    if stats.total_reviews >= 200:
        badges.append("review_king_legend")  # 200+ reviews
    elif stats.total_reviews >= 100:
        badges.append("review_king_expert")  # 100-199 reviews
    elif stats.total_reviews >= 50:
        badges.append("review_king")          # 50-99 reviews

    # Rising Star - Level tăng nhanh trong thời gian ngắn
    if level >= 10 and stats.account_age_days <= 180 and stats.completed_projects >= 15:
        badges.append("rising_star")

    # Veteran - Tài khoản lâu năm với nhiều kinh nghiệm
    if stats.account_age_days >= 365 and stats.completed_projects >= 30:
        badges.append("veteran")

    # Level-based generic badge
    badges.append(f"level_{level}")

    # Loại bỏ trùng lặp (nếu có)
    return list(dict.fromkeys(badges))


def evaluate_user_level_and_badges(stats: UserStats) -> Dict[str, Any]:
    """
    API chính: từ UserStats -> level, score, badges, meta.

    Trả về:
      {
        "level": int,
        "score": int,
        "badges": [str, ...],
        "meta": { ... }  # chi tiết từng thành phần điểm để debug / analytics
      }
    """
    score = calculate_base_score(stats)
    level = score_to_level(score)
    badges = assign_badges(stats, score, level)

    return {
        "level": level,
        "score": score,
        "badges": badges,
        "meta": asdict(stats),
    }


__all__ = [
    "UserStats",
    "calculate_base_score",
    "score_to_level",
    "assign_badges",
    "evaluate_user_level_and_badges",
]


