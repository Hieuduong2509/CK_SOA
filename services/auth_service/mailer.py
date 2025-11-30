import base64
import os
import subprocess

PHPMAILER_SCRIPT_PATH = os.getenv("PHPMAILER_SCRIPT_PATH", "/app/scripts/send_otp_mail.php")


class MailerError(RuntimeError):
    pass


def send_email_via_phpmailer(email: str, subject: str, body: str):
    """
    Invoke the PHP PHPMailer script to send email.
    Subject/body are base64-encoded to avoid CLI escaping issues.
    """
    if not PHPMAILER_SCRIPT_PATH or not os.path.exists(PHPMAILER_SCRIPT_PATH):
        raise MailerError("PHPMailer script path is not configured or missing.")

    encoded_subject = base64.b64encode(subject.encode("utf-8")).decode("utf-8")
    encoded_body = base64.b64encode(body.encode("utf-8")).decode("utf-8")

    try:
        result = subprocess.run(
            ["php", PHPMAILER_SCRIPT_PATH, email, encoded_subject, encoded_body],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise MailerError("PHP executable not found in container. Please ensure php-cli is installed.") from exc

    if result.returncode != 0:
        stderr = result.stderr.strip() or "Unknown PHPMailer error"
        raise MailerError(stderr)

