DROP TABLE IF EXISTS customer;
DROP TYPE IF EXISTS location_enum;

CREATE TYPE location_enum AS ENUM ('Computers', 'Appliances', 'Home Audio', 'Printers');

CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(32),
    location location_enum NOT NULL,
    queue_position INT NOT NULL,
    add_time TIMESTAMP DEFAULT NOW(),
    start_time TIMESTAMP,
    complete_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);