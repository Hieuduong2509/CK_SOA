"""
Script to migrate existing profiles to use names from auth service
instead of default "Freelancer #X" or "User #X"
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from crud import get_profile_by_user_id, update_profile
from models import Profile
import httpx

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")

def migrate_profiles():
    db = SessionLocal()
    try:
        # Get all profiles
        profiles = db.query(Profile).all()
        print(f"Found {len(profiles)} profiles to check")
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for profile in profiles:
            try:
                # Check if display_name is a default name
                if profile.display_name and (
                    profile.display_name.startswith("Freelancer #") or 
                    profile.display_name.startswith("User #")
                ):
                    # Get name from auth service
                    try:
                        auth_response = httpx.get(
                            f"{AUTH_SERVICE_URL}/api/v1/auth/users/{profile.user_id}",
                            timeout=5.0
                        )
                        if auth_response.status_code == 200:
                            auth_user = auth_response.json()
                            auth_name = auth_user.get("name")
                            if auth_name:
                                profile.display_name = auth_name
                                # Also sync other fields if missing
                                if not profile.email and auth_user.get("email"):
                                    profile.email = auth_user.get("email")
                                if not profile.phone and auth_user.get("phone"):
                                    profile.phone = auth_user.get("phone")
                                if not profile.headline and auth_user.get("headline"):
                                    profile.headline = auth_user.get("headline")
                                db.commit()
                                print(f"✓ Updated profile {profile.user_id}: {profile.display_name}")
                                updated_count += 1
                            else:
                                print(f"⚠ No name found in auth service for user {profile.user_id}")
                                skipped_count += 1
                        else:
                            print(f"⚠ Auth service returned {auth_response.status_code} for user {profile.user_id}")
                            skipped_count += 1
                    except Exception as e:
                        print(f"✗ Error fetching auth data for user {profile.user_id}: {e}")
                        error_count += 1
                else:
                    # Profile already has a proper name
                    skipped_count += 1
            except Exception as e:
                print(f"✗ Error processing profile {profile.user_id}: {e}")
                error_count += 1
                db.rollback()
        
        print(f"\n=== Migration Summary ===")
        print(f"Updated: {updated_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Errors: {error_count}")
        print(f"Total: {len(profiles)}")
        
    except Exception as e:
        print(f"Fatal error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_profiles()

