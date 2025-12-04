import pika
import json
import os
from database import SessionLocal
from crud import get_or_create_conversation, create_message

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@rabbitmq:5672/")


def process_messaging_event(ch, method, properties, body):
    """Process events related to messaging (conversation creation, etc.)"""
    try:
        event_data = json.loads(body)
        event_type = event_data.get("type")
        data = event_data.get("data", {})

        print(f"Messaging worker received event: {event_type}")

        if event_type == "project.created_from_gig":
            # Auto-create conversation when a GIG_ORDER project is created
            project_id = data.get("project_id")
            client_id = data.get("client_id")
            freelancer_id = data.get("freelancer_id")
            service_name = data.get("service_name", "Gói dịch vụ")

            if not all([project_id, client_id, freelancer_id]):
                print(f"Missing required fields for project.created_from_gig: {data}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # Get database session
            db = SessionLocal()
            try:
                # Get or create conversation
                conversation = get_or_create_conversation(
                    db=db,
                    participant1_id=client_id,
                    participant2_id=freelancer_id,
                    project_id=project_id
                )

                # Send welcome message from freelancer
                welcome_message = (
                    f"Xin chào! Tôi đã nhận được đơn hàng '{service_name}' của bạn. "
                    f"Tôi sẽ bắt đầu làm việc ngay. Nếu có bất kỳ yêu cầu hoặc câu hỏi nào, "
                    f"vui lòng cho tôi biết. Cảm ơn bạn đã tin tưởng!"
                )

                create_message(
                    db=db,
                    conversation_id=conversation.id,
                    sender_id=freelancer_id,
                    content=welcome_message,
                    attachments=None
                )

                print(f"Created conversation {conversation.id} and welcome message for project {project_id}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                print(f"Error processing project.created_from_gig: {e}")
                import traceback
                traceback.print_exc()
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            finally:
                db.close()
        else:
            # Unknown event type, acknowledge but don't process
            print(f"Unknown event type: {event_type}")
            ch.basic_ack(delivery_tag=method.delivery_tag)

    except json.JSONDecodeError as e:
        print(f"Failed to parse event JSON: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        print(f"Error processing messaging event: {e}")
        import traceback
        traceback.print_exc()
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_worker():
    """Start the messaging worker to listen for events"""
    params = pika.URLParameters(RABBITMQ_URL)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue='events', durable=True)
    channel.basic_consume(queue='events', on_message_callback=process_messaging_event)
    print("Messaging worker started. Waiting for events...")
    channel.start_consuming()


if __name__ == "__main__":
    start_worker()

