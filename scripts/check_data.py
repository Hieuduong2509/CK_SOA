#!/usr/bin/env python3
"""
Script để kiểm tra dữ liệu freelancer trong database
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Database URLs - prefer Docker hostnames by default
AUTH_DB_URL = os.getenv("AUTH_DB_URL", "postgresql://postgres:postgres@postgres-auth:5432/auth_db")
MAIN_DB_URL = os.getenv("MAIN_DB_URL", "postgresql://postgres:postgres@postgres-main:5432/marketplace_db")

def check_auth_db():
    """Kiểm tra users trong auth_db"""
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'auth_service'))
        from models import User, UserRole
        
        engine = create_engine(AUTH_DB_URL)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        users = db.query(User).filter(User.role.in_([UserRole.FREELANCER])).all()
        print(f"\n✓ Auth DB - Tổng số Freelancer users: {len(users)}")
        for user in users:
            print(f"  - ID: {user.id}, Email: {user.email}, Name: {user.name}")
        
        db.close()
        return len(users)
    except Exception as e:
        print(f"✗ Lỗi kiểm tra auth_db: {e}")
        return 0

def check_main_db():
    """Kiểm tra profiles trong marketplace_db"""
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'user_service'))
        from models import Profile
        
        engine = create_engine(MAIN_DB_URL)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        profiles = db.query(Profile).all()
        print(f"\n✓ Main DB - Tổng số Profiles: {len(profiles)}")
        
        developers = []
        designers = []
        
        for profile in profiles:
            categories = (profile.categories or [])
            skills = (profile.skills or [])
            
            is_dev = any('web-development' in str(c).lower() or 'backend' in str(c).lower() or 'frontend' in str(c).lower() 
                        for c in categories) or any('python' in str(s).lower() or 'javascript' in str(s).lower() 
                        or 'react' in str(s).lower() for s in skills)
            
            is_design = any('design' in str(c).lower() or 'branding' in str(c).lower() 
                          for c in categories) or any('ui' in str(s).lower() or 'ux' in str(s).lower() 
                          or 'figma' in str(s).lower() for s in skills)
            
            if is_dev:
                developers.append(profile)
            if is_design:
                designers.append(profile)
            
            print(f"  - User ID: {profile.user_id}, Name: {profile.display_name}")
            print(f"    Categories: {categories}, Skills: {skills[:3]}")
            print(f"    Rating: {profile.rating}, Reviews: {profile.total_reviews}")
        
        print(f"\n📊 Phân loại:")
        print(f"  - Developers: {len(developers)}")
        print(f"  - Designers: {len(designers)}")
        
        db.close()
        return len(profiles)
    except Exception as e:
        print(f"✗ Lỗi kiểm tra main_db: {e}")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    print("=" * 60)
    print("KIỂM TRA DỮ LIỆU FREELANCER")
    print("=" * 60)
    
    auth_count = check_auth_db()
    main_count = check_main_db()
    
    print("\n" + "=" * 60)
    if auth_count == 0 or main_count == 0:
        print("⚠ CẢNH BÁO: Chưa có dữ liệu!")
        print("Chạy lệnh sau để seed dữ liệu:")
        print("  python scripts/seed_data.py")
    else:
        print(f"✓ Đã có {auth_count} freelancer users và {main_count} profiles")
    print("=" * 60)

