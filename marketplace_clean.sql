CREATE DATABASE IF NOT EXISTS marketplace
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE marketplace;

-- ===== USERS & PROFILES =====
CREATE TABLE IF NOT EXISTS users (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    email          VARCHAR(120) UNIQUE NOT NULL,
    password_hash  VARCHAR(200)       NOT NULL,
    full_name      VARCHAR(120)       NOT NULL,
    role           ENUM('client','freelancer','admin') NOT NULL,
    created_at     TIMESTAMP          DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNIQUE,
    headline      VARCHAR(150),
    avatar_url    TEXT,
    hourly_rate   DECIMAL(12,2),
    rating        DECIMAL(3,2) DEFAULT 0,
    total_reviews INT           DEFAULT 0,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== PROJECTS & BIDS =====
CREATE TABLE IF NOT EXISTS projects (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    client_id     INT NOT NULL,
    freelancer_id INT,
    title         VARCHAR(200) NOT NULL,
    budget        DECIMAL(12,2) NOT NULL,
    status        ENUM('open','in_progress','delivered','completed','cancelled') NOT NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_client FOREIGN KEY (client_id) REFERENCES users(id),
    CONSTRAINT fk_projects_freelancer FOREIGN KEY (freelancer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bids (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    project_id     INT NOT NULL,
    freelancer_id  INT NOT NULL,
    price          DECIMAL(12,2) NOT NULL,
    timeline_days  INT NOT NULL,
    status         ENUM('pending','accepted','rejected') NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bids_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_bids_freelancer FOREIGN KEY (freelancer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== MILESTONES & SUBMISSIONS =====
CREATE TABLE IF NOT EXISTS milestones (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    title      VARCHAR(200) NOT NULL,
    amount     DECIMAL(12,2) NOT NULL,
    status     ENUM('pending','submitted','approved','paid') NOT NULL,
    CONSTRAINT fk_milestones_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS milestone_submissions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    milestone_id  INT NOT NULL,
    description   TEXT,
    file_urls     TEXT,
    submitted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_submission_milestone FOREIGN KEY (milestone_id) REFERENCES milestones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== MESSAGING =====
CREATE TABLE IF NOT EXISTS conversations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    project_id      INT,
    participant1_id INT NOT NULL,
    participant2_id INT NOT NULL,
    last_message_at TIMESTAMP,
    CONSTRAINT fk_conversation_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_conversation_user1 FOREIGN KEY (participant1_id) REFERENCES users(id),
    CONSTRAINT fk_conversation_user2 FOREIGN KEY (participant2_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== PAYMENTS =====
CREATE TABLE IF NOT EXISTS wallets (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    balance DECIMAL(16,2) DEFAULT 0,
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    type       ENUM('topup','escrow_deposit','escrow_release','withdraw') NOT NULL,
    amount     DECIMAL(16,2) NOT NULL,
    status     ENUM('pending','success','failed') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS escrows (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    project_id    INT NOT NULL,
    milestone_id  INT,
    client_id     INT NOT NULL,
    freelancer_id INT NOT NULL,
    amount        DECIMAL(16,2) NOT NULL,
    status        ENUM('locked','released','refunded') NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_escrow_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_escrow_milestone FOREIGN KEY (milestone_id) REFERENCES milestones(id),
    CONSTRAINT fk_escrow_client FOREIGN KEY (client_id) REFERENCES users(id),
    CONSTRAINT fk_escrow_freelancer FOREIGN KEY (freelancer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== SUPPORT =====
CREATE TABLE IF NOT EXISTS notifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    type       VARCHAR(50) NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS disputes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    raised_by  INT NOT NULL,
    status     ENUM('open','in_review','resolved') NOT NULL,
    reason     TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_disputes_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_disputes_user FOREIGN KEY (raised_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

