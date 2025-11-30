import pika
import json
from datetime import datetime
import os
import httpx
from database import SessionLocal
from models import Event, Metric

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")
PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://project-service:8000")


def resolve_project_type(project_id: int):
    if not project_id:
        return None
    try:
        response = httpx.get(f"{PROJECT_SERVICE_URL}/api/v1/projects/{project_id}", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            project_type = data.get("project_type") or data.get("type")
            if project_type:
                return str(project_type).lower()
    except Exception as exc:
        print(f"resolve_project_type error: {exc}")
    return None


def process_event(ch, method, properties, body):
    try:
        event_data = json.loads(body)
        event_type = event_data.get("type")
        data = event_data.get("data", {})
        
        db = SessionLocal()
        try:
            event = Event(
                event_type=event_type,
                user_id=data.get("user_id"),
                data=data
            )
            db.add(event)
            
            if event_type == "escrow.released":
                project_type = data.get("project_type")
                if not project_type:
                    project_type = resolve_project_type(data.get("project_id"))
                meta = {
                    "project_type": project_type or "unknown"
                }
                metric = Metric(
                    metric_name="revenue",
                    value=data.get("commission_amount", 0),
                    date=datetime.utcnow(),
                    meta_data=meta
                )
                db.add(metric)
            
            db.commit()
        finally:
            db.close()
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"Error processing event: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_worker():
    params = pika.URLParameters(RABBITMQ_URL)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue='events', durable=True)
    channel.basic_consume(queue='events', on_message_callback=process_event)
    print("Analytics worker started. Waiting for events...")
    channel.start_consuming()


if __name__ == "__main__":
    start_worker()
