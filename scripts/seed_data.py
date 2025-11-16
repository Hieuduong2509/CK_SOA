#!/usr/bin/env python3
"""
Seed script to populate database with sample data
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import hashlib
from passlib.context import CryptContext

# Import models from services
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    prehashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.hash(prehashed)

# Database URLs
AUTH_DB_URL = os.getenv("AUTH_DB_URL", "postgresql://postgres:postgres@localhost:5432/auth_db")
MAIN_DB_URL = os.getenv("MAIN_DB_URL", "postgresql://postgres:postgres@localhost:5432/marketplace_db")

def seed_auth_db():
    """Seed auth database with users"""
    import sys
    import os
    # Add service path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'auth_service'))
    
    from models import User, UserRole
    from database import Base as AuthBase
    
    engine = create_engine(AUTH_DB_URL)
    AuthBase.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    users = [
        {
            "email": "admin@codedesign.com",
            "password": "admin123",
            "name": "Admin User",
            "role": UserRole.ADMIN,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123450000",
            "headline": "System Administrator"
        },
        {
            "email": "freelancer1@codedesign.com",
            "password": "freelancer123",
            "name": "John Developer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123451111",
            "headline": "Full-stack Solution Architect"
        },
        {
            "email": "freelancer2@codedesign.com",
            "password": "freelancer123",
            "name": "Jane Designer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123452222",
            "headline": "Senior UI/UX & Branding Expert"
        },
        {
            "email": "client1@codedesign.com",
            "password": "client123",
            "name": "Client One",
            "role": UserRole.CLIENT,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123453333",
            "headline": "Product Owner"
        },
        {
            "email": "client2@codedesign.com",
            "password": "client123",
            "name": "Client Two",
            "role": UserRole.CLIENT,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123454444",
            "headline": "Startup Founder"
        },
        {
            "email": "freelancer3@codedesign.com",
            "password": "freelancer123",
            "name": "Linh Product",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84987654321",
            "headline": "Product Designer & No-code Builder"
        },
        {
            "email": "dev1@codedesign.com",
            "password": "freelancer123",
            "name": "Minh Backend",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234567",
            "headline": "Senior Backend Engineer"
        },
        {
            "email": "dev2@codedesign.com",
            "password": "freelancer123",
            "name": "Anh Frontend",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234568",
            "headline": "React & Vue.js Specialist"
        },
        {
            "email": "dev3@codedesign.com",
            "password": "freelancer123",
            "name": "Huy Fullstack",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234569",
            "headline": "Full-stack JavaScript Developer"
        },
        {
            "email": "designer1@codedesign.com",
            "password": "freelancer123",
            "name": "Lan UI Designer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234570",
            "headline": "UI Designer & Prototyping Expert"
        },
        {
            "email": "designer2@codedesign.com",
            "password": "freelancer123",
            "name": "Hoa Brand Designer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234571",
            "headline": "Brand Identity & Logo Designer"
        },
        {
            "email": "designer3@codedesign.com",
            "password": "freelancer123",
            "name": "Mai UX Researcher",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234572",
            "headline": "UX Researcher & Interaction Designer"
        }
    ]
    
    for user_data in users:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing:
            user = User(
                email=user_data["email"],
                password_hash=hash_password(user_data["password"]),
                name=user_data["name"],
                role=user_data["role"],
                is_verified=user_data.get("is_verified", False),
                is_email_verified=user_data.get("is_email_verified", False),
                phone=user_data.get("phone"),
                headline=user_data.get("headline")
            )
            db.add(user)
    
    db.commit()
    print("✓ Auth database seeded")
    db.close()


def seed_main_db():
    """Seed main database with profiles, projects, etc."""
    import sys
    import os
    # Add service paths
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'user_service'))
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'project_service'))
    
    from models import Profile, Package, Article
    from models import Article
    from database import Base as UserBase
    from services.project_service.models import Project, BudgetType, ProjectStatus
    
    engine = create_engine(MAIN_DB_URL)
    UserBase.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    # Create profiles for freelancers
    freelancer_profiles = [
        {
            "user_id": 2,
            "display_name": "John Developer",
            "email": "freelancer1@codedesign.com",
            "phone": "+84123451111",
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
            "email": "freelancer2@codedesign.com",
            "phone": "+84123452222",
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
            "email": "freelancer3@codedesign.com",
            "phone": "+84987654321",
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
            "email": "dev1@codedesign.com",
            "phone": "+84901234567",
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
            "email": "dev2@codedesign.com",
            "phone": "+84901234568",
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
            "email": "dev3@codedesign.com",
            "phone": "+84901234569",
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
            "email": "designer1@codedesign.com",
            "phone": "+84901234570",
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
            "email": "designer2@codedesign.com",
            "phone": "+84901234571",
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
            "email": "designer3@codedesign.com",
            "phone": "+84901234572",
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
            db.flush()  # Get profile.id
            
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

            articles = []
            if profile.user_id == 2:
                articles.extend([
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
                ])
            elif profile.user_id == 3:
                articles.extend([
                    Article(
                        profile_id=profile.id,
                        title="Checklist UI/UX giúp tăng 30% tỷ lệ chuyển đổi",
                        content="Bộ checklist UI/UX thực tiễn áp dụng cho landing page, ecommerce và ứng dụng di động.",
                        tags=["UI/UX", "Conversion", "Design"]
                    ),
                    Article(
                        profile_id=profile.id,
                        title="Branding playbook cho startup",
                        content="Các bước xây dựng thương hiệu chuyên nghiệp cho startup từ 0 đến 1.",
                        tags=["Branding", "Startup", "Design"]
                    )
                ])
            elif profile.user_id == 6:
                articles.extend([
                    Article(
                        profile_id=profile.id,
                        title="Từ idea đến MVP trong 14 ngày",
                        content="Cách tôi sử dụng no-code kết hợp backend microservice để dựng MVP siêu tốc.",
                        tags=["No-code", "MVP", "Product"]
                    ),
                    Article(
                        profile_id=profile.id,
                        title="Product Discovery mindset",
                        content="Các bước khám phá vấn đề và xác thực giải pháp trước khi build sản phẩm.",
                        tags=["Product", "Discovery", "UX"]
                    )
                ])
            for article in articles:
                db.add(article)
    
    db.commit()

    # Seed sample projects
    sample_projects = [
        Project(
            client_id=4,
            title="Thiết kế landing page fintech",
            description="Cần thiết kế landing page hiện đại cho sản phẩm fintech, bao gồm UI responsive và assets cơ bản.",
            budget_type=BudgetType.FIXED,
            budget=800.0,
            skills_required=["UI/UX", "Figma", "Landing Page"],
            attachments=[],
            category="design",
            tags=["fintech", "landing-page"],
            status=ProjectStatus.OPEN
        ),
        Project(
            client_id=5,
            title="Xây dựng API microservice cho hệ thống đặt vé",
            description="Cần developer backend xây dựng microservice xử lý booking, kèm tài liệu OpenAPI.",
            budget_type=BudgetType.FIXED,
            budget=1500.0,
            skills_required=["Python", "FastAPI", "PostgreSQL"],
            attachments=[],
            category="web-development",
            tags=["microservices", "booking"],
            status=ProjectStatus.OPEN
        )
    ]

    for project in sample_projects:
        existing = db.query(Project).filter(Project.title == project.title).first()
        if not existing:
            db.add(project)

    db.commit()
    print("✓ Main database seeded")
    db.close()


if __name__ == "__main__":
    print("Seeding databases...")
    seed_auth_db()
    seed_main_db()
    print("✓ Seeding complete!")
    print("\nDefault credentials:")
    print("Admin: admin@codedesign.com / admin123")
    print("Freelancer: freelancer1@codedesign.com / freelancer123")
    print("Client: client1@codedesign.com / client123")

