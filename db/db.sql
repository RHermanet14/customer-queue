DROP TABLE IF EXISTS customer;
DROP TYPE IF EXISTS location_enum;

CREATE TYPE location_enum AS ENUM ('Computers', 'Applicances', 'Home Audio', 'Printers');

CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(32),
    location location_enum NOT NULL,
    queue_position INT,
    add_time TIMESTAMP DEFAULT NOW(),
    remove_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);