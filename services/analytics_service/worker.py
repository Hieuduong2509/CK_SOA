import pika
import json
from database import SessionLocal
from models import Event, Metric
import os

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")


def process_event(ch, method, properties, body):
    try:
        event_data = json.loads(body)
        event_type = event_data.get("type")
        data = event_data.get("data", {})
        
        db = SessionLocal()
        try:
            # Store event
            event = Event(
                event_type=event_type,
                user_id=data.get("user_id"),
                data=data
            )
            db.add(event)
            
            # Update metrics
            if event_type == "escrow.released":
                metric = Metric(
                    metric_name="revenue",
                    value=data.get("commission_amount", 0),
                    date=datetime.utcnow()
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
    from datetime import datetime
    start_worker()

