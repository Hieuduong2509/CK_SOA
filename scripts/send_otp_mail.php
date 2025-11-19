<?php
/**
 * CLI helper to send transactional emails via PHPMailer.
 * Usage: php send_otp_mail.php <recipient> <base64_subject> <base64_body>
 */

require_once __DIR__ . '/PHPMailer-master/src/Exception.php';
require_once __DIR__ . '/PHPMailer-master/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer-master/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if ($argc < 4) {
    fwrite(STDERR, "Usage: php send_otp_mail.php <recipient> <base64_subject> <base64_body>\n");
    exit(1);
}

$recipient = $argv[1];
$subject = base64_decode($argv[2], true);
$body = base64_decode($argv[3], true);

if ($subject === false || $body === false) {
    fwrite(STDERR, "Invalid base64 subject or body.\n");
    exit(1);
}

$host = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
$username = getenv('SMTP_USERNAME');
$password = getenv('SMTP_PASSWORD');
$port = getenv('SMTP_PORT') ?: 587;
$encryption = getenv('SMTP_ENCRYPTION') ?: PHPMailer::ENCRYPTION_STARTTLS;
$fromEmail = getenv('SMTP_FROM_EMAIL') ?: $username;
$fromName = getenv('SMTP_FROM_NAME') ?: 'CodeDesign';

if (!$username || !$password || !$fromEmail) {
    fwrite(STDERR, "SMTP environment variables are not fully configured.\n");
    exit(1);
}

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = $host;
    $mail->SMTPAuth = true;
    $mail->Username = $username;
    $mail->Password = $password;
    $mail->SMTPSecure = $encryption;
    $mail->Port = (int) $port;
    $mail->CharSet = 'UTF-8';

    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($recipient);

    $mail->isHTML(false);
    $mail->Subject = $subject;
    $mail->Body = $body;

    $mail->send();
} catch (Exception $e) {
    fwrite(STDERR, "PHPMailer Error: " . $mail->ErrorInfo . "\n");
    exit(1);
}

exit(0);

