DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS customer;
DROP TYPE IF EXISTS location_enum;

CREATE TYPE location_enum AS ENUM ('Computers', 'Appliances', 'Home Audio', 'Printers');

CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(32),
    location location_enum NOT NULL,
    queue_position INT NOT NULL,
    access_code TEXT UNIQUE NOT NULL,
    add_time TIMESTAMP DEFAULT NOW(),
    start_time TIMESTAMP,
    complete_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin user (username: admin, password: password)
-- Password hash generated with bcrypt (12 rounds)
INSERT INTO users (username, password_hash) VALUES ('admin', '$2b$12$C4pTRyFjEdYOFEQCLePmBOXFJ6CYBoS0cwZWGKaHJNYDaPXemIRzC');