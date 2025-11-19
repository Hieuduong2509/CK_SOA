import pika
import json
from database import SessionLocal
from crud import create_notification
import os

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")


def process_notification(ch, method, properties, body):
    try:
        event = json.loads(body)
        event_type = event.get("type")
        data = event.get("data", {})
        
        db = SessionLocal()
        try:
            # Handle different event types
            if event_type == "bid.created":
                create_notification(
                    db,
                    user_id=data.get("client_id"),
                    type="bid_received",
                    title="New Bid Received",
                    message=f"You received a new bid on your project",
                    data=data
                )
            elif event_type == "bid.accepted":
                create_notification(
                    db,
                    user_id=data.get("freelancer_id"),
                    type="project_accepted",
                    title="Bid Accepted",
                    message=f"Your bid has been accepted!",
                    data=data
                )
            elif event_type == "milestone.submitted":
                create_notification(
                    db,
                    user_id=data.get("client_id"),
                    type="milestone_submitted",
                    title="Milestone Submitted",
                    message=f"Work has been submitted for review",
                    data=data
                )
            elif event_type == "milestone.approved":
                create_notification(
                    db,
                    user_id=data.get("freelancer_id"),
                    type="payment_released",
                    title="Payment Released",
                    message=f"Your payment has been released",
                    data=data
                )
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

