import pika
import json
from database import SessionLocal
from crud import create_notification
import os
import httpx

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:8000")


def get_user_name(user_id: int) -> str:
    """Get user display name from user service"""
    try:
        response = httpx.get(
            f"{USER_SERVICE_URL}/api/v1/users/{user_id}",
            timeout=3.0
        )
        if response.status_code == 200:
            profile = response.json()
            return profile.get("display_name") or profile.get("name") or f"User #{user_id}"
    except Exception as e:
        print(f"Error fetching user name for {user_id}: {e}")
    return f"User #{user_id}"


def get_project_title(project_id: int) -> str:
    """Get project title from project service"""
    try:
        response = httpx.get(
            f"http://project-service:8000/api/v1/projects/{project_id}",
            timeout=3.0
        )
        if response.status_code == 200:
            project = response.json()
            return project.get("title") or f"Dự án #{project_id}"
    except Exception as e:
        print(f"Error fetching project title for {project_id}: {e}")
    return f"Dự án #{project_id}"


def process_notification(ch, method, properties, body):
    try:
        event = json.loads(body)
        event_type = event.get("type")
        data = event.get("data", {})
        
        db = SessionLocal()
        try:
            # Handle different event types
            if event_type == "bid.created":
                client_id = data.get("client_id")
                freelancer_id = data.get("freelancer_id")
                project_id = data.get("project_id")
                
                if client_id:
                    freelancer_name = get_user_name(freelancer_id) if freelancer_id else "Một freelancer"
                    project_title = get_project_title(project_id) if project_id else "dự án của bạn"
                    
                    create_notification(
                        db,
                        user_id=client_id,
                        type="bid_received",
                        title="Có người apply vào dự án",
                        message=f"{freelancer_name} đã apply vào công việc {project_title}",
                        data=data
                    )
                    
            elif event_type == "bid.accepted":
                freelancer_id = data.get("freelancer_id")
                project_id = data.get("project_id")
                if freelancer_id:
                    project_title = get_project_title(project_id) if project_id else "dự án"
                    create_notification(
                        db,
                        user_id=freelancer_id,
                        type="project_accepted",
                        title="Dự án bắt đầu",
                        message=f"Dự án {project_title} đã bắt đầu! Bạn có thể bắt đầu làm việc.",
                        data=data
                    )
                    
            elif event_type == "project.created_from_gig":
                client_id = data.get("client_id")
                freelancer_id = data.get("freelancer_id")
                service_name = data.get("service_name") or "Gói dịch vụ"
                project_id = data.get("project_id")
                
                if client_id:
                    freelancer_name = get_user_name(freelancer_id) if freelancer_id else "Một freelancer"
                    create_notification(
                        db,
                        user_id=client_id,
                        type="service_purchased",
                        title="Đã mua gói dịch vụ",
                        message=f"Bạn đã mua gói dịch vụ {service_name} của {freelancer_name}",
                        data=data
                    )
                    
            elif event_type == "project.delivery_accepted":
                project_id = data.get("project_id")
                client_id = data.get("client_id")
                freelancer_id = data.get("freelancer_id")
                
                project_title = get_project_title(project_id) if project_id else "Dự án"
                
                # Notify both client and freelancer
                if client_id:
                    create_notification(
                        db,
                        user_id=client_id,
                        type="project_completed",
                        title="Dự án đã hoàn thành",
                        message=f"Dự án {project_title} đã được hoàn thành",
                        data=data
                    )
                    
                if freelancer_id:
                    create_notification(
                        db,
                        user_id=freelancer_id,
                        type="project_completed",
                        title="Dự án đã hoàn thành",
                        message=f"Dự án {project_title} đã được hoàn thành",
                        data=data
                    )
                    
            elif event_type == "milestone.submitted":
                client_id = data.get("client_id")
                if client_id:
                    create_notification(
                        db,
                        user_id=client_id,
                        type="milestone_submitted",
                        title="Milestone đã được gửi",
                        message="Freelancer đã gửi milestone để bạn xem xét",
                        data=data
                    )
                    
            elif event_type == "milestone.approved":
                freelancer_id = data.get("freelancer_id")
                if freelancer_id:
                    create_notification(
                        db,
                        user_id=freelancer_id,
                        type="payment_released",
                        title="Thanh toán đã được giải phóng",
                        message="Thanh toán của bạn đã được giải phóng",
                        data=data
                    )
                    
            # Note: chat.message notifications are handled by the messaging badge in navbar
            # No need to create notifications for chat messages
            # Add more event handlers as needed
        finally:
            db.close()
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"Error processing notification: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_worker():
    params = pika.URLParameters(RABBITMQ_URL)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue='events', durable=True)
    channel.basic_consume(queue='events', on_message_callback=process_notification)
    print("Notification worker started. Waiting for events...")
    channel.start_consuming()


if __name__ == "__main__":
    start_worker()

