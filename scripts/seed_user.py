#!/usr/bin/env python3
"""
Seed user service database - run from user-service container
Only seeds profiles, packages, articles (no projects)
"""
import sys
import os

# Add service path - in container /app is the service root
sys.path.insert(0, '/app')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Profile, Package, Article
from database import Base

# Database URL from environment
MAIN_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres-main:5432/marketplace_db")

def seed_main_db():
    """Seed main database with profiles, packages, articles"""
    engine = create_engine(MAIN_DB_URL)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    # Create profiles for freelancers
    freelancer_profiles = [
        {
            "user_id": 2,
            "display_name": "John Developer",
            "headline": "Full-stack Engineer & Solution Architect",
            "bio": "Experienced full-stack developer specializing in Python and React",
            "skills": ["Python", "React", "Node.js", "PostgreSQL"],
            "location": "San Francisco, CA",
            "categories": ["web-development", "backend"],
            "badges": ["Top Rated", "Fast Response", "Premium"],
            "response_time_label": "Phản hồi trong 1 giờ",
            "experience_level": "senior",
            "hourly_rate": 60.0,
            "languages": ["English", "Vietnamese"],
            "rating": 4.8,
            "total_reviews": 42,
            "total_projects": 58
        },
        {
            "user_id": 3,
            "display_name": "Jane Designer",
            "headline": "Senior UI/UX Designer & Branding Expert",
            "bio": "Creative UI/UX designer with 5+ years of experience",
            "skills": ["UI/UX", "Figma", "Photoshop", "Illustrator"],
            "location": "New York, NY",
            "categories": ["design", "branding"],
            "badges": ["Top Rated", "Premium"],
            "response_time_label": "Phản hồi trong 2 giờ",
            "experience_level": "mid",
            "hourly_rate": 48.0,
            "languages": ["English"],
            "rating": 4.9,
            "total_reviews": 67,
            "total_projects": 80
        },
        {
            "user_id": 6,
            "display_name": "Linh Product",
            "headline": "Product Designer & No-code Builder",
            "bio": "Builds MVPs rapidly using modern no-code stacks integrated with robust backend APIs.",
            "skills": ["Product Design", "No-code", "Bubble", "FastAPI"],
            "location": "Singapore",
            "categories": ["product", "web-development"],
            "badges": ["Fast Response", "Customer Favorite"],
            "response_time_label": "Phản hồi trong 30 phút",
            "experience_level": "senior",
            "hourly_rate": 70.0,
            "languages": ["English", "Vietnamese"],
            "rating": 4.7,
            "total_reviews": 55,
            "total_projects": 45
        },
        {
            "user_id": 7,
            "display_name": "Minh Backend",
            "headline": "Senior Backend Engineer",
            "bio": "Chuyên gia backend với 8+ năm kinh nghiệm xây dựng hệ thống scalable, microservices architecture.",
            "skills": ["Python", "Django", "PostgreSQL", "Redis", "Docker", "Kubernetes"],
            "location": "Hồ Chí Minh, Việt Nam",
            "categories": ["backend", "web-development"],
            "badges": ["Top Rated", "Premium"],
            "response_time_label": "Phản hồi trong 2 giờ",
            "experience_level": "senior",
            "hourly_rate": 65.0,
            "languages": ["Vietnamese", "English"],
            "rating": 4.9,
            "total_reviews": 89,
            "total_projects": 120
        },
        {
            "user_id": 8,
            "display_name": "Anh Frontend",
            "headline": "React & Vue.js Specialist",
            "bio": "Frontend developer chuyên về React, Vue.js và modern JavaScript frameworks. Tạo ra UI/UX mượt mà và responsive.",
            "skills": ["React", "Vue.js", "TypeScript", "Next.js", "Tailwind CSS"],
            "location": "Hà Nội, Việt Nam",
            "categories": ["frontend", "web-development"],
            "badges": ["Fast Response", "Top Rated"],
            "response_time_label": "Phản hồi trong 1 giờ",
            "experience_level": "mid",
            "hourly_rate": 50.0,
            "languages": ["Vietnamese", "English"],
            "rating": 4.8,
            "total_reviews": 72,
            "total_projects": 95
        },
        {
            "user_id": 9,
            "display_name": "Huy Fullstack",
            "headline": "Full-stack JavaScript Developer",
            "bio": "Full-stack developer với expertise trong MERN stack (MongoDB, Express, React, Node.js). Xây dựng ứng dụng web end-to-end.",
            "skills": ["Node.js", "React", "MongoDB", "Express", "JavaScript", "REST API"],
            "location": "Đà Nẵng, Việt Nam",
            "categories": ["web-development", "backend", "frontend"],
            "badges": ["Top Rated", "Fast Response", "Premium"],
            "response_time_label": "Phản hồi trong 1 giờ",
            "experience_level": "senior",
            "hourly_rate": 58.0,
            "languages": ["Vietnamese", "English"],
            "rating": 4.85,
            "total_reviews": 95,
            "total_projects": 110
        },
        {
            "user_id": 10,
            "display_name": "Lan UI Designer",
            "headline": "UI Designer & Prototyping Expert",
            "bio": "UI Designer chuyên tạo ra giao diện đẹp mắt, hiện đại và user-friendly. Expert trong Figma và prototyping.",
            "skills": ["UI Design", "Figma", "Prototyping", "Design System", "Adobe XD"],
            "location": "Hồ Chí Minh, Việt Nam",
            "categories": ["design", "ui"],
            "badges": ["Top Rated", "Fast Response"],
            "response_time_label": "Phản hồi trong 2 giờ",
            "experience_level": "mid",
            "hourly_rate": 45.0,
            "languages": ["Vietnamese", "English"],
            "rating": 4.9,
            "total_reviews": 68,
            "total_projects": 85
        },
        {
            "user_id": 11,
            "display_name": "Hoa Brand Designer",
            "headline": "Brand Identity & Logo Designer",
            "bio": "Chuyên gia thiết kế thương hiệu và logo. Tạo ra brand identity độc đáo, ấn tượng cho doanh nghiệp và startup.",
            "skills": ["Branding", "Logo Design", "Illustrator", "Photoshop", "Brand Strategy"],
            "location": "Hà Nội, Việt Nam",
            "categories": ["branding", "design"],
            "badges": ["Premium", "Top Rated"],
            "response_time_label": "Phản hồi trong 3 giờ",
            "experience_level": "senior",
            "hourly_rate": 55.0,
            "languages": ["Vietnamese", "English"],
            "rating": 4.95,
            "total_reviews": 105,
            "total_projects": 130
        },
        {
            "user_id": 12,
            "display_name": "Mai UX Researcher",
            "headline": "UX Researcher & Interaction Designer",
            "bio": "UX Researcher và Interaction Designer với background về psychology và user behavior. Tối ưu hóa trải nghiệm người dùng dựa trên data và research.",
            "skills": ["UX Research", "User Testing", "Wireframing", "Figma", "User Journey"],
            "location": "Hồ Chí Minh, Việt Nam",
            "categories": ["ux", "design"],
            "badges": ["Top Rated", "Customer Favorite"],
            "response_time_label": "Phản hồi trong 2 giờ",
            "experience_level": "senior",
            "hourly_rate": 60.0,
            "languages": ["Vietnamese", "English"],
            "rating": 4.88,
            "total_reviews": 78,
            "total_projects": 92
        }
    ]
    
    for profile_data in freelancer_profiles:
        existing = db.query(Profile).filter(Profile.user_id == profile_data["user_id"]).first()
        if not existing:
            profile = Profile(**profile_data)
            db.add(profile)
            db.flush()
            
            # Add packages
            packages = [
                Package(
                    profile_id=profile.id,
                    name="Starter",
                    description="Kick-off consultation & prototype",
                    price=450.0,
                    deliverables=["1 workshop", "Prototype", "Implementation roadmap"],
                    revisions=1,
                    delivery_days=5
                ),
                Package(
                    profile_id=profile.id,
                    name="Professional",
                    description="End-to-end build for core features",
                    price=1200.0,
                    deliverables=["Full implementation", "Documentation", "Testing"],
                    revisions=3,
                    delivery_days=14
                ),
                Package(
                    profile_id=profile.id,
                    name="Premium",
                    description="Scale-up package with dedicated support",
                    price=2200.0,
                    deliverables=["Full implementation", "Documentation", "CI/CD", "60-day support"],
                    revisions=5,
                    delivery_days=25
                )
            ]
            for pkg in packages:
                db.add(pkg)
            
            # Add articles (simplified - only for first 3 freelancers)
            if profile.user_id == 2:
                articles = [
                    Article(
                        profile_id=profile.id,
                        title="Xây dựng nền tảng SaaS trong 90 ngày",
                        content="Chia sẻ quy trình, công nghệ và bài học kinh nghiệm khi phát triển nền tảng SaaS cho khách hàng doanh nghiệp.",
                        tags=["SaaS", "Cloud", "Microservices"]
                    ),
                    Article(
                        profile_id=profile.id,
                        title="Checklist DevOps để scale microservice",
                        content="Kinh nghiệm triển khai CI/CD, monitoring và scaling cho hệ thống microservice.",
                        tags=["DevOps", "CI/CD", "Kubernetes"]
                    )
                ]
                for article in articles:
                    db.add(article)
    
    db.commit()
    print("✓ Main database seeded")
    db.close()

if __name__ == "__main__":
    print("Seeding user service database...")
    seed_main_db()
    print("✓ Complete!")

