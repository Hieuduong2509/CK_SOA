<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require '../PHPMailer-master/src/Exception.php';
require '../PHPMailer-master/src/PHPMailer.php';
require '../PHPMailer-master/src/SMTP.php';

header('Content-Type: application/json; charset=utf-8');

// Nhận dữ liệu từ backend
$rawBody = file_get_contents("php://input");
$json = json_decode($rawBody, true);
if (!is_array($json)) {
    $json = [];
}

$toEmail = '';
$otpCode = '';

if (!empty($json['email'])) {
    $toEmail = $json['email'];
} elseif (!empty($_POST['email'])) {
    $toEmail = $_POST['email'];
} elseif (!empty($_GET['email'])) {
    $toEmail = $_GET['email'];
}

if (!empty($json['otp'])) {
    $otpCode = $json['otp'];
} elseif (!empty($_POST['otp'])) {
    $otpCode = $_POST['otp'];
} elseif (!empty($_GET['otp'])) {
    $otpCode = $_GET['otp'];
}

if (empty($toEmail) || empty($otpCode)) {
    http_response_code(400);
    echo json_encode(["error" => "Thiếu email hoặc mã OTP"]);
    exit;
}

if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Email không hợp lệ"]);
    exit;
}

if (!preg_match('/^[0-9]{4,8}$/', (string)$otpCode)) {
    http_response_code(400);
    echo json_encode(["error" => "Mã OTP không hợp lệ"]);
    exit;
}

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->CharSet = 'UTF-8';
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'hieuduong2509@gmail.com';
    $mail->Password = 'bjmw rdhx swkd kthz'; // App password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;

    $mail->setFrom('hieuduong2509@gmail.com', 'iBanking Tuition');
    $mail->addAddress($toEmail);

    $mail->isHTML(true);
    $mail->Subject = 'Mã OTP Xác Thực Giao Dịch iBanking';
    $mail->Body = "
        <div style='font-family:sans-serif'>
            <h2>Xin chào,</h2>
            <p>Bạn đang xác nhận thanh toán học phí qua iBanking Tuition.</p>
            <p><b>Mã OTP của bạn là:</b> <span style='font-size:24px;color:#007bff'>$otpCode</span></p>
            <p>Mã OTP có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
            <hr>
            <small>Trân trọng,<br>Hệ thống iBanking Tuition</small>
        </div>
    ";
    $mail->AltBody = "Mã OTP của bạn là: $otpCode (hiệu lực trong 5 phút)";

    $mail->send();
    echo json_encode(["success" => true, "message" => "Đã gửi OTP đến email $toEmail"]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Không gửi được email: {$mail->ErrorInfo}"]);
}
